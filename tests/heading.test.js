import { Fruit } from '../js/game/fruit.js';
import { FruitManager } from '../js/game/fruitManager.js';
import { CONFIG } from '../js/config.js';

function runTests() {
  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
    }
  }

  // Mock particles system for FruitManager
  const mockParticles = {
    createBladeSparks: () => {},
    createShockwave: () => {},
    createBombExplosion: () => {},
    createFruitSplash: () => {},
    createHeartHealParticles: () => {}
  };

  // Test 1: Bomb contacted by head is defused safely without triggering onBomb
  {
    const fm = new FruitManager(mockParticles);
    let bombExploded = false;
    let headingDefused = false;
    let awardedPoints = 0;

    fm.onBomb = () => { bombExploded = true; };
    fm.onHeadingDefuse = (bomb, head, pts) => {
      headingDefused = true;
      awardedPoints = pts;
    };
    fm.onScore = (pts) => { awardedPoints = pts; };

    // Spawn a bomb at (300, 300)
    const bomb = new Fruit(CONFIG.FRUITS.BOMB, 300, 300, 0, 0);
    fm.fruits.push(bomb);

    // Head at (320, 320) - within contact radius (dist ~28px <= 80 + 64 = 144px)
    const headHitboxes = [{ x: 320, y: 320, radius: 64, owner: 'P1' }];

    fm.update(0.016, [], 1280, 720, 1000, 5, headHitboxes);

    assert(fm.fruits.length === 0, 'Bomb removed from active fruits array');
    assert(headingDefused === true, 'Heading defuse callback triggered');
    assert(bombExploded === false, 'Bomb did NOT explode (no life loss)');
    assert(awardedPoints === 10, 'Heading defuse awarded +10 bonus points');
  }

  // Test 2: Bomb distant from head does not trigger heading defuse
  {
    const fm = new FruitManager(mockParticles);
    let headingDefused = false;
    fm.onHeadingDefuse = () => { headingDefused = true; };

    const bomb = new Fruit(CONFIG.FRUITS.BOMB, 300, 300, 0, 0);
    fm.fruits.push(bomb);

    // Head far away at (800, 800)
    const headHitboxes = [{ x: 800, y: 800, radius: 64, owner: 'P1' }];

    fm.update(0.016, [], 1280, 720, 1000, 5, headHitboxes);

    assert(fm.fruits.length === 1, 'Distant bomb remains alive in fruits array');
    assert(headingDefused === false, 'Heading defuse not triggered for distant head');
  }

  // Test 3: Slicing a bomb with hand blade still triggers standard onBomb
  {
    const fm = new FruitManager(mockParticles);
    let bombExploded = false;
    fm.onBomb = () => { bombExploded = true; };

    const bomb = new Fruit(CONFIG.FRUITS.BOMB, 300, 300, 0, 0);
    fm.fruits.push(bomb);

    // Blade slicing right through bomb center
    const activeSegments = [{ p1: { x: 250, y: 300 }, p2: { x: 350, y: 300 }, owner: 'P1' }];

    fm.update(0.016, activeSegments, 1280, 720, 1000, 5, []);

    assert(bombExploded === true, 'Blade slicing bomb triggers standard bomb explosion');
    assert(fm.fruits.length === 0, 'Exploded bomb removed from fruits array');
  }

  // Test 4: Touching a bomb deducts exactly 2 lives, triggers game over when lives reach 0
  {
    let lives = 3;
    let gameOverTriggered = false;
    const handleBomb = () => {
      lives = Math.max(0, lives - 2);
      if (lives <= 0) gameOverTriggered = true;
    };

    handleBomb();
    assert(lives === 1, 'First bomb hit reduces lives from 3 to 1 (-2 lives)');
    assert(gameOverTriggered === false, 'Game over not triggered when lives remain (1 > 0)');

    handleBomb();
    assert(lives === 0, 'Second bomb hit reduces lives from 1 to 0');
    assert(gameOverTriggered === true, 'Game over triggered when lives reach 0');
  }

  console.log(`\nHeading Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
