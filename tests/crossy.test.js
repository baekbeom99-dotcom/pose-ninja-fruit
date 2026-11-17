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
  console.log('--- Testing Config & Pose Controller ---');
  assert(CONFIG.MODES.CROSSY === 'CROSSY', 'CONFIG.MODES registers CROSSY mode');

  const ctrl = new CrossyPoseController();
  // Establish neutral standing baseline (noseY=0.35, shY=0.50 -> bodyY=0.44)
  const standPose = makePose();
  const resStand = ctrl.update(standPose, 0.016);
  assert(resStand.triggerHop === false, 'Neutral standing pose does not trigger hop');

  // Jump upward significantly relative to shoulder span 0.20 (need > 0.24 * 0.20 = 0.048 lift)
  const jumpPose = makePose({ noseY: 0.25, shY: 0.40 });
  const resJump = ctrl.update(jumpPose, 0.016);
  assert(resJump.triggerHop === true && resJump.reason === 'JUMP', 'Physical upward jump triggers forward hop');

  // Holding peak immediately does not double-trigger jump
  const resBounce = ctrl.update(jumpPose, 0.05);
  assert(resBounce.triggerHop === false, 'Jump cooldown/landing guard prevents double trigger');

  // Test Manse rising-edge trigger (hands down -> hands up triggers once)
  const ctrlM = new CrossyPoseController();
  ctrlM.update(makePose({ lwY: 0.70, rwY: 0.70 }), 0.016); // hands lowered baseline
  const mansePose = makePose({ lwY: 0.20, rwY: 0.20, lwX: 0.30, rwX: 0.70 });
  const rManse1 = ctrlM.update(mansePose, 0.016);
  assert(rManse1.triggerHop === true && rManse1.reason === 'MANSE', 'Manse rising edge triggers forward hop');

  // Holding Manse does not spam hops continuously
  ctrlM.manseCooldown = 0;
  ctrlM.sharedHopLock = 0;
  const rManseHold = ctrlM.update(mansePose, 0.05);
  assert(rManseHold.triggerHop === false, 'Holding Manse continuously does not spam hops');

  // Lower hands then raise again -> triggers 2nd hop
  ctrlM.update(makePose({ lwY: 0.70, rwY: 0.70 }), 0.30);
  const rManse2 = ctrlM.update(mansePose, 0.05);
  assert(rManse2.triggerHop === true && rManse2.reason === 'MANSE', 'Lowering then raising Manse triggers next hop');

  // Simultaneous jump + Manse co-trigger deduplication -> fires ONCE
  const ctrlCo = new CrossyPoseController();
  ctrlCo.update(standPose, 0.016);
  const comboPose = makePose({ noseY: 0.25, shY: 0.40, lwY: 0.15, rwY: 0.15, lwX: 0.28, rwX: 0.72 });
  const rCo1 = ctrlCo.update(comboPose, 0.016);
  const rCo2 = ctrlCo.update(comboPose, 0.016);
  assert(rCo1.triggerHop === true && rCo2.triggerHop === false, 'Simultaneous Jump + Manse fires only 1 single hop');

  console.log('--- Testing Entities & 방안 1 Raft Drift / Auto-Center ---');
  const player = new CrossyPlayer();
  player.reset(4, 160);
  player.startHop(LaneType.RIVER);
  assert(player.hopTargetX === 160, 'Hopping off RIVER raft preserves drifted X trajectory');

  player.reset(5, 160);
  player.startHop(LaneType.GRASS);
  assert(Math.abs(player.hopTargetX) < 160, 'Hopping from solid GRASS gently auto-centers toward x = 0');

  const grassLane = new CrossyLane(10, LaneType.GRASS, 3);
  const allTreesOutsidePlayable = grassLane.sideDecor.every(d => Math.abs(d.x) > WORLD_HALF_WIDTH);
  assert(allTreesOutsidePlayable, 'Grass obstacles stay outside playable corridor so drifted paths never softlock');

  console.log('--- Testing CrossyEngine Gameplay, Raft Drift & Collisions ---');
  let reportedScore = 0;
  let gameOverCalled = false;
  const mockSound = {
    playCrossyHop() {},
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

  // Trigger forward hop and step until landed
  const hopped = engine.triggerHop('TEST');
  assert(hopped === true && engine.player.isHopping === true, 'triggerHop initiates forward hop');
  for (let i = 0; i < 6; i++) {
    engine.update(0.05, 0, null, null);
  }
  assert(engine.player.row === 1 && engine.maxRow === 1 && engine.score >= 1, 'Player lands on row 1 and scores forward point');
  assert(reportedScore === engine.score, 'onScore callback synced');

  // Place deterministic RIVER lane at row 2 with a raft right under player (x = 0) moving right
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

  // Jumping off river when drifted past raft -> check open water splash penalty
  engine.player.x = 260; // off raft [12..172]
  engine.player.invulnerableTimer = 0;
  engine.update(0.02, 0, null, null);
  assert(engine.lives === 4 && engine.player.row <= 2 && engine.player.x === 0, 'Falling in open river costs 1 life and respawns safely at x=0');

  // Test vehicle crash -> GameOver at 0 lives
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
