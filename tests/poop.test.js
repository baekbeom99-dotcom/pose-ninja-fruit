import { CONFIG } from '../js/config.js';
import {
  DropType,
  FallingDrop,
  POOP_SPRITE_IDS,
  PoopPlayer
} from '../js/game/poop/poopEntities.js';
import { PoopEngine } from '../js/game/poop/poopEngine.js';

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
  console.log('--- Testing Config, Sprite IDs & PoopEntities ---');
  assert(CONFIG.MODES.POOP_DODGE === 'POOP_DODGE', 'CONFIG.MODES registers POOP_DODGE mode');
  assert(
    POOP_SPRITE_IDS.join(',') === '033,034,035,036,037,038',
    'Poop mode includes sprites 033 through 038'
  );

  const p = new PoopPlayer(640, 650);
  assert(p.radius >= 34, `Player radius scaled +30% (${p.radius}px >= 34px)`);
  p.update(0.05, 900, 1280, 650);
  assert(p.x > 640 && p.x < 900, 'Player smoothly interpolates toward targetX');
  p.update(0.05, -200, 1280, 650);
  assert(p.targetX >= p.radius + 14, 'Player targetX clamped to left boundary');
  p.update(0.05, 5000, 1280, 650);
  assert(p.targetX <= 1280 - p.radius - 14, 'Player targetX clamped to right boundary');

  const normal = new FallingDrop(300, 12, DropType.POOP_NORMAL, 1);
  const giant = new FallingDrop(300, 12, DropType.POOP_GIANT, 2);
  const fast = new FallingDrop(300, 12, DropType.POOP_FAST, 3);
  const elephant = new FallingDrop(300, 12, DropType.POOP_ELEPHANT, 6);
  const rainbow = new FallingDrop(300, 12, DropType.POOP_RAINBOW, 2);

  assert(
    normal.radius >= 29 && giant.radius >= 44 && fast.radius >= 26,
    `Falling drops scaled +30% (normal=${normal.radius}, giant=${giant.radius}, fast=${fast.radius})`
  );
  assert(
    elephant.radius >= 65 && elephant.isHazardous === true,
    `Elephant poop is huge (${elephant.radius}px) and hazardous`
  );
  assert(
    rainbow.isHazardous === false && rainbow.points === 25,
    'Rainbow poop is collectible bonus (+25 pts)'
  );

  const startY = giant.y;
  giant.update(0.1, 1280);
  assert(giant.y === startY && giant.warningTimer > 0, 'Giant poop pauses briefly for warning cue before plunging');
  giant.warningTimer = 0;
  giant.update(0.1, 1280);
  assert(giant.y > startY, 'Giant poop accelerates downward after warning ends');

  console.log('--- Testing PoopEngine Head-X Control, Rainbow, Elephant Ice, Storm & Anti-Camp ---');
  const sfxLog = [];
  const mockSound = {
    playPoopFloorSplat() { sfxLog.push('FLOOR'); },
    playPoopSplat() { sfxLog.push('HIT'); },
    playPoopBonus() { sfxLog.push('BONUS'); },
    playPoopFlush() { sfxLog.push('FLUSH'); },
    playPoopWarning() { sfxLog.push('WARN'); },
    playPoopElephantSplat() { sfxLog.push('ELEPHANT'); },
    playPoopStormAlarm() { sfxLog.push('ALARM'); }
  };

  let lastScore = 0;
  let lastLives = 5;
  let gameOverCalled = false;

  const engine = new PoopEngine(1000, 600, null, mockSound);
  engine.onScore = (s) => { lastScore = s; };
  engine.onLivesChanged = (l) => { lastLives = l; };
  engine.onGameOver = () => { gameOverCalled = true; };

  engine.start();
  const firstSprite = engine.selectedSpriteId;
  assert(POOP_SPRITE_IDS.includes(firstSprite), `Selected random character sprite #${firstSprite}`);
  engine.start();
  assert(engine.selectedSpriteId !== firstSprite, 'Restart avoids repeating identical sprite immediately');

  // Head pose mirrored steering: raw head X = 0.2 -> mirrored canvas X = 0.8 * 1000 = 800
  engine.update(0.05, 0, { x: 0.2, y: 0.3 });
  assert(
    Math.abs(engine.player.targetX - 800) < 1 && engine.player.x > 500,
    'Mirrored head X (0.2 -> 800px) steers character X position smoothly'
  );

  // Move head to raw X = 0.8 -> mirrored target = 200px
  engine.update(0.05, 0, { x: 0.8, y: 0.3 });
  assert(Math.abs(engine.player.targetX - 200) < 1, 'Mirrored head X (0.8 -> 200px) steers leftward');

  // Test floor splat scoring & SFX
  engine.drops = [new FallingDrop(900, engine.getFloorY() - 5, DropType.POOP_NORMAL, 1)];
  engine.spawnTimer = 99;
  engine.update(0.05, 0, { x: 0.8, y: 0.3 });
  assert(engine.score >= 1 && lastScore === engine.score, 'Dodged poop landing on floor awards points');
  assert(engine.floorSplats.length === 1 && engine.particles.length > 0, 'Floor splat and splash particles generated');
  assert(sfxLog.includes('FLOOR'), 'Floor splat SFX triggered');

  // Stabilize player position & test Rainbow Poop pickup
  engine.player.targetX = engine.player.x;
  const beforeRainbow = engine.score;
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.POOP_RAINBOW, 1)];
  engine.update(0.02, 0, null);
  assert(
    engine.score === beforeRainbow + 25 && engine.lives === 5 && sfxLog.includes('BONUS'),
    'Collecting Rainbow Poop awards +25 bonus points without hurting player'
  );

  // Test Anti-Camping targeted poop within ~3s
  engine.drops = [];
  engine.spawnTimer = 99;
  engine.stormCooldown = 99;
  engine.campAnchorX = engine.player.x;
  engine.campTimer = 0;
  for (let i = 0; i < 30; i++) {
    engine.update(0.1, 0, null); // stationary 3.0s
  }
  const aimedDrops = engine.drops.filter(d => d.type === DropType.POOP_FAST);
  assert(
    aimedDrops.length >= 1 && Math.abs(aimedDrops[0].x - engine.player.x) <= 25,
    'Staying stationary for ~3s spawns targeted anti-camp poop over player'
  );

  // Test Elephant Poop impact -> 5s Ice Patch creation, slippery steering, & 5s expiration
  engine.drops = [];
  engine.icePatches = [];
  const elDrop = new FallingDrop(engine.player.x, engine.getFloorY() - 10, DropType.POOP_ELEPHANT, 6);
  elDrop.warningTimer = 0;
  // Place player safely off to side while elephant poop lands at x=500
  engine.player.x = 200;
  engine.player.targetX = 200;
  elDrop.x = 500;
  engine.drops = [elDrop];
  engine.update(0.05, 0, null);
  assert(
    engine.icePatches.length === 1 && Math.abs(engine.icePatches[0].life - 5.0) < 0.2 && sfxLog.includes('ELEPHANT'),
    'Elephant poop impact creates a 5-second ice patch and plays elephant splat SFX'
  );

  // Step player onto ice patch -> slippery inertia physics active
  engine.player.x = 500;
  engine.player.targetX = 650;
  engine.player.vx = 0;
  engine.update(0.02, 0, null);
  assert(engine.player.isOnIce === true, 'Player standing on elephant dung ice patch enters slippery isOnIce state');

  // Advance 5.1s -> ice patch disappears cleanly
  for (let i = 0; i < 52; i++) {
    engine.update(0.1, 0, null);
  }
  assert(engine.icePatches.length === 0, 'Elephant poop ice patch disappears after 5 seconds');

  // Test Poop Storm Alarm, Pre/Post Safe Zone Protection & Bombardment
  engine.drops = [
    new FallingDrop(500, 120, DropType.POOP_NORMAL, 2),
    new FallingDrop(200, 120, DropType.POOP_FAST, 3, 180)
  ];
  engine.spawnTimer = 99;
  engine.player.x = 500;
  engine.player.targetX = 500;
  engine.campAnchorX = 500;
  engine.campTimer = 2.4;
  engine.triggerPoopStorm(500);
  assert(
    engine.stormState && engine.stormState.phase === 'WARNING' && engine.stormState.safeX === 500 && sfxLog.includes('ALARM'),
    'Poop Storm triggers alarm SFX and sets Safe Zone in advance'
  );
  assert(
    engine.drops.every(d => Math.abs(d.x - 500) > engine.stormState.safeHalfW),
    'Existing falling hazards inside Safe Zone are purged immediately when storm warning activates'
  );

  // Spawn 40 hazardous poops during WARNING (before activation) & verify none enter Safe Zone
  for (let k = 0; k < 40; k++) {
    engine._spawnDrop(k % 2 === 0 ? DropType.POOP_NORMAL : DropType.POOP_FAST, null, 150);
  }
  const safeHalfW = engine.stormState.safeHalfW;
  assert(
    engine.drops.every(d => !d.isHazardous || (Math.abs(d.x - 500) > safeHalfW && d.vx === 0)),
    'No hazardous poop spawns inside Safe Zone or drifts sideways into it during WARNING phase'
  );

  // Clear temporary warning drops & advance 2.5s past barrage into POST safety window while player stays at x=500
  engine.drops = [];
  for (let i = 0; i < 25; i++) {
    engine.update(0.1, 0, null);
  }
  assert(
    engine.stormState && engine.stormState.phase === 'POST' && engine.stormState.timer > 1.5,
    'Poop Storm enters POST protection window (~2.5s) after barrage fires'
  );
  const stormDropsOutsideSafe = engine.drops.filter(d => Math.abs(d.x - 500) > safeHalfW);
  const stormDropsInsideSafe = engine.drops.filter(d => d.isHazardous && Math.abs(d.x - 500) <= safeHalfW);
  assert(
    stormDropsOutsideSafe.length >= 6 && stormDropsInsideSafe.length === 0,
    'Poop Storm drops carpet barrage across all columns EXCEPT the Safe Zone'
  );

  // Spawn 40 more hazardous poops during POST window (after activation) & check anti-camp stays paused in Safe Zone
  for (let k = 0; k < 40; k++) {
    engine._spawnDrop(DropType.POOP_ELEPHANT, null, 0);
  }
  assert(
    engine.drops.every(d => !d.isHazardous || Math.abs(d.x - 500) > safeHalfW),
    'Safe Zone stays hazard-free during POST window after barrage activation as well'
  );

  // Test Umbrella Shield + Heart + GameOver (reset state after storm)
  engine.lives = 5;
  engine.player.invulnerableTimer = 0;
  engine.player.shieldTimer = 0;
  engine.stormState = null;
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.UMBRELLA, 1)];
  engine.update(0.02, 0, null);
  assert(engine.player.shieldTimer > 5.0 && sfxLog.includes('FLUSH'), 'Collecting Umbrella activates shield and plays flush SFX');

  engine.player.shieldTimer = 0;
  engine.player.invulnerableTimer = 0;
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.POOP_NORMAL, 1)];
  engine.update(0.02, 0, null);
  assert(engine.lives === 4 && lastLives === 4 && sfxLog.includes('HIT'), 'Unshielded poop hit deducts life');

  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.HEART, 1)];
  engine.update(0.02, 0, null);
  assert(engine.lives === 5, 'Collecting Heart restores +1 life');

  engine.lives = 1;
  engine.player.invulnerableTimer = 0;
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.POOP_NORMAL, 1)];
  engine.update(0.02, 0, null);
  assert(engine.lives === 0 && engine.state === 'GAMEOVER' && gameOverCalled === true, 'GameOver triggers cleanly at 0 lives');

  console.log(`\nPoop Dodge Tests Complete: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
