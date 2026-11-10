/**
 * Fruit Wave Spawner and Slicing Collision Coordinator
 * Supports multi-directional spawn arcs, theme rendering, and Ultimate Move screen clearing.
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
    this.currentTheme = 'CLAYMORPHISM';

    // Callbacks to UI and GameEngine
    this.onScore = () => {};
    this.onMiss = () => {};
    this.onBomb = () => {};
    this.onCombo = () => {};
    this.onHeart = () => {};

    this.sliceHistory = [];
  }

  setTheme(themeId) {
    this.currentTheme = themeId;
  }

  reset() {
    this.fruits = [];
    this.halfFruits = [];
    this.spawnTimer = 0;
    this.nextSpawnInterval = 1.4;
    this.sliceHistory = [];
  }

  spawnWave(canvasWidth, canvasHeight, currentLives = 5) {
    const patternType = Math.floor(Math.random() * 5);
    const fruitKeys = Object.keys(CONFIG.FRUITS).filter(
      k => k !== 'BOMB' && k !== 'HEART_BONUS'
    );

    const getRandomConfig = () => {
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
      case 0: {
        // Double Cross
        const cfg1 = getRandomConfig();
        const x1 = canvasWidth * 0.1;
        const y1 = canvasHeight + cfg1.radius;
        const targetH1 = canvasHeight * (0.15 + Math.random() * 0.25);
        const vy1 = -Math.sqrt(2 * CONFIG.PHYSICS.GRAVITY * (y1 - targetH1));
        const vx1 = 300 + Math.random() * 200;
        this.fruits.push(new Fruit(cfg1, x1, y1, vx1, vy1, this.currentTheme));

        const cfg2 = getRandomConfig();
        const x2 = canvasWidth * 0.9;
        const y2 = canvasHeight + cfg2.radius;
        const targetH2 = canvasHeight * (0.15 + Math.random() * 0.25);
        const vy2 = -Math.sqrt(2 * CONFIG.PHYSICS.GRAVITY * (y2 - targetH2));
        const vx2 = -(300 + Math.random() * 200);
        this.fruits.push(new Fruit(cfg2, x2, y2, vx2, vy2, this.currentTheme));
        break;
      }

      case 1: {
        // Left Side Wall
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const cfg = getRandomConfig();
          const x = -cfg.radius - 10;
          const y = canvasHeight * (0.45 + Math.random() * 0.35);
          const vx = 400 + Math.random() * 280;
          const vy = -(320 + Math.random() * 260);
          this.fruits.push(new Fruit(cfg, x, y, vx, vy, this.currentTheme));
        }
        break;
      }

      case 2: {
        // Right Side Wall
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const cfg = getRandomConfig();
          const x = canvasWidth + cfg.radius + 10;
          const y = canvasHeight * (0.45 + Math.random() * 0.35);
          const vx = -(400 + Math.random() * 280);
          const vy = -(320 + Math.random() * 260);
          this.fruits.push(new Fruit(cfg, x, y, vx, vy, this.currentTheme));
        }
        break;
      }

      default: {
        // Upward Multi-Fruit Scatter
        const waveCount = 2 + Math.floor(Math.random() * 3);
        const margin = canvasWidth * 0.12;

        for (let i = 0; i < waveCount; i++) {
          const cfg = getRandomConfig();
          const x = margin + Math.random() * (canvasWidth - margin * 2);
          const y = canvasHeight + cfg.radius + 10;

          const targetHeight = canvasHeight * (0.12 + Math.random() * 0.38);
          const dy = y - targetHeight;
          const vy = -Math.sqrt(2 * CONFIG.PHYSICS.GRAVITY * dy);

          const centerX = canvasWidth / 2;
          const dirX = (centerX - x) / canvasWidth;
          const vx = dirX * (240 + Math.random() * 280) + (Math.random() - 0.5) * 120;

          this.fruits.push(new Fruit(cfg, x, y, vx, vy, this.currentTheme));
        }
        break;
      }
    }

    this.nextSpawnInterval =
      CONFIG.GAME.SPAWN_INTERVAL_MIN +
      Math.random() * (CONFIG.GAME.SPAWN_INTERVAL_MAX - CONFIG.GAME.SPAWN_INTERVAL_MIN);
  }

  update(dt, activeSegments, canvasWidth, canvasHeight, currentTime, currentLives) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnTimer = 0;
      this.spawnWave(canvasWidth, canvasHeight, currentLives);
    }

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      fruit.update(dt);

      if (fruit.isMissed) {
        if (fruit.type !== 'BOMB' && fruit.type !== 'HEART_BONUS') {
          this.onMiss(fruit);
        }
        this.fruits.splice(i, 1);
        continue;
      }

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

    for (let i = this.halfFruits.length - 1; i >= 0; i--) {
      const half = this.halfFruits[i];
      half.update(dt);
      if (half.isDead) {
        this.halfFruits.splice(i, 1);
      }
    }

    this.sliceHistory = this.sliceHistory.filter(
      t => currentTime - t <= CONFIG.GAME.COMBO_WINDOW_MS
    );
  }

  /**
   * Slices all fruits on screen simultaneously during an Ultimate Move!
   * Bombs are vaporized safely without detonating.
   */
  sliceAllFruits() {
    let slicedCount = 0;
    const isPixel = this.currentTheme === 'PIXEL_ART';

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      if (fruit.isDead) continue;

      if (fruit.type === 'BOMB') {
        // Vaporize bomb with sparks
        this.particles.createBladeSparks(fruit.x, fruit.y, '#facc15');
        this.fruits.splice(i, 1);
        continue;
      }

      if (fruit.type === 'HEART_BONUS') {
        this.particles.createHeartHealParticles(fruit.x, fruit.y);
        this.onHeart(fruit, { x: fruit.x, y: fruit.y });
      } else {
        const cutAngle = (Math.random() - 0.5) * Math.PI;
        const normal = { x: Math.sin(cutAngle), y: -Math.cos(cutAngle) };
        this.particles.createFruitSplash(fruit.x, fruit.y, fruit.config.juiceColor, normal, isPixel);
        const halves = fruit.slice(cutAngle, normal);
        this.halfFruits.push(...halves);
        this.onScore(fruit.points * 2, fruit, { x: fruit.x, y: fruit.y });
      }

      slicedCount++;
      this.fruits.splice(i, 1);
    }

    return slicedCount;
  }

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

    soundManager.playSlice();
    const isPixel = this.currentTheme === 'PIXEL_ART';
    this.particles.createFruitSplash(hitPoint.x, hitPoint.y, fruit.config.juiceColor, normal, isPixel);

    const halves = fruit.slice(cutAngle, normal);
    this.halfFruits.push(...halves);

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
    this.particles.drawSplatters(ctx);
    this.fruits.forEach(f => f.draw(ctx));
    this.halfFruits.forEach(h => h.draw(ctx));
    this.particles.drawParticles(ctx);
  }
}
