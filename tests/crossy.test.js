import { CONFIG } from '../js/config.js';
import {
  CrossyLane,
  CrossyPlayer,
  LaneType,
  WORLD_HALF_WIDTH
} from '../js/game/crossy/crossyEntities.js';
import { CrossyPoseController } from '../js/game/crossy/crossyPoseController.js';
import { CrossyEngine } from '../js/game/crossy/crossyEngine.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

function makePose({ noseY = 0.35, shY = 0.50, lwY = 0.70, rwY = 0.70, lwX = 0.38, rwX = 0.62 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  lm[0] = { x: 0.5, y: noseY, visibility: 0.95 };
  lm[11] = { x: 0.40, y: shY, visibility: 0.95 }; // span = 0.20
  lm[12] = { x: 0.60, y: shY, visibility: 0.95 };
  lm[15] = { x: lwX, y: lwY, visibility: 0.95 };
  lm[16] = { x: rwX, y: rwY, visibility: 0.95 };
  return [lm];
}

function runTests() {
  console.log('--- Testing Config & Pose Controller (Jump + Wing Flap) ---');
  assert(CONFIG.MODES.CROSSY === 'CROSSY', 'CONFIG.MODES registers CROSSY mode');

  const ctrl = new CrossyPoseController();
  const standPose = makePose();
  const resStand = ctrl.update(standPose, 0.016);
  assert(resStand.triggerHop === false, 'Neutral standing pose does not trigger hop');

  // Physical upward jump
  const jumpPose = makePose({ noseY: 0.25, shY: 0.40 });
  const resJump = ctrl.update(jumpPose, 0.016);
  assert(resJump.triggerHop === true && resJump.reason === 'JUMP', 'Physical upward jump triggers forward hop');

  // Landing bounce protection
  const resBounce = ctrl.update(jumpPose, 0.05);
  assert(resBounce.triggerHop === false, 'Jump cooldown/landing guard prevents double trigger');

  // Wing Flap cycle: arms lowered -> spread wide outward at shoulder height -> triggers FLAP
  const ctrlF = new CrossyPoseController();
  const wingsDownPose = makePose({ lwY: 0.72, rwY: 0.72, lwX: 0.38, rwX: 0.62 });
  const wingsUpPose = makePose({ lwY: 0.48, rwY: 0.48, lwX: 0.18, rwX: 0.82 }); // shoulder=0.50, spread=0.64 > 1.2*0.20
  ctrlF.update(wingsDownPose, 0.016);

  const rFlap1 = ctrlF.update(wingsUpPose, 0.016);
  assert(rFlap1.triggerHop === true && rFlap1.reason === 'FLAP', 'Outward Wing Flap (DOWN -> UP) triggers forward hop');

  // Holding wings out does not spam hops
  ctrlF.flapCooldown = 0;
  ctrlF.sharedHopLock = 0;
  const rFlapHold = ctrlF.update(wingsUpPose, 0.05);
  assert(rFlapHold.triggerHop === false, 'Holding wings raised does not continuously spam hops');

  // Flap arms down then lift again -> triggers 2nd hop
  ctrlF.update(wingsDownPose, 0.30);
  const rFlap2 = ctrlF.update(wingsUpPose, 0.05);
  assert(rFlap2.triggerHop === true && rFlap2.reason === 'FLAP', 'Flapping wings down then lifting triggers next hop');

  // Simultaneous jump + wing flap co-trigger deduplication -> fires ONCE
  const ctrlCo = new CrossyPoseController();
  ctrlCo.update(wingsDownPose, 0.016);
  const comboPose = makePose({ noseY: 0.25, shY: 0.40, lwY: 0.38, rwY: 0.38, lwX: 0.18, rwX: 0.82 });
  const rCo1 = ctrlCo.update(comboPose, 0.016);
  const rCo2 = ctrlCo.update(comboPose, 0.016);
  assert(rCo1.triggerHop === true && rCo2.triggerHop === false, 'Simultaneous Jump + Wing Flap fires only 1 single hop');

  console.log('--- Testing Entities, Coins on Path/Rafts & Raft Drift ---');
  const player = new CrossyPlayer();
  player.reset(4, 160);
  player.startHop(LaneType.RIVER);
  assert(player.hopTargetX === 160, 'Hopping off RIVER raft preserves drifted X trajectory');

  player.reset(5, 160);
  player.startHop(LaneType.GRASS);
  assert(Math.abs(player.hopTargetX) < 160, 'Hopping from solid GRASS gently auto-centers toward x = 0');

  let grassCoinsReachable = true;
  for (let i = 0; i < 30; i++) {
    const gl = new CrossyLane(5 + i, LaneType.GRASS, 3);
    if (gl.coin && Math.abs(gl.coin.x) > 22) {
      grassCoinsReachable = false;
    }
  }
  const grassLane = new CrossyLane(10, LaneType.GRASS, 3);
  const allTreesOutsidePlayable = grassLane.sideDecor.every(d => Math.abs(d.x) > WORLD_HALF_WIDTH);
  assert(allTreesOutsidePlayable, 'Grass obstacles stay outside playable corridor so drifted paths never softlock');
  assert(grassCoinsReachable, 'All Grass coins stay strictly within reachable central corridor');

  // Verify River coin rides ON TOP of a moving raft
  const riverWithCoin = new CrossyLane(6, LaneType.RIVER, 1, { dir: 1, raftCount: 2 });
  riverWithCoin.rafts = [{ x: -40, width: 160, vx: 150 }, { x: 220, width: 160, vx: 150 }];
  riverWithCoin.coin = { x: -40, raftIndex: 0, collected: false, bobPhase: 0 };
  riverWithCoin.update(0.2);
  assert(
    Math.abs(riverWithCoin.coin.x - riverWithCoin.rafts[0].x) < 0.01 && riverWithCoin.coin.x > -40,
    'River coin rides squarely on top of its moving raft'
  );

  console.log('--- Testing CrossyEngine Gameplay, Raft Drift & Camera Respawn ---');
  let reportedScore = 0;
  let gameOverCalled = false;
  let landSoundCalled = false;
  const mockSound = {
    playCrossyHop() {},
    playCrossyLand() { landSoundCalled = true; },
    playCrossyCoin() {},
    playCrossySplash() {},
    playCrossyTrainWarn() {},
    playCrossyCrash() {}
  };
  const engine = new CrossyEngine(1280, 720, null, mockSound);
  engine.onScore = (s) => { reportedScore = s; };
  engine.onGameOver = () => { gameOverCalled = true; };

  engine.start();
  assert(engine.state === 'PLAYING' && engine.lives === 5, 'CrossyEngine starts cleanly with 5 lives');

  const hopped = engine.triggerHop('TEST');
  assert(hopped === true && engine.player.isHopping === true, 'triggerHop initiates forward hop');
  assert(
    engine.player.scaleY > 1.1 && engine.groundRipples.length >= 1 && engine.particles.length >= 5,
    'Takeoff applies vertical stretch and spawns launch ripple + dust puff'
  );

  // Advance just past hopDuration (0.17s) to catch impact squash & landing effects
  engine.update(0.10, 0, null, null);
  engine.update(0.08, 0, null, null);
  assert(
    engine.player.scaleX > 1.15 && engine.player.scaleY < 0.85 && engine.landCameraBounce > 0 && landSoundCalled,
    'Landing triggers impact squash, camera bounce, and landing ripple/SFX'
  );

  // Advance partway through elastic bounce rebound (bounceZ > 0), then settle cleanly to rest
  engine.update(0.09, 0, null, null);
  assert(engine.player.bounceZ > 0, 'Post-landing spring rebound lifts chicken slightly (bounceZ > 0)');
  for (let i = 0; i < 4; i++) {
    engine.update(0.05, 0, null, null);
  }
  assert(
    engine.player.scaleX === 1 && engine.player.scaleY === 1 && engine.player.bounceZ === 0,
    'Bounce settles smoothly back to neutral scale (1, 1)'
  );
  assert(engine.player.row === 1 && engine.maxRow === 1 && engine.score >= 1, 'Player lands on row 1 and scores forward point');
  assert(reportedScore === engine.score, 'onScore callback synced');

  // River raft drift test
  const riverLane = new CrossyLane(2, LaneType.RIVER, 1, { dir: 1, raftCount: 1 });
  riverLane.rafts = [{ x: 0, width: 160, vx: 120 }];
  engine.lanes.set(2, riverLane);
  engine.player.invulnerableTimer = 0;
  engine.triggerHop('TEST');
  for (let i = 0; i < 5; i++) {
    engine.update(0.05, 0, null, null);
  }
  assert(engine.player.row === 2 && engine.lives === 5, 'Landing on river raft keeps player safe on row 2');

  const xBeforeDrift = engine.player.x;
  engine.update(0.1, 0, null, null);
  engine.update(0.1, 0, null, null);
  assert(engine.player.x > xBeforeDrift, 'Player physically drifts rightward alongside moving raft');

  // Open water splash
  engine.player.x = 260;
  engine.player.invulnerableTimer = 0;
  engine.update(0.02, 0, null, null);
  assert(engine.lives === 4 && engine.player.row <= 2 && engine.player.x === 0, 'Falling in open river costs 1 life and respawns safely at x=0');

  // Camera respawn follow test across 3+ road lanes
  engine.lastSafeRow = 2;
  engine.lanes.set(2, new CrossyLane(2, LaneType.GRASS, 1));
  const roadAhead = new CrossyLane(6, LaneType.ROAD, 1, { dir: 1, vehicleCount: 1 });
  roadAhead.vehicles = [{ x: 0, width: 80, vx: 0, kind: 'CAR', color: '#ef4444' }];
  engine.lanes.set(6, roadAhead);
  engine.player.reset(6, 0);
  engine.player.invulnerableTimer = 0;
  engine.cameraRow = 8.5; // scrolled far ahead across 3+ road lanes
  engine.update(0.02, 0, null, null);
  assert(
    engine.player.row === 2 && engine.cameraRow <= 4.0,
    'Camera snaps back cleanly to follow player respawned on safe grass row'
  );

  // Fatal crash at 1 life triggers GAMEOVER
  const roadLane = new CrossyLane(1, LaneType.ROAD, 1, { dir: 1, vehicleCount: 1 });
  roadLane.vehicles = [{ x: 0, width: 80, vx: 0, kind: 'CAR', color: '#ef4444' }];
  engine.lanes.set(1, roadLane);
  engine.lives = 1;
  engine.player.reset(1, 0);
  engine.player.invulnerableTimer = 0;
  engine.update(0.02, 0, null, null);
  assert(engine.lives === 0 && engine.state === 'GAMEOVER' && gameOverCalled === true, 'Fatal collision at 1 life triggers GAMEOVER');

  console.log(`\nCrossy Tests Complete: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
