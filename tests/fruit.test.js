import { Fruit, HalfFruit, FruitRenderer } from '../js/game/fruit.js';
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

  // Test 1: Banana radius has been enlarged for 3x thickness
  {
    const bananaCfg = CONFIG.FRUITS.BANANA;
    assert(bananaCfg.radius >= 90, `Banana radius is enlarged (${bananaCfg.radius}px >= 90px)`);
  }

  // Test 2: Slicing fruit creates two HalfFruit entities
  {
    const melonCfg = CONFIG.FRUITS.WATERMELON;
    const fruit = new Fruit(melonCfg, 500, 400, 50, -400);
    const halves = fruit.slice(0.5, { x: 0, y: 1 });

    assert(fruit.isDead === true, 'Original fruit marked dead after slice');
    assert(halves.length === 2, 'Slice creates exactly 2 halves');
    assert(halves[0].isLeftHalf === true, 'Half 1 is left half');
    assert(halves[1].isLeftHalf === false, 'Half 2 is right half');
  }

  // Test 3: Slicing a bomb returns empty halves
  {
    const bombCfg = CONFIG.FRUITS.BOMB;
    const bomb = new Fruit(bombCfg, 500, 400, 0, -300);
    const halves = bomb.slice(0, { x: 0, y: 1 });

    assert(bomb.isDead === true, 'Bomb marked dead on slice');
    assert(halves.length === 0, 'Bomb yields no halves');
  }

  // Test 4: FruitRenderer exports all expected fruit methods
  {
    assert(typeof FruitRenderer.drawWatermelon === 'function', 'drawWatermelon exists');
    assert(typeof FruitRenderer.drawApple === 'function', 'drawApple exists');
    assert(typeof FruitRenderer.drawOrange === 'function', 'drawOrange exists');
    assert(typeof FruitRenderer.drawBanana === 'function', 'drawBanana exists');
    assert(typeof FruitRenderer.drawPineapple === 'function', 'drawPineapple exists');
    assert(typeof FruitRenderer.drawBomb === 'function', 'drawBomb exists');
    assert(typeof FruitRenderer.drawHeartBonus === 'function', 'drawHeartBonus exists');
  }

  console.log(`\nFruit Tests: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
