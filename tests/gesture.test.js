import { GestureDetector, CONSONANT_POSES } from '../js/game/gestureDetector.js';

function runTests() {
  const detector = new GestureDetector();
  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
    }
  }

  // Mock Landmarks base template
  function createMockLandmarks({ lwY = 0.5, rwY = 0.5, lwX = 0.4, rwX = 0.6, headY = 0.25 }) {
    const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    lm[0] = { x: 0.5, y: headY, z: 0 }; // Nose
    lm[11] = { x: 0.4, y: 0.35, z: 0 }; // L Shoulder
    lm[12] = { x: 0.6, y: 0.35, z: 0 }; // R Shoulder
    lm[15] = { x: 1 - lwX, y: lwY, z: 0 }; // L Wrist (pre-mirrored)
    lm[16] = { x: 1 - rwX, y: rwY, z: 0 }; // R Wrist (pre-mirrored)
    return lm;
  }

  // Test 1: 'ㅅ' (SIOT) - Both hands high and close above head
  {
    const lm = createMockLandmarks({ lwY: 0.1, rwY: 0.1, lwX: 0.48, rwX: 0.52, headY: 0.25 });
    const result = detector.evaluate('SIOT', lm, 0.1, true);
    assert(result.matched === true, 'SIOT matches hands above head and close');
  }

  // Test 2: 'ㅈ' (JIEUT) - Both hands high and wide (V-pose)
  {
    const lm = createMockLandmarks({ lwY: 0.1, rwY: 0.1, lwX: 0.15, rwX: 0.85, headY: 0.25 });
    const result = detector.evaluate('JIEUT', lm, 0.1, true);
    assert(result.matched === true, 'JIEUT matches hands high and wide V');
  }

  // Test 3: Hold progress accumulation
  {
    detector.reset();
    const lm = createMockLandmarks({ lwY: 0.1, rwY: 0.1, lwX: 0.15, rwX: 0.85, headY: 0.25 });
    const r1 = detector.evaluate('JIEUT', lm, 0.25, true);
    assert(r1.matched === true && !r1.triggered, 'Progress accumulating at 0.25s');
    const r2 = detector.evaluate('JIEUT', lm, 0.30, true);
    assert(r2.triggered === true, 'Triggered after reaching required hold time (0.50s)');
  }

  // Test 4: False positive check - hands at waist
  {
    detector.reset();
    const lm = createMockLandmarks({ lwY: 0.7, rwY: 0.7, lwX: 0.4, rwX: 0.6, headY: 0.25 });
    const result = detector.evaluate('SIOT', lm, 0.1, true);
    assert(result.matched === false, 'Hands at waist do not trigger SIOT');
  }

  // Test 5: Doctor Strange PORTAL gesture (Left guard, Right wide circular open)
  {
    detector.reset();
    const lm = createMockLandmarks({ lwY: 0.35, rwY: 0.30, lwX: 0.42, rwX: 0.88, headY: 0.25 });
    const result = detector.evaluate('PORTAL', lm, 0.1, true);
    assert(result.matched === true, 'PORTAL matches Doctor Strange sling-ring guard and circle open');
  }

  console.log(`\nGesture Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
