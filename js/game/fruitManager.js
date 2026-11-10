/**
 * Fruit Wave Spawner and Slicing Collision Coordinator
 * Features multi-directional spawn arcs (Bottom, Left wall, Right wall, Cross-cut)
 * to maximize player movement and full-body workout.
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
    this.nextSpawnInterval = 1.6;

    // Callbacks to UI and GameEngine
    this.onScore = () => {};
    this.onMiss = () => {};
    this.onBomb = () => {};
    this.onCombo = () => {};
    this.onHeart = () => {};

    // Combo tracking window
    this.sliceHistory = []; // Array of timestamps
  }

  reset() {
    this.fruits = [];
    this.halfFruits = [];
    this.spawnTimer = 0;
    this.nextSpawnInterval = 1.4;
    this.sliceHistory = [];
  }

  /**
   * Spawns waves with diverse dynamic launch trajectories:
   * 1. Standard upward arc
   * 2. Left-to-right cross swing
   * 3. Right-to-left cross swing
   * 4. Side wall horizontal fling
   * 5. Double cross-cut (left & right simultaneous launch)
   */
  spawnWave(canvasWidth, canvasHeight, currentLives = 5) {
    const patternType = Math.floor(Math.random() * 5);
    const fruitKeys = Object.keys(CONFIG.FRUITS).filter(
      k => k !== 'BOMB' && k !== 'HEART_BONUS'
    );

    // Helper to get random item config
    const getRandomConfig = () => {
      // Bonus heart appearance rate increases if player is damaged
      const heartChance = currentLives < 5 
        ? CONFIG.GAME.HEART_BONUS_PROBABILITY * 1.5 
        : CONFIG.GAME.HEART_BONUS_PROBABILITY;

      if (Math.random() < heartChance) {
        return CONFIG.FRUITS.HEART_BONUS;
      }

      if (Math.random() < CONFIG.GAME.BOMB_PROBABILITY) {
        return CONFIG.FRUITS.BOMB;
      }

      const key = fruitKeys[Math.floor(Math.random() * fruitKeys.length)];
      return CONFIG.FRUITS[key];
    };

    switch (patternType) {
      // Pattern 0: Double Cross (Left & Right simultaneously - great workout!)
      case 0: {
        // Left fruit flying towards right
        const cfg1 = getRandomConfig();
        const x1 = canvasWidth * 0.1;
        const y1 = canvasHeight + cfg1.radius;
        const targetH1 = canvasHeight * (0.15 + Math.random() * 0.25);
        const vy1 = -Math.sqrt(2 * CONFIG.PHYSICS.GRAVITY * (y1 - targetH1));
        const vx1 = 300 + Math.random() * 200;
        this.fruits.push(new Fruit(cfg1, x1, y1, vx1, vy1));

        // Right fruit flying towards left
        const cfg2 = getRandomConfig();
        const x2 = canvasWidth * 0.9;
        const y2 = canvasHeight + cfg2.radius;
        const targetH2 = canvasHeight * (0.15 + Math.random() * 0.25);
        const vy2 = -Math.sqrt(2 * CONFIG.PHYSICS.GRAVITY * (y2 - targetH2));
        const vx2 = -(300 + Math.random() * 200);
        this.fruits.push(new Fruit(cfg2, x2, y2, vx2, vy2));
        break;
      }

      // Pattern 1: Side Wall Launch from Left edge
      case 1: {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const cfg = getRandomConfig();
          const x = -cfg.radius - 10;
          const y = canvasHeight * (0.45 + Math.random() * 0.35);
          const vx = 400 + Math.random() * 280;
          const vy = -(320 + Math.random() * 260);
          this.fruits.push(new Fruit(cfg, x, y, vx, vy));
        }
        break;
      }

      // Pattern 2: Side Wall Launch from Right edge
      case 2: {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const cfg = getRandomConfig();
          const x = canvasWidth + cfg.radius + 10;
          const y = canvasHeight * (0.45 + Math.random() * 0.35);
          const vx = -(400 + Math.random() * 280);
          const vy = -(320 + Math.random() * 260);
          this.fruits.push(new Fruit(cfg, x, y, vx, vy));
        }
        break;
      }

      // Pattern 3 & 4: Upward Multi-Fruit Scatter Wave
      default: {
        const waveCount = 2 + Math.floor(Math.random() * 3);
        const margin = canvasWidth * 0.12;

        for (let i = 0; i < waveCount; i++) {
          const cfg = getRandomConfig();
          const x = margin + Math.random() * (canvasWidth - margin * 2);
          const y = canvasHeight + cfg.radius + 10;

          // Target different heights (some low, some very high so player reaches up)
          const targetHeight = canvasHeight * (0.12 + Math.random() * 0.38);
          const dy = y - targetHeight;
          const vy = -Math.sqrt(2 * CONFIG.PHYSICS.GRAVITY * dy);

          const centerX = canvasWidth / 2;
          const dirX = (centerX - x) / canvasWidth;
          const vx = dirX * (240 + Math.random() * 280) + (Math.random() - 0.5) * 120;

          this.fruits.push(new Fruit(cfg, x, y, vx, vy));
        }
        break;
      }
    }

    // Interval between waves
    this.nextSpawnInterval =
      CONFIG.GAME.SPAWN_INTERVAL_MIN +
      Math.random() * (CONFIG.GAME.SPAWN_INTERVAL_MAX - CONFIG.GAME.SPAWN_INTERVAL_MIN);
  }

  /**
   * Main physics and collision update loop
   */
  update(dt, activeSegments, canvasWidth, canvasHeight, currentTime, currentLives) {
    // 1. Spawner Timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnTimer = 0;
      this.spawnWave(canvasWidth, canvasHeight, currentLives);
    }

    // 2. Update active fruits & check for misses
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      fruit.update(dt);

      if (fruit.isMissed) {
        // Only missed regular fruits deduct life (not bombs or bonus hearts)
        if (fruit.type !== 'BOMB' && fruit.type !== 'HEART_BONUS') {
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
   * Handles cutting a fruit, detonating a bomb, or slicing a heart bonus
   */
  _handleSlice(fruit, cutAngle, normal, hitPoint, currentTime) {
    if (fruit.type === 'BOMB') {
      soundManager.playBomb();
      this.particles.createBombExplosion(hitPoint.x, hitPoint.y);
      this.onBomb(fruit);
      return;
    }

    if (fruit.type === 'HEART_BONUS') {
      soundManager.playHeartRecovery();
      this.particles.createHeartHealParticles(hitPoint.x, hitPoint.y);
      this.onHeart(fruit, hitPoint);
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

    // Draw intact fruits & heart bonuses
    this.fruits.forEach(f => f.draw(ctx));

    // Draw sliced fruit halves
    this.halfFruits.forEach(h => h.draw(ctx));

    // Draw flying juice droplets, shockwaves & sparks
    this.particles.drawParticles(ctx);
  }
}
