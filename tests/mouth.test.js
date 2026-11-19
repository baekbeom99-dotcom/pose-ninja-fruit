import { CONFIG } from '../js/config.js';
import {
  MouthEngine,
  MouthItemKind,
  MouthSubMode
} from '../js/game/mouth/mouthEngine.js';

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

function makeMockCtx() {
  return {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    arc() {},
    ellipse() {},
    roundRect() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {},
    strokeText() {},
    fillText() {},
    setLineDash() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1
  };
}

function makeFace(mouthX = 640, mouthY = 360, jawOpen = 0.0, w = 1280, h = 720) {
  return {
    detected: true,
    mouthX: mouthX / w,
    mouthY: mouthY / h,
    jawOpen,
    faceX: mouthX / w,
    faceY: (mouthY - 28) / h,
    faceW: 0.18,
    faceH: 0.34
  };
}

function runTests() {
  console.log('--- Testing Mouth Catch Mode (TOSS / RAIN, Mushrooms, Stains) ---');
  assert(CONFIG.MODES.MOUTH_CATCH === 'MOUTH_CATCH', 'CONFIG.MODES registers MOUTH_CATCH mode');

  const sfxLog = [];
  const mockSound = {
    playMouthChomp: () => sfxLog.push('CHOMP'),
    playMouthGolden: () => sfxLog.push('GOLDEN'),
    playMouthHeal: () => sfxLog.push('HEAL'),
    playMouthBad: () => sfxLog.push('BAD'),
    playMouthSplat: () => sfxLog.push('SPLAT')
  };

  let lastScore = 0;
  let lastLives = 5;
  let gameOverCalled = false;
  const engine = new MouthEngine(1280, 720, null, mockSound);
  engine.onScore = (s) => { lastScore = s; };
  engine.onLivesChanged = (l) => { lastLives = l; };
  engine.onGameOver = () => { gameOverCalled = true; };

  // 1. Sub-mode spawn physics: TOSS arcs upward from bottom, RAIN falls downward from top
  engine.setSubMode(MouthSubMode.TOSS);
  engine.start();
  const tossItem = engine.spawnItem(MouthItemKind.BURGER, 640);
  assert(
    tossItem.y > engine.height && tossItem.vy < 0 && tossItem.gravity > 200,
    'TOSS sub-mode spawns items below bottom edge with strong upward velocity'
  );

  engine.setSubMode(MouthSubMode.RAIN);
  engine.start();
  const rainItem = engine.spawnItem(MouthItemKind.PIZZA, 640);
  assert(
    rainItem.y < 0 && rainItem.vy > 100,
    'RAIN sub-mode spawns items above top edge pouring downward'
  );

  // 2. Open mouth eats FOOD (+points)
  engine.reset();
  engine.setSubMode(MouthSubMode.RAIN);
  const burger = engine.spawnItem(MouthItemKind.BURGER, 640, 355);
  burger.vx = 0;
  burger.vy = 100;
  for (let i = 0; i < 6; i++) {
    engine.update(0.016, performance.now(), makeFace(640, 360, 0.72));
  }
  assert(
    engine.score === MouthItemKind.BURGER.points &&
      lastScore === MouthItemKind.BURGER.points &&
      sfxLog.includes('CHOMP'),
    'Open mouth (jawOpen >= 0.28) catches flying food and awards points + chomp SFX'
  );

  // 3. Yellow Mushroom awards bonus points (+50)
  const preYellowScore = engine.score;
  const yellow = engine.spawnItem(MouthItemKind.MUSHROOM_YELLOW, 640, 355);
  yellow.vx = 0;
  yellow.vy = 100;
  for (let i = 0; i < 6; i++) {
    engine.update(0.016, performance.now(), makeFace(640, 360, 0.75));
  }
  assert(
    engine.score === preYellowScore + 50 && sfxLog.includes('GOLDEN'),
    'Yellow mushroom eaten with open mouth awards +50 bonus points'
  );

  // 4. Red Mushroom deducts 1 heart; Green Mushroom restores +1 heart
  const red = engine.spawnItem(MouthItemKind.MUSHROOM_RED, 640, 355);
  red.vx = 0;
  red.vy = 100;
  for (let i = 0; i < 6; i++) {
    engine.update(0.016, performance.now(), makeFace(640, 360, 0.75));
  }
  assert(
    engine.lives === 4 && lastLives === 4 && sfxLog.includes('BAD'),
    'Red mushroom eaten with open mouth deducts 1 heart'
  );

  const green = engine.spawnItem(MouthItemKind.MUSHROOM_GREEN, 640, 355);
  green.vx = 0;
  green.vy = 100;
  for (let i = 0; i < 6; i++) {
    engine.update(0.016, performance.now(), makeFace(640, 360, 0.75));
  }
  assert(
    engine.lives === 5 && sfxLog.includes('HEAL'),
    'Green mushroom eaten with open mouth restores +1 heart (up to maxLives)'
  );

  // 5. Non-food hazard eaten deducts heart, whereas closed mouth avoids heart loss & splatters face stain
  const bomb = engine.spawnItem(MouthItemKind.BOMB, 640, 355);
  bomb.vx = 0;
  bomb.vy = 100;
  for (let i = 0; i < 6; i++) {
    engine.update(0.016, performance.now(), makeFace(640, 360, 0.75));
  }
  assert(
    engine.lives === 4,
    'Non-food hazard (Bomb) eaten with open mouth deducts 1 heart'
  );

  const livesBeforeClosed = engine.lives;
  const shoe = engine.spawnItem(MouthItemKind.SHOE, 640, 330); // right over face cheek with closed mouth
  shoe.vx = 0;
  shoe.vy = 120;
  for (let i = 0; i < 6; i++) {
    engine.update(0.016, performance.now(), makeFace(640, 360, 0.05));
  }
  assert(
    engine.lives === livesBeforeClosed &&
      engine.faceStains.length >= 1 &&
      sfxLog.includes('SPLAT'),
    'Closed mouth avoids hazard damage while missed item on face creates sticky face stain + splat SFX'
  );

  // 6. Face stain sticks relative to face movement and fades away after > 4.8s
  engine.spawnTimer = 999; // pause spawner so no new random items create fresh stains during fade check
  const prevFaceX = engine.face.x;
  for (let i = 0; i < 10; i++) {
    engine.update(0.05, performance.now(), makeFace(720, 360, 0.05));
  }
  assert(
    engine.face.x > prevFaceX && engine.faceStains.length >= 1,
    'Face stain persists while head moves across screen'
  );
  for (let i = 0; i < 105; i++) {
    engine.update(0.05, performance.now(), makeFace(720, 360, 0.05));
  }
  assert(
    engine.faceStains.length === 0,
    'Face stain fades out completely after ~4.8 seconds'
  );

  // 7. Pointer + Space fallback moves face and opens mouth
  engine.reset();
  engine.setPointerFallback(420, 300, true);
  for (let i = 0; i < 10; i++) {
    engine.update(0.03, performance.now(), null, null);
  }
  assert(
    engine.face.isOpen === true && Math.abs(engine.face.mouthX - 420) < 30,
    'Mouse pointer + Space/click fallback steers face and opens mouth without webcam'
  );

  // 8. Eating bad items down to 0 hearts triggers GAMEOVER
  engine.lives = 1;
  const poison = engine.spawnItem(MouthItemKind.MUSHROOM_RED, engine.face.mouthX, engine.face.mouthY - 2);
  poison.vx = 0;
  poison.vy = 50;
  for (let i = 0; i < 6; i++) {
    engine.update(0.016, performance.now(), null, null);
  }
  assert(
    engine.state === 'GAMEOVER' && gameOverCalled === true,
    'Losing final heart to poison mushroom triggers GAMEOVER callback'
  );

  // 9. Headless render check across items, mushrooms, stains, and open mouth ring
  engine.start();
  engine.spawnItem(MouthItemKind.MUSHROOM_RED, 500, 300);
  engine.spawnItem(MouthItemKind.MUSHROOM_YELLOW, 600, 300);
  engine.spawnItem(MouthItemKind.MUSHROOM_GREEN, 700, 300);
  engine.spawnItem(MouthItemKind.CAKE, 800, 300);
  engine.faceStains.push({
    relX: 12,
    relY: -10,
    color: '#ef4444',
    radius: 20,
    dripLen: 16,
    blobs: [{ dx: 5, dy: 5, r: 6 }],
    life: 3.0,
    maxLife: 4.8
  });
  let renderError = null;
  try {
    engine.render(makeMockCtx());
  } catch (err) {
    renderError = err;
  }
  assert(renderError === null, 'Headless render completes without errors across mushrooms, food, mouth, and stains');

  console.log(`\nResults: ${passed}/${total} passed`);
  if (passed !== total) process.exit(1);
}

runTests();
