import { Fish, HalfFish } from '../js/game/fish.js';
import { CONFIG } from '../js/config.js';

function runTests() {
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

  // Test 1: Sinuous Sine Wave updates coordinates
  {
    const cfg = CONFIG.FISHES.NEON_GOLDFISH;
    const fish = new Fish(cfg, 0, 300, 'SINE_WAVE', { vx: 200, amplitude: 80, frequency: 2.0 });
    const initialY = fish.y;
    fish.update(0.25);

    assert(fish.x > 0, 'Fish moves forward horizontally in sine wave');
    assert(Math.abs(fish.y - initialY) > 0.01, 'Fish undulates vertically along sine wave');
  }

  // Test 2: Lissajous Figure-8 moves in bounds
  {
    const cfg = CONFIG.FISHES.CYBER_CLOWNFISH;
    const fish = new Fish(cfg, 600, 350, 'LISSAJOUS_8', { centerX: 600, centerY: 350, amplitude: 200, frequency: 1.5 });
    fish.update(0.5);

    assert(Math.abs(fish.x - 600) <= 300, 'Fish stays within horizontal Lissajous bounds');
    assert(Math.abs(fish.y - 350) <= 200, 'Fish stays within vertical Lissajous bounds');
  }

  // Test 3: Slicing creates two HalfFish
  {
    const cfg = CONFIG.FISHES.COSMIC_JELLYFISH;
    const fish = new Fish(cfg, 400, 300);
    const halves = fish.slice(0, { x: 0, y: 1 });

    assert(fish.isDead === true, 'Original fish marked dead after slice');
    assert(halves.length === 2, 'Slice produces exactly 2 halves');
    assert(halves[0].isLeftHalf === true, 'First half is left');
    assert(halves[1].isLeftHalf === false, 'Second half is right');
  }

  console.log(`\nFish Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
