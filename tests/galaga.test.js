import { Starfield } from '../js/game/galaga/starfield.js';
import { Bullet, AlienMissile, BulletManager } from '../js/game/galaga/bullet.js';
import { Alien, AlienType, AlienFormation } from '../js/game/galaga/alien.js';
import { Fighter } from '../js/game/galaga/fighter.js';
import { TractorBeam } from '../js/game/galaga/tractorBeam.js';
import { Asteroid } from '../js/game/galaga/asteroid.js';
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

  console.log('\n--- Testing Manse Gesture & EMP Shockwave ---');
  const geEmp = new GalagaEngine(800, 600);
  assert(geEmp.empStock === 2, 'EMP stocks initialized to 2');

  // Spawn 5 alien missiles
  for (let i = 0; i < 5; i++) {
    geEmp.bulletManager.fireAlienMissile(100 * i, 100, 100 * i, 500);
  }
  assert(geEmp.bulletManager.alienMissiles.length === 5, '5 alien missiles spawned on screen');

  // Trigger Galaga Hyper Cannon & EMP shockwave
  const empFired = geEmp.triggerEmpShockwave();
  assert(empFired === true, 'Galaga special triggered successfully');
  assert(geEmp.empStock === 1, 'Special stock decremented to 1');
  assert(geEmp.bulletManager.alienMissiles.length === 0, 'All alien missiles destroyed by blast');
  assert(geEmp.bulletManager.playerBullets.length === 9, 'Hyper Cannon fires 9 piercing Wingman & fan plasma bolts');
  assert(geEmp.wingmanBeams.length === 3, 'Twin Wingman + center orbital laser beams spawned');
  assert(geEmp.shockwaves.length === 1, 'Expanding shockwave VFX created');

  // Second EMP trigger
  geEmp.triggerEmpShockwave();
  assert(geEmp.empStock === 0, 'Second EMP consumed, stock at 0');

  // Third trigger fails due to depleted stock
  const empFailed = geEmp.triggerEmpShockwave();
  assert(empFailed === false, 'EMP cannot trigger when stock is 0');

  // Test Manse gesture detection
  const dummyNose = { x: 0.5, y: 0.35 };
  const dummyLSh = { x: 0.42, y: 0.45 };
  const dummyRSh = { x: 0.58, y: 0.45 };
  // Both wrists held high above head and spaced apart
  const manseLW = { x: 0.35, y: 0.15 };
  const manseRW = { x: 0.65, y: 0.15 };
  const dummyPose = [dummyNose, null, null, null, null, null, null, null, null, null, null, dummyLSh, dummyRSh, null, null, manseLW, manseRW];
  assert(geEmp.isMansePose(dummyPose) === true, 'Manse gesture recognized when both wrists are high above shoulders and nose');

  // Hands down posture should not match
  const handsDownLW = { x: 0.40, y: 0.65 };
  const handsDownRW = { x: 0.60, y: 0.65 };
  const handsDownPose = [dummyNose, null, null, null, null, null, null, null, null, null, null, dummyLSh, dummyRSh, null, null, handsDownLW, handsDownRW];
  assert(geEmp.isMansePose(handsDownPose) === false, 'Hands down pose does not trigger Manse gesture');

  console.log('\n--- Testing Boss Energy Shield (Stage 4+) ---');
  const stage1Boss = new Alien(AlienType.BOSS_GALAGA, 0, 0, 400, 100, 1);
  assert(stage1Boss.isShielded === false, 'Stage 1 Boss Galaga has no shield');

  const stage4Boss = new Alien(AlienType.BOSS_GALAGA, 0, 0, 400, 100, 4);
  assert(stage4Boss.isShielded === true, 'Stage 4 Boss Galaga spawns with energy shield');
  assert(stage4Boss.hp === 2, 'Boss starts with 2 HP');

  // First hit breaks shield without damaging HP
  const shieldPts = stage4Boss.hit();
  assert(shieldPts === 50, 'Breaking shield awards 50 pts');
  assert(stage4Boss.isShielded === false, 'Shield is broken after 1st hit');
  assert(stage4Boss.hp === 2, 'Boss HP is intact after shield absorbs hit');
  assert(stage4Boss.isDead === false, 'Boss remains alive');

  // Second hit injures boss
  stage4Boss.hit();
  assert(stage4Boss.hp === 1, 'Boss HP drops to 1 on second hit');
  assert(stage4Boss.isInjured === true, 'Boss marked injured');

  // Third hit destroys boss
  const bossKillPts = stage4Boss.hit();
  assert(bossKillPts === 200, 'Destroying Boss awards 200 pts');
  assert(stage4Boss.isDead === true, 'Boss marked dead after 3 total hits');

  console.log('\n--- Testing Splitting Asteroids & PowerUps ---');
  const geAst = new GalagaEngine(800, 600);
  geAst.stage = 2;
  geAst._initStage();
  assert(geAst.empStock === 2, 'EMP stock refreshed to 2 on stage init');

  // Add a large asteroid
  const largeAst = new Asteroid(400, 200, 'LARGE');
  geAst.asteroids.push(largeAst);
  assert(geAst.asteroids.length === 1, 'Large asteroid added');

  // Fire bullet at asteroid
  geAst.bulletManager.playerBullets.push(new Bullet(400, 205));
  geAst.checkCollisions();
  assert(largeAst.isDead === true, 'Large asteroid destroyed on hit');
  assert(geAst.asteroids.length === 2, 'Large asteroid split into 2 small asteroid fragments');
  assert(geAst.asteroids.every(a => a.size === 'SMALL'), 'Both fragments are SMALL size');

  // Test PowerUp collection & Shield protection
  geAst.bulletManager.spawnPowerUp(400, 520, 'SHIELD');
  geAst.fighter.x = 400;
  geAst.fighter.y = 520;
  geAst.checkCollisions();
  assert(geAst.fighter.hasShield === true, 'Fighter collected SHIELD powerup and activated barrier');

  // Lethal asteroid collision absorbed by shield!
  geAst.asteroids.push(new Asteroid(400, 520, 'SMALL'));
  geAst.fighter.isInvulnerable = false;
  const initialLives = geAst.lives;
  geAst.checkCollisions();
  assert(geAst.fighter.hasShield === false, 'Shield popped and absorbed fatal collision');
  assert(geAst.lives === initialLives, 'Player lives untouched thanks to shield barrier');
  assert(geAst.fighter.isInvulnerable === true, 'Player gains invulnerability after shield breaks');

  console.log('\n--- Testing Challenging Stage (Bonus Round) ---');
  const geChal = new GalagaEngine(800, 600);
  geChal.stage = 3; // Every 3rd stage is a Challenging Stage!
  geChal._initStage();
  assert(geChal.isChallengingStage === true, 'Stage 3 initiates Challenging Stage mode');
  assert(geChal.challengingTotal === 40, 'Challenging Stage features 40 total bonus aliens');
  assert(geChal.challengingAliens.length === 40, '5 waves of 8 aliens = 40 bonus aliens queued');
  assert(geChal.challengingHits === 0, 'Challenging hits initialized to 0');

  // Shoot first bonus alien
  const firstAlien = geChal.challengingAliens[0];
  firstAlien.time = 1.0; // Simulate flight active
  firstAlien.x = 400;
  firstAlien.y = 200;
  geChal.bulletManager.playerBullets.push(new Bullet(400, 205));
  geChal.checkCollisions();
  assert(firstAlien.isDead === true, 'Bonus alien shot down');
  assert(geChal.challengingHits === 1, 'Challenging hits incremented');

  console.log('\n--- Testing Stage Difficulty Curve & Stage 7+ New Enemy (PHANTOM) ---');
  const f1 = new AlienFormation(800, 600, 1);
  const f2 = new AlienFormation(800, 600, 2);
  const f4 = new AlienFormation(800, 600, 4);
  const f6 = new AlienFormation(800, 600, 6);
  const f7 = new AlienFormation(800, 600, 7);

  assert(f1.diveInterval >= 3.2, 'Stage 1 starts with calm original Galaga dive interval (>= 3.2s)');
  assert(f1.formationFireInterval === Infinity, 'Stage 1 has NO formation sniper missiles (matches original Galaga)');
  assert(f2.formationFireInterval < Infinity && f2.diveInterval < f1.diveInterval, 'Stage 2 unlocks formation fire and tightens dive interval');
  assert(f4.diveInterval < f2.diveInterval && f7.diveInterval < f4.diveInterval, 'Dive interval tightens progressively across stages');

  // Verify Stage 1 Zako fires strictly 1 missile across full dive
  const bmDive1 = new BulletManager();
  const s1Zako = new Alien(AlienType.ZAKO, 2, 0, 400, 180, 1);
  s1Zako.startDive(400, 180, 400, 520, 800, 600, 1);
  assert(s1Zako.diveMaxMissiles === 1, 'Stage 1 diving alien quota is strictly 1 missile');
  for (let step = 0; step < 80; step++) {
    s1Zako.update(0.05, 400, 180, 1.0, bmDive1, 400, 520);
  }
  assert(bmDive1.alienMissiles.length === 1, 'Stage 1 diving alien fires exactly 1 missile over entire dive');

  // Verify Stage 4 diving alien fires 2 missiles
  const bmDive4 = new BulletManager();
  const s4Goei = new Alien(AlienType.GOEI, 1, 0, 400, 140, 4);
  s4Goei.startDive(400, 140, 400, 520, 800, 600, 4);
  assert(s4Goei.diveMaxMissiles === 2, 'Stage 4 diving alien quota increases to 2 missiles');
  for (let step = 0; step < 80; step++) {
    s4Goei.update(0.05, 400, 140, 1.0, bmDive4, 400, 520);
  }
  assert(bmDive4.alienMissiles.length === 2, 'Stage 4 diving alien fires 2 missiles');

  // Verify Stage 7+ New Enemy PHANTOM
  assert(f6.aliens.filter(a => a.type === AlienType.PHANTOM).length === 0, 'Stage 6 does NOT spawn PHANTOM units');
  const phantoms = f7.aliens.filter(a => a.type === AlienType.PHANTOM);
  assert(phantoms.length === 4, 'Stage 7 spawns 4 elite PHANTOM units');
  assert(phantoms[0].isShielded === true && phantoms[0].maxHp === 2, 'PHANTOM spawns shielded with 2 base HP');

  // Verify PHANTOM twin-spread missiles during dive
  const bmPhantom = new BulletManager();
  const phantomDive = new Alien(AlienType.PHANTOM, 0, 10, 400, 100, 7);
  phantomDive.startDive(400, 100, 400, 520, 800, 600, 7);
  for (let step = 0; step < 80; step++) {
    phantomDive.update(0.05, 400, 100, 1.0, bmPhantom, 400, 520);
  }
  assert(bmPhantom.alienMissiles.length === 6, 'Stage 7 PHANTOM fires 3 volleys x twin spread = 6 plasma missiles');

  // Verify PHANTOM points & destruction
  assert(phantomDive.hit() === 50, '1st hit breaks PHANTOM shield for 50 pts');
  assert(phantomDive.hit() === 0, '2nd hit injures PHANTOM');
  assert(phantomDive.hit() === 500, '3rd hit kills PHANTOM in formation for 500 pts');
  assert(phantomDive.isDead === true, 'PHANTOM marked dead after 3 hits');

  console.log('\n--- Testing Stage 13+ (VORTEX) & Stage 19+ (OVERLORD) ---');
  const f12 = new AlienFormation(800, 600, 12);
  const f13 = new AlienFormation(800, 600, 13);
  const f18 = new AlienFormation(800, 600, 18);
  const f19 = new AlienFormation(800, 600, 19);

  // VORTEX (Stage 13+)
  assert(f12.aliens.filter(a => a.type === AlienType.VORTEX).length === 0, 'Stage 12 does NOT spawn VORTEX units');
  const vortexes = f13.aliens.filter(a => a.type === AlienType.VORTEX);
  assert(vortexes.length === 4, 'Stage 13 spawns 4 Solar VORTEX cruisers');
  assert(vortexes[0].isShielded === true && vortexes[0].maxHp === 3, 'VORTEX spawns shielded with 3 base HP');

  const bmVortex = new BulletManager();
  const vortexDive = new Alien(AlienType.VORTEX, 1, 10, 400, 140, 13);
  vortexDive.startDive(400, 140, 400, 520, 800, 600, 13);
  for (let step = 0; step < 80; step++) {
    vortexDive.update(0.05, 400, 140, 1.0, bmVortex, 400, 520);
  }
  assert(bmVortex.alienMissiles.length === 6, 'Stage 13 VORTEX fires 2 volleys x 3-way fan = 6 solar missiles');
  assert(vortexDive.hit() === 50, '1st hit breaks VORTEX shield');
  vortexDive.hit();
  vortexDive.hit();
  assert(vortexDive.hit() === 800, '4th hit destroys VORTEX for 800 pts');

  // OVERLORD (Stage 19+)
  assert(f18.aliens.filter(a => a.type === AlienType.OVERLORD).length === 0, 'Stage 18 does NOT spawn OVERLORD units');
  const overlords = f19.aliens.filter(a => a.type === AlienType.OVERLORD);
  assert(overlords.length === 2, 'Stage 19 spawns 2 Apex OVERLORD dreadnoughts');
  assert(overlords[0].isShielded === true && overlords[0].maxHp === 4, 'OVERLORD spawns shielded with 4 base HP');

  const bmOverlord = new BulletManager();
  const overlordDive = new Alien(AlienType.OVERLORD, 0, 20, 400, 70, 19);
  overlordDive.startDive(400, 70, 400, 520, 800, 600, 19);
  for (let step = 0; step < 80; step++) {
    overlordDive.update(0.05, 400, 70, 1.0, bmOverlord, 400, 520);
  }
  assert(bmOverlord.alienMissiles.length === 10, 'Stage 19 OVERLORD fires 2 volleys x 5-way nova burst = 10 missiles');
  assert(overlordDive.hit() === 50, '1st hit breaks OVERLORD shield');
  overlordDive.hit();
  overlordDive.hit();
  overlordDive.hit();
  assert(overlordDive.hit() === 1500, '5th hit destroys OVERLORD for 1500 pts');

  console.log(`\nGalaga Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
