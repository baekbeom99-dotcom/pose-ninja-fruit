import { checkSegmentCircleCollision, distance } from '../js/game/collision.js';

function runTests() {
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // Test 1: Direct slice right through the circle center
  {
    const p1 = { x: 50, y: 100 };
    const p2 = { x: 150, y: 100 };
    const circle = { x: 100, y: 100, radius: 20 };
    const result = checkSegmentCircleCollision(p1, p2, circle);

    assert(result.hit === true, 'Direct slice hits circle center');
    assert(Math.abs(result.closestPoint.x - 100) < 0.001, 'Closest point X is 100');
    assert(Math.abs(result.closestPoint.y - 100) < 0.001, 'Closest point Y is 100');
    assert(Math.abs(result.normal.x - 0) < 0.001, 'Normal X is 0');
    assert(Math.abs(result.normal.y - 1) < 0.001, 'Normal Y is 1');
  }

  // Test 2: Grazing slice (tangent or within radius)
  {
    const p1 = { x: 50, y: 115 };
    const p2 = { x: 150, y: 115 };
    const circle = { x: 100, y: 100, radius: 20 };
    const result = checkSegmentCircleCollision(p1, p2, circle);

    assert(result.hit === true, 'Grazing slice within radius hits');
  }

  // Test 3: Segment that completely misses the circle
  {
    const p1 = { x: 50, y: 150 };
    const p2 = { x: 150, y: 150 };
    const circle = { x: 100, y: 100, radius: 20 };
    const result = checkSegmentCircleCollision(p1, p2, circle);

    assert(result.hit === false, 'Distant segment misses circle');
  }

  // Test 4: Line passes through circle, but segment stops before reaching it
  {
    const p1 = { x: 10, y: 100 };
    const p2 = { x: 50, y: 100 };
    const circle = { x: 100, y: 100, radius: 20 };
    const result = checkSegmentCircleCollision(p1, p2, circle);

    assert(result.hit === false, 'Short segment stopping before circle misses');
  }

  // Test 5: Diagonal slice angle calculation
  {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 100 };
    const circle = { x: 50, y: 50, radius: 10 };
    const result = checkSegmentCircleCollision(p1, p2, circle);

    assert(result.hit === true, 'Diagonal slice hits');
    assert(Math.abs(result.cutAngle - (Math.PI / 4)) < 0.01, 'Cut angle is 45 degrees');
  }

  // Test 6: Stationary hand touch (p1 == p2 right inside circle)
  {
    const p1 = { x: 105, y: 105 };
    const p2 = { x: 105, y: 105 };
    const circle = { x: 100, y: 100, radius: 20 };
    const result = checkSegmentCircleCollision(p1, p2, circle);

    assert(result.hit === true, 'Stationary touch inside circle hits');
  }

  // Test 7: Touch padding enables grazing touch-to-slice outside base radius
  {
    const p1 = { x: 125, y: 100 };
    const p2 = { x: 125, y: 100 };
    const circle = { x: 100, y: 100, radius: 20 }; // distance = 25 > 20
    const noPad = checkSegmentCircleCollision(p1, p2, circle, 0);
    const withPad = checkSegmentCircleCollision(p1, p2, circle, 28); // 20 + 28 = 48 >= 25

    assert(noPad.hit === false, 'No touch padding misses at distance 25');
    assert(withPad.hit === true, 'Touch padding 28 detects contact at distance 25');
  }

  console.log(`\nTest Summary: ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
