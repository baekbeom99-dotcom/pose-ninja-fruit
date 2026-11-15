import { Starfield } from '../js/game/galaga/starfield.js';

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

function runTests() {
  console.log('--- Testing Starfield ---');
  const sf = new Starfield(800, 600, 60);

  assert(sf.stars.length === 60, 'Starfield initializes correct star count');
  assert(sf.stars.every(s => s.x >= 0 && s.x <= 800), 'All stars are within horizontal bounds');
  assert(sf.stars.every(s => s.y >= 0 && s.y <= 600), 'All stars are within vertical bounds');

  // Test star motion
  const initialY = sf.stars[0].y;
  const starSpeed = sf.stars[0].speed;
  sf.update(0.1, 1.0);
  const expectedY = initialY + starSpeed * 0.1;
  assert(Math.abs(sf.stars[0].y - expectedY) < 0.001 || sf.stars[0].y === 0, 'Star moves downward proportional to speed * dt');

  // Test star wrapping
  sf.stars[0].y = 599.9;
  sf.stars[0].speed = 100;
  sf.update(0.1, 1.0);
  assert(sf.stars[0].y < 50, 'Star wraps to top when crossing bottom boundary');

  // Test warp speed
  sf.setWarp(true);
  assert(sf.warpMultiplier === 6, 'Warp multiplier activates at 6x');
  sf.setWarp(false);
  assert(sf.warpMultiplier === 1, 'Warp multiplier resets to 1x');

  console.log(`\nGalaga Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
