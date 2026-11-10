/**
 * Fruit Wave Spawner and Slicing Collision Coordinator
 * Coordinates fruit spawning, physics updates, blade collision detection, and combo tracking
 */
import { CONFIG } from '../config.js';
import { Fruit, HalfFruit } from './fruit.js';
import { checkSegmentCircleCollision } from './collision.js';
import { soundManager } from '../audio/soundManager.js';

export class FruitManager {
  constructor(particleSystem) {
    this.particles = particleSystem;
    this.fruits = [];
    this.halfFruits = [];
    this.spawnTimer = 0;
    this.nextSpawnInterval = 2.0;

    // Callbacks to UI and GameEngine
    this.onScore = () => {};
    this.onMiss = () => {};
    this.onBomb = () => {};
    this.onCombo = () => {};

    // Combo tracking window
    this.sliceHistory = []; // Array of timestamps
  }

  reset() {
    this.fruits = [];
    this.halfFruits = [];
    this.spawnTimer = 0;
    this.nextSpawnInterval = 1.5;
    this.sliceHistory = [];
  }

  /**
   * Spawns a wave of 1 to 4 fruits with occasional bombs
   */
  spawnWave(canvasWidth, canvasHeight) {
    const waveCount = 1 + Math.floor(Math.random() * 3);
    const fruitKeys = Object.keys(CONFIG.FRUITS).filter(k => k !== 'BOMB');

    for (let i = 0; i < waveCount; i++) {
      // Decide if this fruit is a bomb
      const isBomb = Math.random() < CONFIG.GAME.BOMB_PROBABILITY;
      const fruitConfig = isBomb
        ? CONFIG.FRUITS.BOMB
        : CONFIG.FRUITS[fruitKeys[Math.floor(Math.random() * fruitKeys.length)]];

      // Spawn position along bottom edge (margin 15%)
      const margin = canvasWidth * 0.15;
      const x = margin + Math.random() * (canvasWidth - margin * 2);
      const y = canvasHeight + fruitConfig.radius + 10;

      // Launch velocity: target mid/upper screen height
      const targetHeight = canvasHeight * (0.18 + Math.random() * 0.35);
      const dy = targetHeight - y; // negative number
      // v^2 = 2 * g * h => vy = -sqrt(2 * g * |dy|)
      const vy = -Math.sqrt(2 * CONFIG.PHYSICS.GRAVITY * Math.abs(dy));

      // Horizontal velocity towards screen center
      const centerX = canvasWidth / 2;
      const dirX = (centerX - x) / canvasWidth;
      const vx = dirX * (220 + Math.random() * 260) + (Math.random() - 0.5) * 80;

      this.fruits.push(new Fruit(fruitConfig, x, y, vx, vy));
    }

    // Set next spawn interval
    this.nextSpawnInterval =
      CONFIG.GAME.SPAWN_INTERVAL_MIN +
      Math.random() * (CONFIG.GAME.SPAWN_INTERVAL_MAX - CONFIG.GAME.SPAWN_INTERVAL_MIN);
  }

  /**
   * Main physics and collision update loop
   */
  update(dt, activeSegments, canvasWidth, canvasHeight, currentTime) {
    // 1. Spawner Timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnTimer = 0;
      this.spawnWave(canvasWidth, canvasHeight);
    }

    // 2. Update active fruits & check for misses
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      fruit.update(dt);

      if (fruit.isMissed) {
        if (fruit.type !== 'BOMB') {
          this.onMiss(fruit);
        }
        this.fruits.splice(i, 1);
        continue;
      }

      // Check collision with active blade segments
      if (!fruit.isDead && activeSegments.length > 0) {
        for (const seg of activeSegments) {
          const col = checkSegmentCircleCollision(seg.p1, seg.p2, fruit);
          if (col.hit) {
            this._handleSlice(fruit, col.cutAngle, col.normal, col.closestPoint, currentTime);
            this.fruits.splice(i, 1);
            break;
          }
        }
      }
    }

    // 3. Update sliced halves
    for (let i = this.halfFruits.length - 1; i >= 0; i--) {
      const half = this.halfFruits[i];
      half.update(dt);
      if (half.isDead) {
        this.halfFruits.splice(i, 1);
      }
    }

    // 4. Clean up old combo timestamps
    this.sliceHistory = this.sliceHistory.filter(
      t => currentTime - t <= CONFIG.GAME.COMBO_WINDOW_MS
    );
  }

  /**
   * Handles cutting a fruit or detonating a bomb
   */
  _handleSlice(fruit, cutAngle, normal, hitPoint, currentTime) {
    if (fruit.type === 'BOMB') {
      soundManager.playBomb();
      this.particles.createBombExplosion(hitPoint.x, hitPoint.y);
      this.onBomb(fruit);
      return;
    }

    // Normal fruit sliced
    soundManager.playSlice();
    this.particles.createFruitSplash(hitPoint.x, hitPoint.y, fruit.config.juiceColor, normal);

    // Split into 2 halves
    const halves = fruit.slice(cutAngle, normal);
    this.halfFruits.push(...halves);

    // Track combo window
    this.sliceHistory.push(currentTime);
    const comboCount = this.sliceHistory.length;

    let pointsAwarded = fruit.points;
    if (comboCount >= 3) {
      const comboBonus = comboCount * 2;
      pointsAwarded += comboBonus;
      soundManager.playCombo(comboCount);
      this.onCombo(comboCount, comboBonus);
    }

    this.onScore(pointsAwarded, fruit, hitPoint);
  }

  draw(ctx) {
    // Draw background juice splatters
    this.particles.drawSplatters(ctx);

    // Draw intact fruits
    this.fruits.forEach(f => f.draw(ctx));

    // Draw sliced fruit halves
    this.halfFruits.forEach(h => h.draw(ctx));

    // Draw flying juice droplets & sparks
    this.particles.drawParticles(ctx);
  }
}
