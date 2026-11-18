import { CONFIG } from '../js/config.js';
import {
  KID_PROFILES,
  KidState,
  UmbrellaEngine
} from '../js/game/umbrella/umbrellaEngine.js';

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

function makeHandPose(screenX, screenY, w = 1280, h = 720) {
  // MediaPipe raw X is un-mirrored: mirrored = (1 - rawX) * w => rawX = 1 - screenX / w
  const lm = new Array(33).fill(null);
  lm[15] = { x: 1.0 - screenX / w, y: screenY / h, visibility: 0.99 };
  lm[19] = { x: 1.0 - screenX / w, y: screenY / h, visibility: 0.99 };
  return [lm];
}

function runTests() {
  console.log('--- Testing Config, Profiles & Region Rain Logic (Umbrella Mode) ---');
  assert(CONFIG.MODES.UMBRELLA === 'UMBRELLA', 'CONFIG.MODES registers UMBRELLA mode');
  assert(
    KID_PROFILES.length >= 4 && new Set(KID_PROFILES.map(k => k.baseSpeed)).size >= 4,
    'Kids have distinct walking speed profiles'
  );

  const sfxLog = [];
  const mockSound = {
    playUmbrellaHome: () => sfxLog.push('HOME'),
    playUmbrellaCry: () => sfxLog.push('CRY'),
    playUmbrellaShelter: () => sfxLog.push('SHELTER')
  };

  let lastScore = 0;
  let lastLives = 5;
  let gameOverCalled = false;
  const engine = new UmbrellaEngine(1280, 720, null, mockSound);
  engine.onScore = (s) => { lastScore = s; };
  engine.onLivesChanged = (l) => { lastLives = l; };
  engine.onGameOver = () => { gameOverCalled = true; };

  engine.start();
  const { homePorchRightX, schoolPorchLeftX, floorY } = engine.getLayout();
  assert(
    engine.activeChild &&
      engine.activeChild.state === KidState.WAITING_AT_SCHOOL &&
      engine.activeChild.x > schoolPorchLeftX &&
      engine.kidQueue.length >= 2,
    'Child starts waiting safely under right school awning with queue behind'
  );

  // Check spatial region rain logic (NOT droplet objects)
  engine.hands = [{ x: 640, y: floorY - 140, halfWidth: 86 }];
  assert(
    engine.isPointInRain(640, floorY - 50) === false,
    'Region directly UNDER hand palm is dry/safe'
  );
  assert(
    engine.isPointInRain(640, floorY - 220) === true,
    'Region ABOVE hand palm remains exposed to pouring rain'
  );
  assert(
    engine.isPointInRain(420, floorY - 50) === true,
    'Outdoor region horizontally outside hand width is in pouring rain'
  );
  assert(
    engine.isPointInRain(homePorchRightX - 10, floorY - 50) === false &&
      engine.isPointInRain(schoolPorchLeftX + 10, floorY - 50) === false,
    'Left house porch and right school awning stay dry'
  );

  // Shelter waiting child at school -> starts walking left toward Home
  const startPose = makeHandPose(engine.activeChild.x, floorY - 130);
  engine.update(0.05, 0, startPose);
  assert(
    engine.activeChild.state === KidState.WALKING_HOME && sfxLog.includes('SHELTER'),
    'Holding hand shelter over waiting child starts their walk home'
  );

  // Walk child all the way to left home porch continuously sheltered under hand
  const firstChildRef = engine.activeChild;
  for (let i = 0; i < 360 && engine.activeChild === firstChildRef; i++) {
    const coverPose = makeHandPose(engine.activeChild.x, floorY - 130);
    engine.update(0.05, 0, coverPose);
  }
  assert(
    engine.rescuedCount === 1 && lastScore >= 100 && sfxLog.includes('HOME') && engine.activeChild !== firstChildRef,
    'Escorting child safely to left Home awards score, plays chime, and brings out next waiting child'
  );

  // Expose next child to pouring rain -> gets wet, cries back to school, loses 1 heart
  engine.update(0.05, 0, makeHandPose(engine.activeChild.x, floorY - 130)); // trigger WALKING_HOME
  engine.activeChild.x = 640; // out in open rain
  for (let i = 0; i < 10; i++) {
    // Hold hand far away so 640 is in open rain region
    engine.update(0.05, 0, makeHandPose(240, floorY - 130));
  }
  assert(
    engine.activeChild.state === KidState.RETURNING_CRYING &&
      engine.lives === 4 &&
      lastLives === 4 &&
      sfxLog.includes('CRY'),
    'Uncovered child caught in shower region cries back toward school and deducts 1 life'
  );

  // Advance crying return until safely back under school awning
  for (let i = 0; i < 60 && engine.activeChild.state === KidState.RETURNING_CRYING; i++) {
    engine.update(0.05, 0, null);
  }
  assert(
    engine.activeChild.state === KidState.WAITING_AT_SCHOOL && engine.activeChild.x >= schoolPorchLeftX,
    'Crying child runs back right to school overhang to wait again'
  );

  // Verify GameOver at 0 lives
  engine.lives = 1;
  engine.activeChild.state = KidState.WALKING_HOME;
  engine.activeChild.x = 640;
  for (let i = 0; i < 10; i++) {
    engine.update(0.05, 0, null);
  }
  assert(engine.state === 'GAMEOVER' && engine.lives === 0 && gameOverCalled, 'Losing final heart triggers GAMEOVER cleanly');

  // Headless render test
  const mockCtx = {
    save() {},
    restore() {},
    translate() {},
    scale() {},
    beginPath() {},
    closePath() {},
    arc() {},
    ellipse() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    strokeText() {},
    fillText() {},
    setLineDash() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set lineCap(_) {},
    set lineJoin(_) {},
    set globalAlpha(_) {},
    set font(_) {},
    set textAlign(_) {}
  };
  let renderErr = null;
  try {
    engine.reset();
    engine.render(mockCtx);
  } catch (e) {
    renderErr = e;
  }
  assert(!renderErr, 'UmbrellaEngine renders sketchbook street & shower region without errors');

  console.log(`\nUmbrella Tests Complete: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
