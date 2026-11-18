import { CONFIG } from '../js/config.js';
import { RedLightPoseController } from '../js/game/redlight/redLightPoseController.js';
import {
  CHANT_RHYTHMS,
  CHANT_SYLLABLES,
  RedLightEngine,
  RedLightPhase
} from '../js/game/redlight/redLightEngine.js';

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

function makePose({ noseY = 0.25, shoulderY = 0.42, wristY = 0.62, armShift = 0 } = {}) {
  const lm = new Array(33).fill(null);
  lm[0] = { x: 0.5 + armShift * 0.2, y: noseY, visibility: 0.99 };
  lm[11] = { x: 0.41, y: shoulderY, visibility: 0.99 };
  lm[12] = { x: 0.59, y: shoulderY, visibility: 0.99 };
  lm[13] = { x: 0.37, y: (shoulderY + wristY) * 0.5, visibility: 0.99 };
  lm[14] = { x: 0.63, y: (shoulderY + wristY) * 0.5, visibility: 0.99 };
  lm[15] = { x: 0.35 + armShift, y: wristY, visibility: 0.99 };
  lm[16] = { x: 0.65 - armShift, y: wristY - armShift * 0.5, visibility: 0.99 };
  lm[23] = { x: 0.44, y: 0.68, visibility: 0.99 };
  lm[24] = { x: 0.56, y: 0.68, visibility: 0.99 };
  lm[25] = { x: 0.44, y: 0.80 - Math.abs(armShift) * 0.3, visibility: 0.99 };
  lm[26] = { x: 0.56, y: 0.80 + Math.abs(armShift) * 0.2, visibility: 0.99 };
  return [lm];
}

function runTests() {
  console.log('--- Testing Config & RedLightPoseController ---');
  assert(CONFIG.MODES.RED_LIGHT === 'RED_LIGHT', 'CONFIG.MODES registers RED_LIGHT mode');
  assert(
    CHANT_SYLLABLES.join('') === '무궁화꽃이피었습니다!',
    'Chant syllables match "무궁화꽃이피었습니다!"'
  );

  const pc = new RedLightPoseController();
  const idlePose = makePose();
  pc.update(idlePose, 0.05, false);
  const idleRes = pc.update(idlePose, 0.05, false);
  assert(idleRes.runIntensity === 0, 'Standing still yields zero runIntensity');
  assert(idleRes.isManse === false, 'Hands lowered do not trigger Manse');

  // Simulate alternating in-place running & arm pump
  let activeRes = idleRes;
  for (let i = 0; i < 8; i++) {
    const p = makePose({
      noseY: 0.25 + (i % 2 === 0 ? -0.04 : 0.04),
      wristY: i % 2 === 0 ? 0.52 : 0.68,
      armShift: i % 2 === 0 ? 0.14 : -0.14
    });
    activeRes = pc.update(p, 0.04, false);
  }
  assert(activeRes.runIntensity > 0.5, `In-place running raises runIntensity (${activeRes.runIntensity.toFixed(2)} > 0.5)`);

  // Manse pose recognition
  const mansePose = makePose({ noseY: 0.25, shoulderY: 0.42, wristY: 0.16 });
  const manseRes = pc.update(mansePose, 0.04, false);
  assert(manseRes.isManse === true, 'Manse gesture detected when both wrists lifted high');

  // Freeze detection: grace (0.28s) -> freeze anchor -> stay still passes -> big move fails
  pc.startFreezeCheck(0.28);
  for (let i = 0; i < 4; i++) {
    pc.update(idlePose, 0.08, true); // 0.32s total exits 0.28s grace and captures idle anchor
  }
  const stillRed = pc.update(makePose({ wristY: 0.625 }), 0.05, true);
  assert(stillRed.inGracePeriod === false && stillRed.motionDetected === false, 'Tiny noise stays safe during RED_LIGHT freeze');

  let movedRed = stillRed;
  for (let i = 0; i < 10; i++) {
    movedRed = pc.update(makePose({ wristY: 0.36, armShift: 0.2 }), 0.04, true);
  }
  assert(movedRed.motionDetected === true, 'Noticeable body motion during RED_LIGHT triggers fail');

  console.log('--- Testing RedLightEngine Phases & Reverse Escape Chase ---');
  const sfxLog = [];
  const mockSound = {
    playRedLightSyllable: (idx) => sfxLog.push(`SYL_${idx}`),
    playRedLightSnap: () => sfxLog.push('SNAP'),
    playRedLightDetected: () => sfxLog.push('DETECT'),
    playRedLightTag: () => sfxLog.push('TAG'),
    playRedLightStep: () => sfxLog.push('STEP'),
    playRedLightChaserStep: () => sfxLog.push('CHASE_STEP'),
    playRedLightClear: () => sfxLog.push('CLEAR')
  };

  let lastScore = 0;
  let gameOverCalled = false;
  const engine = new RedLightEngine(1280, 720, null, mockSound);
  engine.onScore = (s) => { lastScore = s; };
  engine.onGameOver = () => { gameOverCalled = true; };

  engine.start();
  assert(engine.state === 'PLAYING' && engine.phase === RedLightPhase.GREEN_LIGHT, 'Game starts in GREEN_LIGHT phase');

  const initialScale = engine.getTargetScale(engine.distance);
  // Simulate running forward during GREEN_LIGHT
  for (let i = 0; i < 20; i++) {
    const runPose = makePose({
      noseY: 0.25 + (i % 2 === 0 ? -0.05 : 0.05),
      wristY: i % 2 === 0 ? 0.50 : 0.68,
      armShift: i % 2 === 0 ? 0.16 : -0.16
    });
    engine.update(0.05, 0, runPose);
  }
  const midScale = engine.getTargetScale(engine.distance);
  assert(
    engine.distance > 0.05 && engine.distance < 0.20 && midScale > initialScale && sfxLog.includes('SYL_0'),
    'In-place running advances paced longer distance forward and grows target perspective scale'
  );

  // Advance until chant completes -> transitions to RED_LIGHT with red eyes snap SFX
  let guard = 0;
  while (engine.phase === RedLightPhase.GREEN_LIGHT && guard < 120) {
    engine.update(0.05, 0, idlePose);
    guard++;
  }
  assert(
    engine.phase === RedLightPhase.RED_LIGHT && sfxLog.includes('SNAP'),
    'Completing chant snaps eyes open (RED_LIGHT) and plays scanner snap SFX'
  );

  // Move during RED_LIGHT -> triggers CAUGHT_FAIL -> GAMEOVER
  for (let i = 0; i < 16; i++) {
    engine.update(0.05, 0, i > 6 ? makePose({ wristY: 0.25, armShift: 0.25 }) : idlePose);
  }
  assert(
    engine.phase === RedLightPhase.CAUGHT_FAIL && engine.failReason === 'MOTION' && sfxLog.includes('DETECT'),
    'Moving while Young-hee has red eyes triggers MOTION fail + alarm SFX'
  );
  for (let i = 0; i < 26; i++) {
    engine.update(0.05, 0, idlePose);
  }
  assert(engine.state === 'GAMEOVER' && gameOverCalled === true, 'Caught fail transitions cleanly to GAMEOVER');

  // Test Full Clear Loop: Reach 100% -> Manse Tag -> Reverse Sprint Escape -> Round Clear!
  engine.start();
  gameOverCalled = false;
  engine.distance = 0.96;
  engine.chantProgress = 0.1;
  engine.chantDuration = 5.0;
  for (let i = 0; i < 18; i++) {
    const runPose = makePose({
      noseY: 0.25 + (i % 2 === 0 ? -0.05 : 0.05),
      wristY: i % 2 === 0 ? 0.48 : 0.68,
      armShift: i % 2 === 0 ? 0.18 : -0.18
    });
    engine.update(0.05, 0, runPose);
  }
  assert(engine.phase === RedLightPhase.TAG_READY, 'Reaching 100% distance enters TAG_READY phase');

  // Raise both arms in Manse to slap/tag Young-hee!
  engine.update(0.04, 0, mansePose);
  assert(
    engine.phase === RedLightPhase.ESCAPE_RUN && sfxLog.includes('TAG'),
    'Manse gesture touches Young-hee and triggers reverse ESCAPE_RUN chase'
  );

  // Sprint rapidly in ESCAPE_RUN: verify Young-hee stays right behind at 90% speed & beats player if slowed!
  const prevEsc = engine.escapeProgress;
  let checkedRatio = false;
  for (let i = 0; i < 160 && engine.phase === RedLightPhase.ESCAPE_RUN; i++) {
    const sprintPose = makePose({
      noseY: 0.25 + (i % 2 === 0 ? -0.06 : 0.06),
      wristY: i % 2 === 0 ? 0.46 : 0.70,
      armShift: i % 2 === 0 ? 0.20 : -0.20
    });
    engine.update(0.05, 0, sprintPose);
    if (i === 18 && engine.playerSpeed > 0.10) {
      checkedRatio = Math.abs(engine.chaseSpeed / engine.playerSpeed - 0.90) < 0.04;
    }
  }
  assert(checkedRatio, 'Young-hee chase speed locks closely at ~90% of player sprint speed');
  assert(
    engine.escapeProgress > prevEsc && engine.phase === RedLightPhase.ROUND_CLEAR && sfxLog.includes('CLEAR') && sfxLog.includes('CHASE_STEP') && lastScore > 200,
    'Fast reverse sprinting clears ROUND 1 while chaser footsteps play right behind'
  );

  // Advance round clear -> Round 2 starts
  for (let i = 0; i < 42; i++) {
    engine.update(0.05, 0, idlePose);
  }
  assert(engine.round === 2 && engine.phase === RedLightPhase.GREEN_LIGHT, 'Completing Round 1 advances cleanly to Round 2');

  // Test Slow Escape -> Caught by Chaser ("늦으면 잡힘")
  engine.phase = RedLightPhase.ESCAPE_RUN;
  engine.escapeProgress = 0.20;
  engine.chaserProgress = 0.15;
  engine.chaseSpeed = 0.25;
  for (let i = 0; i < 10; i++) {
    engine.update(0.05, 0, idlePose);
  }
  assert(
    engine.phase === RedLightPhase.CAUGHT_FAIL && engine.failReason === 'CAUGHT_ESCAPE',
    'Being too slow during ESCAPE_RUN gets caught by Young-hee (CAUGHT_ESCAPE)'
  );

  // Verify headless render across all phases
  const mockCtx = {
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    clip() {},
    arc() {},
    ellipse() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {},
    fillRect() {},
    roundRect() {},
    strokeText() {},
    fillText() {},
    drawImage() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set lineCap(_) {},
    set lineJoin(_) {},
    set globalAlpha(_) {},
    set font(_) {},
    set textAlign(_) {}
  };
  let renderErr = null;
  try {
    for (const ph of Object.values(RedLightPhase)) {
      engine.phase = ph;
      engine.render(mockCtx);
    }
  } catch (e) {
    renderErr = e;
  }
  assert(!renderErr, 'All 6 RedLightEngine phases render cleanly without errors');

  // Test varied chant rhythm timings (Normal, Syncopated, Accelerando, Suspense, Turbo)
  engine.start();
  assert(
    engine.chantRhythm.id === 'NORMAL',
    'Round 1 chant #1 starts cleanly on NORMAL straight beat'
  );
  const gap0 = engine.chantTimes[1] - engine.chantTimes[0];
  const gap5 = engine.chantTimes[6] - engine.chantTimes[5];
  assert(Math.abs(gap0 - gap5) < 0.01, 'NORMAL rhythm spaces all 10 syllables evenly');

  engine._enterGreenLight('SYNCOPATED');
  const syncGaps = [];
  for (let i = 0; i < 9; i++) {
    syncGaps.push(engine.chantTimes[i + 1] - engine.chantTimes[i]);
  }
  const syncRatio = Math.max(...syncGaps) / Math.min(...syncGaps);
  assert(syncRatio > 2.2, `SYNCOPATED rhythm creates strong off-beat variance (ratio=${syncRatio.toFixed(2)})`);

  engine._enterGreenLight('ACCELERANDO');
  const openGap = engine.chantTimes[1] - engine.chantTimes[0];
  const tailGap = engine.chantTimes[8] - engine.chantTimes[7];
  assert(openGap > tailGap * 4, 'ACCELERANDO opens slow then accelerates sharply toward "피었습니다!"');

  engine._enterGreenLight('TURBO');
  const turboDur = engine.chantDuration;
  engine._enterGreenLight('NORMAL');
  const normalDur = engine.chantDuration;
  assert(
    Object.keys(CHANT_RHYTHMS).length >= 5 && turboDur < normalDur * 0.78,
    `TURBO chant is significantly shorter (${turboDur.toFixed(2)}s vs NORMAL ${normalDur.toFixed(2)}s)`
  );

  // Verify random selection across subsequent chants uses multiple distinct rhythms
  const seenRhythms = new Set();
  for (let i = 0; i < 18; i++) {
    engine._enterGreenLight();
    seenRhythms.add(engine.chantRhythm.id);
  }
  assert(seenRhythms.size >= 3, `Subsequent chants mix multiple rhythms cleanly (${[...seenRhythms].join(', ')})`);

  console.log(`\nRed Light Tests Complete: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
