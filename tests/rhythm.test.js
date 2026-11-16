import { CONFIG } from '../js/config.js';
import { RHYTHM_TRACKS, RhythmSynth, getTrackById } from '../js/game/rhythm/rhythmSynth.js';
import {
  RHYTHM_LANES,
  SEMICIRCLE_SECTOR_COUNT,
  SECTOR_GAP_RAD,
  RhythmNoteType,
  SlashDirection,
  DodgeZone,
  TIMING_WINDOWS,
  evaluateTiming,
  generateChart
} from '../js/game/rhythm/chartGenerator.js';
import { PoseRhythmJudge } from '../js/game/rhythm/poseRhythmJudge.js';
import { RhythmEngine, computeBeatVibration } from '../js/game/rhythm/rhythmEngine.js';

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

function makePose({ nose = { x: 0.5, y: 0.3 }, ls = { x: 0.42, y: 0.55 }, rs = { x: 0.58, y: 0.55 }, lh = null, rh = null, lw = null, rw = null } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  lm[0] = { x: nose.x, y: nose.y, visibility: 0.95 };
  lm[11] = { x: ls.x, y: ls.y, visibility: 0.95 };
  lm[12] = { x: rs.x, y: rs.y, visibility: 0.95 };
  if (lh) lm[23] = { x: lh.x, y: lh.y, visibility: 0.95 };
  if (rh) lm[24] = { x: rh.x, y: rh.y, visibility: 0.95 };
  lm[15] = lw ? { x: lw.x, y: lw.y, visibility: 0.95 } : { x: 0.5, y: 0.8, visibility: 0.1 };
  lm[16] = rw ? { x: rw.x, y: rw.y, visibility: 0.95 } : { x: 0.5, y: 0.8, visibility: 0.1 };
  return [lm];
}

function runTests() {
  console.log('--- Testing Config & Track Registry ---');
  assert(CONFIG.MODES.RHYTHM === 'RHYTHM', 'CONFIG.MODES registers RHYTHM mode');
  assert(RHYTHM_TRACKS.length === 3, '3 built-in synth tracks exist');
  assert(getTrackById('cyber_pulse').bpm === 128, 'getTrackById retrieves Cyber Pulse at 128 BPM');
  assert(getTrackById('nonexistent').id === 'neon_cruise', 'getTrackById falls back to default track');

  console.log('--- Testing Synth Master Clock (Headless Fallback) ---');
  const synth = new RhythmSynth();
  synth.start('neon_cruise');
  assert(synth.isPlaying === true, 'Synth enters playing state on start');
  assert(synth.getSongTime() === 0, 'Song time starts at 0');
  synth.advanceFallbackTime(0.5);
  assert(Math.abs(synth.getSongTime() - 0.5) < 0.0001, 'Fallback clock advances accurately in headless mode');
  const duration = synth.getTrackDuration(getTrackById('neon_cruise'));
  const expectedDur = (4 + 18 * 4) * (60 / 112);
  assert(Math.abs(duration - expectedDur) < 0.01, 'Track duration matches count-in + bars * beatsPerBar');
  synth.stop();
  assert(synth.isPlaying === false, 'Synth stops cleanly');

  console.log('--- Testing Timing Windows & Chart Generation ---');
  assert(evaluateTiming(0) === 'PERFECT', '0ms delta is PERFECT');
  assert(evaluateTiming(TIMING_WINDOWS.PERFECT_MS) === 'PERFECT', 'Exact PERFECT boundary passes');
  assert(evaluateTiming(TIMING_WINDOWS.GREAT_MS) === 'GREAT', 'Exact GREAT boundary passes');
  assert(evaluateTiming(TIMING_WINDOWS.GOOD_MS) === 'GOOD', 'Exact GOOD boundary passes');
  assert(evaluateTiming(TIMING_WINDOWS.GOOD_MS + 1) === 'MISS', 'Past GOOD window is MISS');

  for (const track of RHYTHM_TRACKS) {
    const chartA = generateChart(track.id, 4);
    const chartB = generateChart(track.id, 4);
    assert(chartA.events.length === chartB.events.length, `${track.id}: deterministic chart length`);
    assert(chartA.events.length >= 20, `${track.id}: chart contains sufficient scorable beat notes`);

    let sorted = true;
    for (let i = 1; i < chartA.events.length; i++) {
      if (chartA.events[i].targetTime < chartA.events[i - 1].targetTime) {
        sorted = false;
        break;
      }
    }
    assert(sorted, `${track.id}: chart events sorted chronologically`);

    const feverCount = chartA.events.filter(e => e.type === RhythmNoteType.FEVER_POSE).length;
    const tapSlashCount = chartA.events.filter(
      e => e.type === RhythmNoteType.TAP || e.type === RhythmNoteType.SLASH
    ).length;
    assert(feverCount >= 1 && feverCount <= 2, `${track.id}: minimized static pose count (1-2 fever poses)`);
    assert(tapSlashCount / chartA.events.length >= 0.78, `${track.id}: Type C majority rhythmic hand strikes`);
  }

  console.log('--- Testing Semicircle 5-Sector Hitbox Geometry & Beat Vibration ---');
  assert(RHYTHM_LANES.length === 5 && SEMICIRCLE_SECTOR_COUNT === 5, 'Rhythm arena uses 5 semicircular hitboxes');
  let gapsValid = true;
  for (let i = 0; i < RHYTHM_LANES.length - 1; i++) {
    const gap = RHYTHM_LANES[i + 1].startAngle - RHYTHM_LANES[i].endAngle;
    if (Math.abs(gap - SECTOR_GAP_RAD) > 0.0001 || gap <= 0) {
      gapsValid = false;
    }
  }
  assert(gapsValid, 'Explicit angular gaps separate all 5 semicircular hitboxes');
  assert(
    Math.abs(RHYTHM_LANES[2].midAngle - Math.PI * 1.5) < 0.0001,
    'Center sector #2 sits squarely overhead at 270 deg (1.5*PI)'
  );

  const vibOnBeat = computeBeatVibration(0.5, 120, false); // beat 1.0 exact
  const vibMidBeat = computeBeatVibration(0.75, 120, false); // beat 1.5 off-beat
  assert(vibOnBeat.beatImpulse > 0.95, 'Beat impulse peaks near 1.0 on exact beat');
  assert(vibMidBeat.beatImpulse < vibOnBeat.beatImpulse * 0.25, 'Beat impulse decays sharply between beats');
  assert(vibOnBeat.scalePulse > 1.01 && vibMidBeat.scalePulse < vibOnBeat.scalePulse, 'Scale pulse vibrates with base beats');

  console.log('--- Testing PoseRhythmJudge (Semicircle & Body Center) ---');
  const judge = new PoseRhythmJudge();
  const width = 1280;
  const height = 720;

  const anchorLeftBody = judge.computeBodyAnchor(
    makePose({ ls: { x: 0.65, y: 0.6 }, rs: { x: 0.75, y: 0.6 } }), // mirrored X ~ 0.30
    null,
    width,
    height,
    true,
    0
  );
  const anchorRightBody = judge.computeBodyAnchor(
    makePose({ ls: { x: 0.25, y: 0.6 }, rs: { x: 0.35, y: 0.6 } }), // mirrored X ~ 0.70
    null,
    width,
    height,
    true,
    0
  );
  assert(anchorLeftBody.cx < anchorRightBody.cx, 'Semicircle anchor tracks body horizontal center');

  // Verify shoulders (11,12) + in-frame hips (23,24) torso center calculation & clamping
  const anchorWithHips = judge.computeBodyAnchor(
    makePose({
      ls: { x: 0.45, y: 0.55 },
      rs: { x: 0.55, y: 0.55 },
      lh: { x: 0.45, y: 0.85 },
      rh: { x: 0.55, y: 0.85 }
    }),
    null,
    width,
    height,
    true,
    0
  );
  // Midpoint Y = (0.55 + 0.85)/2 = 0.70 -> 504px (inside clamped range)
  assert(
    Math.abs(anchorWithHips.cy - 0.7 * height) < 2,
    'Torso center tracks shoulder (11,12) and hip (23,24) midpoint accurately'
  );

  // Verify extrapolated out-of-frame hips (y > 1.2) do not pull anchor to bottom edge
  const anchorOobHips = judge.computeBodyAnchor(
    makePose({
      ls: { x: 0.45, y: 0.55 },
      rs: { x: 0.55, y: 0.55 },
      lh: { x: 0.45, y: 1.45 },
      rh: { x: 0.55, y: 1.45 }
    }),
    null,
    width,
    height,
    true,
    0
  );
  assert(
    anchorOobHips.cy < height - 50,
    'Out-of-frame extrapolated hips do not drag semicircle center off bottom edge'
  );

  // Verify strict viewport boundary clamping on extreme left/top and narrow viewport
  const extremeAnchor = judge.computeBodyAnchor(
    makePose({
      ls: { x: 0.99, y: 0.05 }, // mirrored X -> 0.01 (far left)
      rs: { x: 0.99, y: 0.05 },
      lh: { x: 0.99, y: 0.15 },
      rh: { x: 0.99, y: 0.15 }
    }),
    null,
    width,
    height,
    true,
    0
  );
  assert(
    extremeAnchor.cx - extremeAnchor.outerRadius >= 24 &&
      extremeAnchor.cx + extremeAnchor.outerRadius <= width - 24 &&
      extremeAnchor.cy - extremeAnchor.outerRadius >= 60 &&
      extremeAnchor.cy <= height - 24,
    'Semicircle arch stays strictly within top/left/right/bottom viewport bounds'
  );

  const narrowAnchor = judge.computeBodyAnchor(null, null, 500, 700, true, 0);
  assert(
    narrowAnchor.cx - narrowAnchor.outerRadius >= 20 &&
      narrowAnchor.cx + narrowAnchor.outerRadius <= 480,
    'Compact viewport shrinks outerRadius to prevent horizontal arch overflow'
  );

  // Verify smooth temporal EMA interpolation rather than instant snap
  const smoothedAnchor = judge.computeBodyAnchor(
    makePose({ ls: { x: 0.25, y: 0.6 }, rs: { x: 0.35, y: 0.6 } }),
    anchorLeftBody,
    width,
    height,
    true,
    0.016
  );
  assert(
    smoothedAnchor.cx > anchorLeftBody.cx && smoothedAnchor.cx < anchorRightBody.cx,
    'Body anchor interpolates smoothly over dt frame without snapping'
  );

  const testAnchor = judge.computeBodyAnchor(null, null, width, height, true, 0);
  const sector0 = {
    ...RHYTHM_LANES[0],
    cx: testAnchor.cx,
    cy: testAnchor.cy,
    innerRadius: testAnchor.innerRadius,
    outerRadius: testAnchor.outerRadius
  };
  const sector1 = {
    ...RHYTHM_LANES[1],
    cx: testAnchor.cx,
    cy: testAnchor.cy,
    innerRadius: testAnchor.innerRadius,
    outerRadius: testAnchor.outerRadius
  };

  // Doubled hitbox radial depth check at 1280x720
  assert(
    testAnchor.bandWidth >= 170,
    `Hitbox radial bandWidth doubled (>= 170px at 720p, got ${Math.round(testAnchor.bandWidth)}px)`
  );

  // Point cleanly inside sector 0 center
  const s0MidX = testAnchor.cx + Math.cos(sector0.midAngle) * testAnchor.midRadius;
  const s0MidY = testAnchor.cy + Math.sin(sector0.midAngle) * testAnchor.midRadius;
  const tapSegs = [{ p1: { x: s0MidX, y: s0MidY }, p2: { x: s0MidX, y: s0MidY }, hand: 'LEFT' }];
  assert(judge.checkTapHit(sector0, tapSegs).hit === true, 'TAP hit detected inside annular sector #0');

  // Point placed strictly inside the angular gap between sector 0 and sector 1
  const gapMidAngle = (sector0.endAngle + sector1.startAngle) * 0.5;
  const gapX = testAnchor.cx + Math.cos(gapMidAngle) * testAnchor.midRadius;
  const gapY = testAnchor.cy + Math.sin(gapMidAngle) * testAnchor.midRadius;
  const gapSegs = [{ p1: { x: gapX, y: gapY }, p2: { x: gapX, y: gapY }, hand: 'LEFT' }];
  assert(judge.checkTapHit(sector0, gapSegs).hit === false, 'Point in inter-sector gap misses sector #0');
  assert(judge.checkTapHit(sector1, gapSegs).hit === false, 'Point in inter-sector gap misses sector #1');

  // Directional slash check: swipe RIGHT through top crown sector #2
  const sector2 = {
    ...RHYTHM_LANES[2],
    cx: testAnchor.cx,
    cy: testAnchor.cy,
    innerRadius: testAnchor.innerRadius,
    outerRadius: testAnchor.outerRadius
  };
  const s2MidX = testAnchor.cx + Math.cos(sector2.midAngle) * testAnchor.midRadius;
  const s2MidY = testAnchor.cy + Math.sin(sector2.midAngle) * testAnchor.midRadius;
  const rightSwipeSegs = [
    { p1: { x: s2MidX - 40, y: s2MidY }, p2: { x: s2MidX + 40, y: s2MidY }, hand: 'RIGHT' }
  ];
  assert(
    judge.checkSlashHit(sector2, SlashDirection.RIGHT, rightSwipeSegs).hit === true,
    'SLASH hit accepted when hand swipes along target direction through sector'
  );
  assert(
    judge.checkSlashHit(sector2, SlashDirection.LEFT, rightSwipeSegs).hit === false,
    'SLASH hit rejected when hand swipes opposite direction'
  );

  // Also check webcam mirror extraction
  judge.reset();
  const extSegs = judge.extractHandSegments(
    makePose({ lw: { x: 0.2, y: 0.3 } }),
    width,
    height,
    true
  );
  assert(extSegs.length === 1 && Math.abs(extSegs[0].p2.x - 0.8 * width) < 1, 'Mirror transform maps raw wrist to canvas');

  // Dodge checks
  assert(judge.checkDodgeSafe(DodgeZone.LEFT, { x: 200, y: 200 }, 1000, 500).safe === false, 'DODGE LEFT detects hazard overlap');
  assert(judge.checkDodgeSafe(DodgeZone.LEFT, { x: 650, y: 200 }, 1000, 500).safe === true, 'DODGE LEFT clears when head moves right');
  assert(judge.checkDodgeSafe(DodgeZone.TOP, { x: 500, y: 150 }, 1000, 500).safe === false, 'DODGE TOP detects standing high');
  assert(judge.checkDodgeSafe(DodgeZone.TOP, { x: 500, y: 300 }, 1000, 500).safe === true, 'DODGE TOP clears when ducking');
  assert(judge.checkDodgeSafe(DodgeZone.RIGHT, null, 1000, 500).safe === true, 'DODGE fails safe when head pose absent');

  // Manse Fever Pose checks
  const mansePose = makePose({
    nose: { x: 0.5, y: 0.35 },
    lw: { x: 0.32, y: 0.15 },
    rw: { x: 0.68, y: 0.15 }
  });
  const lowHandsPose = makePose({
    nose: { x: 0.5, y: 0.35 },
    lw: { x: 0.32, y: 0.65 },
    rw: { x: 0.68, y: 0.65 }
  });
  assert(judge.checkMansePose(mansePose) === true, 'Manse pose recognized when both wrists above nose');
  assert(judge.checkMansePose(lowHandsPose) === false, 'Manse pose rejected when wrists below nose');

  console.log('--- Testing RhythmEngine Gameplay Flow ---');
  let reportedScore = 0;
  let reportedLives = 5;
  let gameOverTriggered = false;

  const mockSound = { isMuted: true, init() {}, resume() {} };
  const engine = new RhythmEngine(1280, 720, null, mockSound);
  engine.onScore = (s) => { reportedScore = s; };
  engine.onLivesChanged = (l) => { reportedLives = l; };
  engine.onGameOver = () => { gameOverTriggered = true; };

  engine.start('neon_cruise');
  const firstTap = engine.events.find(e => e.type === RhythmNoteType.TAP);
  assert(!!firstTap, 'Chart starts with a TAP note');

  // Step time smoothly in 0.05s frames up to firstTap.targetTime
  const tapTime = firstTap.targetTime;
  const tapLane = firstTap.lane;
  while (engine.synth.getSongTime() + 0.05 < tapTime) {
    engine.update(0.05, 0, null, null, []);
  }
  const tapSector = engine.getLaneCenter(tapLane);
  engine.synth.fallbackElapsed = tapTime;
  engine.update(0.01, 0, null, null, [
    { p1: { x: tapSector.x, y: tapSector.y }, p2: { x: tapSector.x, y: tapSector.y }, bladeName: 'TEST' }
  ]);

  assert(firstTap.hit === true && firstTap.grade === 'PERFECT', 'TAP note hits as PERFECT on target beat');
  assert(engine.score > 0 && engine.score === reportedScore, 'Score increments and invokes onScore');
  assert(engine.combo === 1 && engine.stats.PERFECT === 1, 'Combo & PERFECT stats increment');

  // Test FEVER_POSE multiplier activation (mark earlier non-fever notes hit so lives stay intact)
  const feverEv = engine.events.find(e => e.type === RhythmNoteType.FEVER_POSE);
  assert(!!feverEv, 'Track includes FEVER_POSE chorus event');
  engine.events.forEach(e => {
    if (e.targetTime < feverEv.windowStart && !e.hit) {
      e.hit = true;
    }
  });
  engine.synth.fallbackElapsed = (feverEv.windowStart + feverEv.windowEnd) * 0.5;
  engine.update(0.01, 0, null, mansePose, []);
  assert(feverEv.hit === true && engine.feverTimer > 0, 'FEVER_POSE activates feverTimer');

  // Test MISS penalty & GAMEOVER after losing remaining lives
  engine.lives = 1;
  const pendingTap = engine.events.find(e => !e.hit && !e.missed && e.type === RhythmNoteType.TAP);
  if (pendingTap) {
    engine.synth.fallbackElapsed = pendingTap.targetTime + 0.5;
    engine.update(0.01, 0, null, null, []);
  }
  assert(gameOverTriggered === true && engine.state === 'GAMEOVER', 'Missing at 1 life triggers GAMEOVER');

  // Test Track Clear & Auto-Advance to next track
  const engine2 = new RhythmEngine(1280, 720, null, mockSound);
  engine2.start('neon_cruise');
  engine2.events.forEach(e => {
    if (e.type === RhythmNoteType.TAP || e.type === RhythmNoteType.SLASH) {
      e.hit = true;
      e.grade = 'PERFECT';
      engine2.stats.PERFECT++;
    } else {
      e.hit = true;
    }
  });
  engine2.score = 1500;
  engine2.synth.fallbackElapsed = engine2.synth.getTrackDuration() + 0.7;
  engine2.update(0.01, 0, null, null, []);
  assert(engine2.state === 'TRACK_CLEAR', 'Completing song enters TRACK_CLEAR state');
  assert(engine2.getRank() === 'S' && engine2.getAccuracy() === 100, '100% accuracy earns Rank S');

  for (let i = 0; i < 40; i++) {
    engine2.update(0.1, 0, null, null, []);
  }
  assert(
    engine2.state === 'PLAYING' && engine2.selectedTrackId === 'cyber_pulse' && engine2.score === 1500,
    'Track Clear auto-advances to Cyber Pulse while preserving score'
  );

  console.log(`\nRhythm Tests Complete: ${passed}/${total} passed`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
