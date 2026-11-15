import { Starfield } from '../js/game/galaga/starfield.js';
import { Bullet, AlienMissile, BulletManager } from '../js/game/galaga/bullet.js';
import { soundManager } from '../js/audio/soundManager.js';

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

  console.log('\n--- Testing Bullets & Sound ---');
  const bm = new BulletManager();

  // Test single player bullet
  bm.firePlayerBullet(400, 600, false);
  assert(bm.playerBullets.length === 1, 'Single fire creates 1 bullet');
  assert(bm.playerBullets[0].x === 400 && bm.playerBullets[0].y === 600, 'Bullet spawns at correct coordinate');

  // Test bullet movement
  bm.update(0.1, 800, 600);
  assert(bm.playerBullets[0].y < 600, 'Player bullet moves upwards');

  // Test bullet culling off top screen
  bm.playerBullets[0].y = -30;
  bm.update(0.01, 800, 600);
  assert(bm.playerBullets.length === 0, 'Offscreen bullet is culled');

  // Test dual player bullets
  bm.firePlayerBullet(400, 600, true);
  assert(bm.playerBullets.length === 2, 'Dual fire creates 2 bullets in parallel');
  assert(bm.playerBullets[0].x < 400 && bm.playerBullets[1].x > 400, 'Dual bullets are spaced left and right of center');

  // Test alien missile targeting
  bm.fireAlienMissile(300, 100, 300, 500);
  assert(bm.alienMissiles.length === 1, 'Alien missile created');
  assert(bm.alienMissiles[0].vy > 0, 'Alien missile moves downward toward target');

  // Test soundManager Galaga methods
  assert(typeof soundManager.playGalagaShoot === 'function', 'soundManager.playGalagaShoot exists');
  assert(typeof soundManager.playGalagaExplosion === 'function', 'soundManager.playGalagaExplosion exists');
  assert(typeof soundManager.playGalagaTractor === 'function', 'soundManager.playGalagaTractor exists');
  assert(typeof soundManager.playGalagaDock === 'function', 'soundManager.playGalagaDock exists');

  console.log(`\nGalaga Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
