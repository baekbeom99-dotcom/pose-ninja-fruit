import { CONFIG } from '../js/config.js';
import { BreakoutEngine } from '../js/game/breakout/breakoutEngine.js';

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

function makeWristPose({ leftScreenX = 0.35, leftY = 0.65, rightScreenX = 0.65, rightY = 0.65 } = {}) {
  // MediaPipe un-mirrored X = 1 - screenX
  const lm = new Array(33).fill(null);
  lm[0] = { x: 1.0 - (leftScreenX + rightScreenX) * 0.5, y: 0.25, visibility: 0.99 };
  lm[11] = { x: 1.0 - 0.42, y: 0.42, visibility: 0.99 };
  lm[12] = { x: 1.0 - 0.58, y: 0.42, visibility: 0.99 };
  lm[15] = { x: 1.0 - leftScreenX, y: leftY, visibility: 0.99 };
  lm[16] = { x: 1.0 - rightScreenX, y: rightY, visibility: 0.99 };
  return [lm];
}

function runTests() {
  console.log('--- Testing Config, Seesaw Angle Input & Reflection (Breakout Mode) ---');
  assert(CONFIG.MODES.BREAKOUT === 'BREAKOUT', 'CONFIG.MODES registers BREAKOUT mode');

  const sfxLog = [];
  const mockSound = {
    playBreakoutPaddle: () => sfxLog.push('PADDLE'),
    playBreakoutBrick: () => sfxLog.push('BRICK'),
    playBreakoutPowerup: () => sfxLog.push('PWR'),
    playBreakoutMiss: () => sfxLog.push('MISS'),
    playBreakoutClear: () => sfxLog.push('CLEAR')
  };

  let lastScore = 0;
  let lastLives = 5;
  let gameOverCalled = false;
  const engine = new BreakoutEngine(1280, 720, null, mockSound);
  engine.onScore = (s) => { lastScore = s; };
  engine.onLivesChanged = (l) => { lastLives = l; };
  engine.onGameOver = () => { gameOverCalled = true; };

  engine.start();
  assert(engine.bricks.length >= 30 && engine.balls.length === 1, 'Breakout starts with brick wall and serve ball');

  // Test Seesaw angle from wrist height difference:
  // Raising screen-left wrist (y=0.50) vs lowering screen-right wrist (y=0.72) -> positive slope (\)
  const rightTiltPose = makeWristPose({ leftScreenX: 0.30, leftY: 0.50, rightScreenX: 0.70, rightY: 0.72 });
  for (let i = 0; i < 15; i++) {
    engine.update(0.03, 0, rightTiltPose);
  }
  assert(
    engine.paddle.angle > 0.25 && Math.abs(engine.paddle.x - 640) < 35,
    `Tilting wrists down-right produces positive seesaw slope (angle=${engine.paddle.angle.toFixed(2)})`
  );

  // Test geometric surface reflection physics: ball falling vertically onto +angle paddle deflects rightward (+vx)!
  const testBall = {
    x: engine.paddle.x,
    y: engine.paddle.y - engine.paddle.halfH - 2,
    vx: 0,
    vy: 420,
    radius: 11,
    speed: 440,
    stuckToPaddle: false,
    trail: []
  };
  const bouncedRight = engine._resolvePaddleBounce(testBall);
  assert(bouncedRight && testBall.vx > 140 && testBall.vy < 0, 'Positive seesaw tilt reflects falling ball sharply rightward');

  // Raising screen-right wrist (y=0.48) vs screen-left wrist (y=0.72) -> negative slope (/), deflects leftward!
  const leftTiltPose = makeWristPose({ leftScreenX: 0.30, leftY: 0.72, rightScreenX: 0.70, rightY: 0.48 });
  for (let i = 0; i < 20; i++) {
    engine.update(0.03, 0, leftTiltPose);
  }
  assert(engine.paddle.angle < -0.25, 'Tilting wrists down-left produces negative seesaw slope');
  const testBallL = {
    x: engine.paddle.x,
    y: engine.paddle.y - engine.paddle.halfH - 2,
    vx: 0,
    vy: 420,
    radius: 11,
    speed: 440,
    stuckToPaddle: false,
    trail: []
  };
  engine._resolvePaddleBounce(testBallL);
  assert(testBallL.vx < -140 && testBallL.vy < 0, 'Negative seesaw tilt reflects falling ball sharply leftward');

  // Test shoulder / head X control when wrists are absent
  const shoulderLm = new Array(33).fill(null);
  shoulderLm[11] = { x: 1.0 - 0.72, y: 0.44, visibility: 0.99 };
  shoulderLm[12] = { x: 1.0 - 0.88, y: 0.44, visibility: 0.99 };
  const sInput = engine._extractSeesawInput([shoulderLm]);
  assert(sInput && sInput.source === 'SHOULDERS' && Math.abs(sInput.x - 1280 * 0.8) < 5, 'Shoulders control seesaw X center cleanly');

  // Test brick hit & destruction + stage clear
  engine.balls = [
    {
      x: engine.bricks[0].x + engine.bricks[0].w * 0.5,
      y: engine.bricks[0].y + engine.bricks[0].h + 5,
      vx: 0,
      vy: -300,
      radius: 11,
      speed: 440,
      stuckToPaddle: false,
      trail: []
    }
  ];
  const initialBricks = engine.bricks.length;
  engine.update(0.03, 0, null);
  assert(engine.bricks.length === initialBricks - 1 && lastScore > 0 && sfxLog.includes('BRICK'), 'Ball collision breaks brick, scores points, and plays brick SFX');

  // Clear all bricks -> advances stage cleanly
  engine.bricks = [];
  engine.update(0.02, 0, null);
  assert(engine.stage === 2 && engine.bricks.length >= 25 && sfxLog.includes('CLEAR'), 'Clearing all bricks advances to Stage 2 with fresh layout');

  // Miss ball -> deducts 1 life -> GameOver at 0
  engine.balls = [{ x: 640, y: 740, vx: 0, vy: 400, radius: 11, speed: 440, stuckToPaddle: false, trail: [] }];
  engine.update(0.02, 0, null);
  assert(engine.lives === 4 && lastLives === 4 && sfxLog.includes('MISS'), 'Missing ball deducts 1 life');

  engine.lives = 1;
  engine.balls = [{ x: 640, y: 740, vx: 0, vy: 400, radius: 11, speed: 440, stuckToPaddle: false, trail: [] }];
  engine.update(0.02, 0, null);
  assert(engine.lives === 0 && engine.state === 'GAMEOVER' && gameOverCalled, 'GameOver triggers cleanly at 0 lives');

  // Headless render test
  const mockCtx = {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    arc() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    roundRect() {},
    strokeText() {},
    fillText() {},
    setLineDash() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set globalAlpha(_) {},
    set font(_) {},
    set textAlign(_) {},
    set textBaseline(_) {}
  };
  let renderErr = null;
  try {
    engine.reset();
    engine.render(mockCtx);
  } catch (e) {
    renderErr = e;
  }
  assert(!renderErr, 'BreakoutEngine renders bricks, tilted seesaw & guide cleanly');

  console.log(`\nBreakout Tests Complete: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
