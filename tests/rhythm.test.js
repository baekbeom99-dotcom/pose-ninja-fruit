import { CONFIG } from '../js/config.js';
import { RHYTHM_TRACKS, RhythmSynth, getTrackById } from '../js/game/rhythm/rhythmSynth.js';
import {
  RHYTHM_LANES,
  RhythmNoteType,
  SlashDirection,
  DodgeZone,
  TIMING_WINDOWS,
  evaluateTiming,
  generateChart
} from '../js/game/rhythm/chartGenerator.js';
import { PoseRhythmJudge } from '../js/game/rhythm/poseRhythmJudge.js';
import { RhythmEngine } from '../js/game/rhythm/rhythmEngine.js';

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

function makePose({ nose = { x: 0.5, y: 0.3 }, lw = null, rw = null } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  lm[0] = { x: nose.x, y: nose.y, visibility: 0.95 };
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

  console.log('--- Testing PoseRhythmJudge ---');
  const judge = new PoseRhythmJudge();
  const width = 1000;
  const height = 500;
  const lane0 = {
    x: RHYTHM_LANES[0].nx * width,
    y: RHYTHM_LANES[0].ny * height,
    radius: 50
  };
  // Unmirrored wrist placed at mirrored screen coordinate -> (1 - nx) in raw camera coordinates
  const rawXForLane0 = 1 - RHYTHM_LANES[0].nx;
  const rawYForLane0 = RHYTHM_LANES[0].ny;
  const segs1 = judge.extractHandSegments(
    makePose({ lw: { x: rawXForLane0, y: rawYForLane0 } }),
    width,
    height,
    true
  );
  assert(segs1.length === 1, 'Extracts visible left wrist segment');
  assert(
    Math.abs(segs1[0].p2.x - lane0.x) < 1 && Math.abs(segs1[0].p2.y - lane0.y) < 1,
    'Mirror transform maps wrist accurately onto canvas lane'
  );
  assert(judge.checkTapHit(lane0, segs1).hit === true, 'TAP hit detected inside target circle');

  // Directional slash check: swipe RIGHT through lane0
  judge.reset();
  judge.extractHandSegments(makePose({ lw: { x: rawXForLane0 + 0.08, y: rawYForLane0 } }), width, height, true);
  // Decreasing raw X increases mirrored canvas X (swiping RIGHT on screen)
  const rightSwipeSegs = judge.extractHandSegments(
    makePose({ lw: { x: rawXForLane0 - 0.08, y: rawYForLane0 } }),
    width,
    height,
    true
  );
  assert(
    judge.checkSlashHit(lane0, SlashDirection.RIGHT, rightSwipeSegs).hit === true,
    'SLASH hit accepted when hand swipes along target direction'
  );
  assert(
    judge.checkSlashHit(lane0, SlashDirection.LEFT, rightSwipeSegs).hit === false,
    'SLASH hit rejected when hand swipes opposite direction'
  );

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
  const tapPose = makePose({
    lw: { x: 1 - tapLane.nx, y: tapLane.ny }
  });
  const tapCenter = engine.getLaneCenter(tapLane);
  while (engine.synth.getSongTime() + 0.05 < tapTime) {
    engine.update(0.05, 0, null, null, []);
  }
  engine.synth.fallbackElapsed = tapTime;
  engine.update(0.01, 0, null, tapPose, [
    { p1: { x: tapCenter.x, y: tapCenter.y }, p2: { x: tapCenter.x, y: tapCenter.y }, bladeName: 'TEST' }
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
