import { Starfield } from '../js/game/galaga/starfield.js';
import { Bullet, AlienMissile, BulletManager } from '../js/game/galaga/bullet.js';
import { Alien, AlienType, AlienFormation } from '../js/game/galaga/alien.js';
import { Fighter } from '../js/game/galaga/fighter.js';
import { TractorBeam } from '../js/game/galaga/tractorBeam.js';
import { GalagaEngine } from '../js/game/galaga/galagaEngine.js';
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
  assert(typeof soundManager.playGalagaIntro === 'function', 'soundManager.playGalagaIntro exists');
  assert(typeof soundManager.startGalagaBGM === 'function', 'soundManager.startGalagaBGM exists');
  assert(typeof soundManager.stopGalagaBGM === 'function', 'soundManager.stopGalagaBGM exists');

  // Test Galaga BGM toggle
  soundManager.stopGalagaBGM();
  assert(soundManager.galagaBgmActive === false, 'Galaga BGM stops cleanly');

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

  console.log('\n--- Testing Tractor Beam & Dual Fighter ---');
  const tb = new TractorBeam();
  assert(tb.isActive === false, 'Tractor beam initially inactive');

  // Activate tractor beam from boss
  const bossTest = new Alien(AlienType.BOSS_GALAGA, 0, 1, 400, 250);
  tb.activate(bossTest);
  assert(tb.isActive === true, 'Tractor beam activated');

  // Test beam cone collision check
  const insideFighter = new Fighter(400, 500);
  assert(tb.isFighterInside(insideFighter) === true, 'Fighter directly below boss is inside beam cone');

  const distantFighter = new Fighter(100, 500);
  assert(tb.isFighterInside(distantFighter) === false, 'Distant fighter outside cone');

  // Test exposure requirement (1.0 second) & movement behavior
  const movingFighter = new Fighter(400, 500);
  const step1 = tb.updateExposure(0.4, movingFighter);
  assert(step1.isExposed === true && step1.triggerCapture === false, '0.4s exposure accumulating');

  // Move within beam (400 -> 420)
  movingFighter.x = 420;
  const step2 = tb.updateExposure(0.4, movingFighter);
  assert(step2.isExposed === true && step2.triggerCapture === false, 'Moving within beam does not break capture progress');
  assert(Math.abs(step2.timer - 0.8) < 0.001, 'Timer accumulated to 0.8s while moving inside beam');

  // Move outside beam before 1.0s (420 -> 100) -> timer resets immediately to 0
  movingFighter.x = 100;
  const exitStep = tb.updateExposure(0.1, movingFighter);
  assert(exitStep.isExposed === false, 'Exited beam before 1.0s');
  assert(exitStep.timer === 0, 'Exiting beam within 1.0s resets timer to 0 immediately');

  // Re-enter beam and hold for >= 1.0s
  movingFighter.x = 400;
  tb.updateExposure(0.5, movingFighter);
  const captureStep = tb.updateExposure(0.6, movingFighter);
  assert(captureStep.triggerCapture === true, '1.1s exposure (>=1.0s) triggers capture');

  // Once captured / pulling, escape is impossible even if moving outside coordinates
  tb.startCapture(movingFighter);
  movingFighter.x = 50; // Try to escape
  const lockedStep = tb.updateExposure(0.1, movingFighter);
  assert(lockedStep.isExposed === true && lockedStep.progress === 1.0, 'Capture locked after 1.0s');

  // Test boss descent before tractor beam
  const descentBoss = new Alien(AlienType.BOSS_GALAGA, 0, 0, 400, 80);
  descentBoss.startTractorDescent(250);
  assert(descentBoss.isTractorRun === true, 'Boss starts tractor descent run');
  assert(descentBoss.tractorState === 'DESCENDING', 'Boss state is DESCENDING');
  descentBoss.update(1.5, 400, 80, 1.0, null, 400, 550);
  assert(descentBoss.y > 80, 'Boss moves downward towards target');
  assert(descentBoss.angle > 0, 'Boss rotates 180 degrees during tractor launch descent');
  descentBoss.update(1.0, 400, 80, 1.0, null, 400, 550);
  assert(descentBoss.tractorState === 'BEAMING', 'Boss enters BEAMING state upon reaching target Y');
  assert(Math.abs(descentBoss.angle - Math.PI) < 0.2, 'Boss rotated ~180 degrees facing downward while beaming');

  // Test capture pull
  tb.startCapture(insideFighter);
  assert(insideFighter.isCaptured === true, 'Fighter marked as captured');
  tb.update(0.1, insideFighter, null);
  assert(insideFighter.y < 500, 'Captured fighter pulled upwards toward boss');

  // Test rescue and dual docking
  tb.capturedShip = { x: 400, y: 300, isRescued: false };
  tb.releaseCapturedShip();
  assert(tb.capturedShip.isRescued === true, 'Captured ship marked rescued upon boss destruction');

  const rescuerFighter = new Fighter(400, 520);
  tb.updateRescue(0.1, rescuerFighter);
  tb.capturedShip.y = rescuerFighter.y; // Simulate reaching dock level
  tb.updateRescue(0.01, rescuerFighter);
  assert(rescuerFighter.isDual === true, 'Fighter transforms into Dual Fighter on dock completion');

  // Test tractor beam deactivates immediately when beaming boss dies
  const beamBoss = new Alien(AlienType.BOSS_GALAGA, 0, 0, 400, 300);
  tb.activate(beamBoss);
  assert(tb.isActive === true, 'Tractor beam active for test boss');
  beamBoss.isDead = true;
  tb.update(0.016, insideFighter);
  assert(tb.isActive === false, 'Tractor beam deactivates immediately when beaming boss dies');

  // Test stage difficulty scaling
  const fStage1 = new AlienFormation(800, 600, 1);
  const fStage3 = new AlienFormation(800, 600, 3);
  assert(fStage3.diveInterval < fStage1.diveInterval, 'Higher stage has shorter diveInterval (faster attack pace)');
  assert(fStage3.stage === 3, 'AlienFormation tracks stage number');
  assert(fStage3.aliens[0].stage === 3, 'Aliens track stage number');

  console.log('\n--- Testing Galaga Engine & Collision ---');
  const ge = new GalagaEngine(800, 600);
  assert(ge.score === 0, 'Initial score is 0');
  assert(ge.lives === 5, 'Initial lives set to 5');
  assert(ge.stage === 1, 'Initial stage is 1');
  assert(ge.formation.aliens.length >= 50, 'Formation spawns 50+ aliens grid');

  // Test player bullet vs alien collision
  const targetAlien = ge.formation.aliens[0];
  targetAlien.x = 400;
  targetAlien.y = 200;
  ge.bulletManager.firePlayerBullet(400, 205, false);

  ge.checkCollisions();
  assert(targetAlien.hp === targetAlien.maxHp - 1, 'Player bullet damages target alien');
  assert(ge.bulletManager.playerBullets.length === 0, 'Bullet consumed on hit');

  // Test player hit by alien missile
  ge.fighter.x = 400;
  ge.fighter.y = 520;
  ge.fighter.isInvulnerable = false;
  ge.bulletManager.alienMissiles.push(new AlienMissile(400, 518, 400, 520));

  ge.checkCollisions();
  assert(ge.lives === 4, 'Player loses 1 life when hit by alien missile (5 -> 4)');
  assert(ge.fighter.isInvulnerable === true, 'Player gains temporary invulnerability on hit');

  // Test Game Over condition
  ge.lives = 1;
  ge.fighter.isInvulnerable = false;
  let gameOverCalled = false;
  ge.onGameOver = () => { gameOverCalled = true; };
  ge.bulletManager.alienMissiles.push(new AlienMissile(400, 518, 400, 520));

  ge.checkCollisions();
  assert(ge.lives === 0, 'Player lives drop to 0 on fatal hit');
  assert(gameOverCalled === true, 'onGameOver callback triggered when lives reach 0');

  console.log(`\nGalaga Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
