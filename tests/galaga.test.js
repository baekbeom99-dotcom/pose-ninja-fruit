import { Starfield } from '../js/game/galaga/starfield.js';
import { Bullet, AlienMissile, BulletManager } from '../js/game/galaga/bullet.js';
import { Alien, AlienType, AlienFormation } from '../js/game/galaga/alien.js';
import { Fighter } from '../js/game/galaga/fighter.js';
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

  console.log('\n--- Testing Aliens & Formation ---');
  // Test Zako
  const zako = new Alien(AlienType.ZAKO, 2, 3, 200, 150);
  assert(zako.hp === 1, 'Zako has 1 HP');
  assert(zako.hit() === 100, 'Zako hit in formation yields 100 pts');
  assert(zako.isDead === true, 'Zako marked dead after hit');

  // Test diving Zako points
  const divingZako = new Alien(AlienType.ZAKO, 2, 3, 200, 150);
  divingZako.isDiving = true;
  assert(divingZako.hit() === 200, 'Diving Zako yields 200 pts');

  // Test Goei
  const goei = new Alien(AlienType.GOEI, 1, 2, 180, 120);
  assert(goei.hit() === 160, 'Goei hit yields 160 pts');

  // Test Boss Galaga 2-hit requirement
  const boss = new Alien(AlienType.BOSS_GALAGA, 0, 1, 250, 80);
  assert(boss.hp === 2, 'Boss Galaga has 2 HP');
  const firstHitPts = boss.hit();
  assert(firstHitPts === 0, 'First hit on Boss Galaga does not kill it');
  assert(boss.hp === 1 && boss.isInjured === true, 'Boss Galaga is injured after 1st hit');
  assert(boss.hit() === 200, 'Second hit on Boss Galaga in formation kills it and yields 200 pts');
  assert(boss.isDead === true, 'Boss Galaga marked dead after 2 hits');

  // Test Formation
  const formation = new AlienFormation(800, 600);
  assert(formation.aliens.length > 20, 'Formation spawns aliens grid');
  assert(formation.getAliveCount() === formation.aliens.length, 'All spawned aliens initially alive');

  // Test formation update and breathing
  formation.update(0.1, 800, 600);
  assert(formation.formationTime > 0, 'Formation time advances');

  console.log('\n--- Testing Fighter Ship ---');
  const fighter = new Fighter(400, 520);
  assert(fighter.x === 400 && fighter.y === 520, 'Fighter initialized at designated position');
  assert(fighter.isDual === false, 'Fighter starts in single-ship mode');

  // Test sudden head jump smoothing
  const suddenHeadX = 700;
  fighter.update(0.016, suddenHeadX, 800, 600, null, null);
  assert(fighter.x > 400 && fighter.x < 700, 'Fighter moves smoothly towards target without instantly teleporting');

  // Test screen edge clamping
  const extremeLeftHeadX = -100;
  for (let i = 0; i < 40; i++) {
    fighter.update(0.016, extremeLeftHeadX, 800, 600, null, null);
  }
  assert(fighter.x >= fighter.width / 2, 'Fighter clamped to left canvas boundary');

  const extremeRightHeadX = 1000;
  for (let i = 0; i < 40; i++) {
    fighter.update(0.016, extremeRightHeadX, 800, 600, null, null);
  }
  assert(fighter.x <= 800 - fighter.width / 2, 'Fighter clamped to right canvas boundary');

  // Test auto-fire
  const testBm = new BulletManager();
  fighter.update(0.2, 400, 800, 600, testBm, null);
  assert(testBm.playerBullets.length >= 1, 'Fighter auto-fires bullets');

  // Test dual fighter auto-fire produces 2 bullets per shot
  fighter.isDual = true;
  testBm.clear();
  fighter.update(0.2, 400, 800, 600, testBm, null);
  assert(testBm.playerBullets.length === 2, 'Dual fighter auto-fires 2 parallel bullets');

  console.log(`\nGalaga Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
