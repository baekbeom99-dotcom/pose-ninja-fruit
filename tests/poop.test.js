import { CONFIG } from '../js/config.js';
import { DropType, FallingDrop, PoopPlayer } from '../js/game/poop/poopEntities.js';
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
  console.log('--- Testing Config & PoopEntities ---');
  assert(CONFIG.MODES.POOP_DODGE === 'POOP_DODGE', 'CONFIG.MODES registers POOP_DODGE mode');

  const p = new PoopPlayer(640, 650);
  p.update(0.05, 900, 1280, 650);
  assert(p.x > 640 && p.x < 900, 'Player smoothly interpolates toward targetX');
  p.update(0.05, -200, 1280, 650);
  assert(p.targetX >= p.radius + 14, 'Player targetX clamped to left boundary');
  p.update(0.05, 5000, 1280, 650);
  assert(p.targetX <= 1280 - p.radius - 14, 'Player targetX clamped to right boundary');

  const giant = new FallingDrop(300, 12, DropType.POOP_GIANT, 2);
  const startY = giant.y;
  giant.update(0.1, 1280);
  assert(giant.y === startY && giant.warningTimer > 0, 'Giant poop pauses briefly for warning cue before plunging');
  giant.warningTimer = 0;
  giant.update(0.1, 1280);
  assert(giant.y > startY, 'Giant poop accelerates downward after warning ends');

  console.log('--- Testing PoopEngine Head-X Control, Effects & SFX ---');
  const sfxLog = [];
  const mockSound = {
    playPoopFloorSplat() { sfxLog.push('FLOOR'); },
    playPoopSplat() { sfxLog.push('HIT'); },
    playPoopBonus() { sfxLog.push('BONUS'); },
    playPoopFlush() { sfxLog.push('FLUSH'); },
    playPoopWarning() { sfxLog.push('WARN'); }
  };

  let lastScore = 0;
  let lastLives = 5;
  let gameOverCalled = false;

  const engine = new PoopEngine(1000, 600, null, mockSound);
  engine.onScore = (s) => { lastScore = s; };
  engine.onLivesChanged = (l) => { lastLives = l; };
  engine.onGameOver = () => { gameOverCalled = true; };

  engine.start();
  assert(engine.state === 'PLAYING' && engine.lives === 5, 'PoopEngine starts with 5 lives');

  // Head pose mirrored steering: raw head X = 0.2 -> mirrored canvas X = 0.8 * 1000 = 800
  engine.update(0.05, 0, { x: 0.2, y: 0.3 });
  assert(
    Math.abs(engine.player.targetX - 800) < 1 && engine.player.x > 500,
    'Mirrored head X (0.2 -> 800px) steers character X position smoothly'
  );

  // Move head to raw X = 0.8 -> mirrored target = 200px
  engine.update(0.05, 0, { x: 0.8, y: 0.3 });
  assert(Math.abs(engine.player.targetX - 200) < 1, 'Mirrored head X (0.8 -> 200px) steers leftward');

  // Test floor splat scoring & particle/splat effects when poop misses player
  engine.drops = [new FallingDrop(900, engine.getFloorY() - 5, DropType.POOP_NORMAL, 1)];
  engine.spawnTimer = 99;
  engine.update(0.05, 0, { x: 0.8, y: 0.3 }); // player near 200, poop lands at 900
  assert(engine.score >= 1 && lastScore === engine.score, 'Dodged poop landing on floor awards points');
  assert(engine.floorSplats.length === 1 && engine.particles.length > 0, 'Floor splat and splash particles generated');
  assert(sfxLog.includes('FLOOR'), 'Floor splat SFX triggered');

  // Stabilize player targetX so items dropped at player.x hit squarely
  engine.player.targetX = engine.player.x;

  // Test Toilet Paper bonus pickup
  const prevScore = engine.score;
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.TOILET_PAPER, 1)];
  engine.update(0.02, 0, null);
  assert(
    engine.score === prevScore + 15 && engine.player.expression === 'HAPPY' && sfxLog.includes('BONUS'),
    'Collecting Toilet Paper adds +15 pts, sets HAPPY expression, and plays bonus SFX'
  );

  // Test Umbrella Shield pickup & poop deflection
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.UMBRELLA, 1)];
  engine.update(0.02, 0, null);
  assert(engine.player.shieldTimer > 5.0 && sfxLog.includes('FLUSH'), 'Collecting Umbrella activates shield and plays flush SFX');

  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.POOP_NORMAL, 1)];
  engine.update(0.02, 0, null);
  assert(engine.lives === 5 && engine.score > prevScore + 20, 'Umbrella shield deflects falling poop cleanly with 2x bonus');

  // Test unshielded poop hit -> splat SFX, OUCH expression, shake, life deduction
  engine.player.shieldTimer = 0;
  engine.player.invulnerableTimer = 0;
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.POOP_NORMAL, 1)];
  engine.update(0.02, 0, null);
  assert(
    engine.lives === 4 &&
      lastLives === 4 &&
      engine.player.expression === 'OUCH' &&
      engine.shakeTimer > 0 &&
      sfxLog.includes('HIT'),
    'Unshielded poop hit deducts life, triggers OUCH, screen shake, and splat SFX'
  );

  // Test Heart recovery pickup when damaged
  engine.drops = [new FallingDrop(engine.player.x, engine.player.y - 5, DropType.HEART, 1)];
  engine.update(0.02, 0, null);
  assert(engine.lives === 5, 'Collecting Heart restores +1 life');

  // Test Game Over on final hit at 1 life
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
