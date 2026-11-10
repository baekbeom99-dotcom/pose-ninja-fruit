/**
 * Fruit Wave Spawner and Slicing Collision Coordinator
 * Controls onscreen fruit density based on player progression:
 * - <= 10 sliced: Exactly 1 fruit onscreen
 * - <= 20 sliced: At most 2 fruits onscreen
 * - > 20 sliced: At most 3 fruits onscreen
 * Projectile velocity scaled to 75% for generous reactability.
 */
import { CONFIG } from '../config.js';
import { Fruit, HalfFruit } from './fruit.js';
import { Fish, HalfFish } from './fish.js';
import { checkSegmentCircleCollision } from './collision.js';
import { soundManager } from '../audio/soundManager.js';

export class FruitManager {
  constructor(particleSystem) {
    this.particles = particleSystem;
    this.fruits = [];
    this.halfFruits = [];
    this.spawnTimer = 0;
    this.nextSpawnInterval = 1.0;
    this.totalSlicedCount = 0;
    this.gameMode = 'CLASSIC'; // 'CLASSIC', 'DOCTOR_STRANGE', 'UFO_FISH'

    // Callbacks to UI and GameEngine
    this.onScore = () => {};
    this.onMiss = () => {};
    this.onBomb = () => {};
    this.onCombo = () => {};
    this.onHeart = () => {};
    this.onHeadingDefuse = () => {};

    this.sliceHistory = [];
  }

  setTheme(themeId) {
    // Theme switching disabled
  }

  setGameMode(mode = 'CLASSIC') {
    this.gameMode = mode;
  }

  reset() {
    this.fruits = [];
    this.halfFruits = [];
    this.spawnTimer = 0;
    this.nextSpawnInterval = 0.8;
    this.sliceHistory = [];
    this.totalSlicedCount = 0;
  }

  /**
   * Maximum fruits allowed simultaneously on screen based on sliced count
   */
  getMaxAllowedOnscreen() {
    if (this.totalSlicedCount < 10) return 1;
    if (this.totalSlicedCount < 20) return 2;
    return 3;
  }

  /**
   * Spawns new fruits or space fish respecting the maximum onscreen density.
   * Routes to mode-specific spawn routines (Classic, Doctor Strange workout, UFO Flying Fish).
   */
  spawnWave(canvasWidth, canvasHeight, currentLives = 5) {
    const maxAllowed = this.getMaxAllowedOnscreen();
    const availableSlots = maxAllowed - this.fruits.length;

    if (availableSlots <= 0) {
      return;
    }

    if (this.gameMode === 'UFO_FISH') {
      this._spawnFishWave(canvasWidth, canvasHeight, availableSlots, currentLives);
    } else if (this.gameMode === 'DOCTOR_STRANGE') {
      this._spawnDoctorStrangeWave(canvasWidth, canvasHeight, availableSlots, currentLives);
    } else {
      this._spawnClassicWave(canvasWidth, canvasHeight, availableSlots, currentLives);
    }

    this.nextSpawnInterval =
      CONFIG.GAME.SPAWN_INTERVAL_MIN +
      Math.random() * (CONFIG.GAME.SPAWN_INTERVAL_MAX - CONFIG.GAME.SPAWN_INTERVAL_MIN);
  }

  /* ---------------- 1. UFO FRUIT MODE (Zero-G Trajectories with Existing Fruits) ---------------- */
  _spawnFishWave(canvasWidth, canvasHeight, availableSlots, currentLives) {
    const screenScale = Math.max(0.55, Math.min(2.0, Math.min(canvasWidth / 1280, canvasHeight / 720)));
    const fruitKeys = Object.keys(CONFIG.FRUITS).filter(
      k => k !== 'BOMB' && k !== 'HEART_BONUS'
    );

    const getRandomFruitConfig = () => {
      const heartChance = currentLives < 5
        ? CONFIG.GAME.HEART_BONUS_PROBABILITY * 1.5
        : CONFIG.GAME.HEART_BONUS_PROBABILITY;

      if (Math.random() < heartChance) return CONFIG.FRUITS.HEART_BONUS;
      if (Math.random() < CONFIG.GAME.BOMB_PROBABILITY) return CONFIG.FRUITS.BOMB;

      const key = fruitKeys[Math.floor(Math.random() * fruitKeys.length)];
      return CONFIG.FRUITS[key];
    };

    let remainingSlots = availableSlots;
    while (remainingSlots > 0) {
      const cfg = getRandomFruitConfig();
      const r = cfg.radius * screenScale;
      const pathTypeRand = Math.random();

      if (pathTypeRand < 0.45) {
        // Path 1: Sinuous Sine Wave (좌우 파동 유영)
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? -r - 20 : canvasWidth + r + 20;
        const startY = canvasHeight * (0.22 + Math.random() * 0.55);
        const speedX = fromLeft ? (170 + Math.random() * 110) : -(170 + Math.random() * 110);

        this.fruits.push(
          new Fish(cfg, startX, startY, 'SINE_WAVE', {
            vx: speedX,
            amplitude: 65 + Math.random() * 75,
            frequency: 1.8 + Math.random() * 1.2,
            phase: Math.random() * Math.PI * 2
          }, screenScale)
        );
      } else if (pathTypeRand < 0.70) {
        // Path 2: Lissajous Figure-8 Patrol (8자 순찰 비행)
        const startAngle = Math.random() * Math.PI * 2;
        const cx = canvasWidth * 0.5;
        const cy = canvasHeight * 0.45;
        const amp = canvasWidth * 0.28;

        this.fruits.push(
          new Fish(cfg, cx, cy, 'LISSAJOUS_8', {
            centerX: cx,
            centerY: cy,
            amplitude: amp,
            frequency: 1.4 + Math.random() * 0.6,
            phase: startAngle
          }, screenScale)
        );
      } else if (pathTypeRand < 0.88) {
        // Path 3: Pulsing Dash & Glide (제트 분사 유영)
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? -r - 20 : canvasWidth + r + 20;
        const startY = canvasHeight * (0.25 + Math.random() * 0.50);
        const vx = fromLeft ? (200 + Math.random() * 100) : -(200 + Math.random() * 100);
        const vy = (Math.random() - 0.5) * 80;

        this.fruits.push(
          new Fish(cfg, startX, startY, 'PULSE_DASH', {
            vx,
            vy,
            frequency: 2.2 + Math.random() * 1.0
          }, screenScale)
        );
      } else {
        // Path 4: Screen Ricochet (무중력 반사 유영)
        const startX = Math.random() < 0.5 ? 50 : canvasWidth - 50;
        const startY = canvasHeight * (0.3 + Math.random() * 0.4);
        const speed = 220 + Math.random() * 80;
        const angle = Math.random() * Math.PI * 2;

        this.fruits.push(
          new Fish(cfg, startX, startY, 'RICOCHET', {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed
          }, screenScale)
        );
      }

      remainingSlots--;
    }
  }

  /* ---------------- 2. DOCTOR STRANGE MODE (High-Intensity Workout Trajectories) ---------------- */
  _spawnDoctorStrangeWave(canvasWidth, canvasHeight, availableSlots, currentLives) {
    const screenScale = Math.max(0.55, Math.min(2.0, Math.min(canvasWidth / 1280, canvasHeight / 720)));
    const fruitKeys = Object.keys(CONFIG.FRUITS).filter(
      k => k !== 'BOMB' && k !== 'HEART_BONUS'
    );

    const getRandomConfig = () => {
      const heartChance = currentLives < 5 
        ? CONFIG.GAME.HEART_BONUS_PROBABILITY * 1.5 
        : CONFIG.GAME.HEART_BONUS_PROBABILITY;

      if (Math.random() < heartChance) return CONFIG.FRUITS.HEART_BONUS;
      if (Math.random() < CONFIG.GAME.BOMB_PROBABILITY) return CONFIG.FRUITS.BOMB;
      const key = fruitKeys[Math.floor(Math.random() * fruitKeys.length)];
      return CONFIG.FRUITS[key];
    };

    const g = CONFIG.PHYSICS.GRAVITY;
    const calcLaunchVy = (startY, targetApexY) => {
      const dy = Math.max(120, startY - targetApexY);
      return -Math.sqrt(2 * g * dy);
    };

    let remainingSlots = availableSlots;

    while (remainingSlots > 0) {
      if (remainingSlots >= 2 && Math.random() < 0.60) {
        // Doctor Strange Workout Formation 1: High Lateral Scissor Cross (양팔 대각선 회전 베기)
        const cfg1 = getRandomConfig();
        const cfg2 = getRandomConfig();
        const startY1 = canvasHeight + cfg1.radius * screenScale + 15;
        const startY2 = canvasHeight + cfg2.radius * screenScale + 15;
        const targetApex1 = canvasHeight * (0.06 + Math.random() * 0.08); // High top
        const targetApex2 = canvasHeight * (0.12 + Math.random() * 0.10);

        // Sweeping widely across opposite sides to force tilted/vertical beam angles
        this.fruits.push(new Fruit(cfg1, canvasWidth * 0.08, startY1, 280 + Math.random() * 90, calcLaunchVy(startY1, targetApex1), screenScale));
        this.fruits.push(new Fruit(cfg2, canvasWidth * 0.92, startY2, -(280 + Math.random() * 90), calcLaunchVy(startY2, targetApex2), screenScale));
        remainingSlots -= 2;
        continue;
      }

      // Single High-Movement Projectile:
      const cfg = getRandomConfig();
      const style = Math.floor(Math.random() * 4);

      if (style === 0) {
        // Overhead Rainbow Beam Sweep (머리 위 수평 빔 유도 아치)
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? canvasWidth * 0.05 : canvasWidth * 0.95;
        const startY = canvasHeight + cfg.radius * screenScale + 15;
        const targetApex = canvasHeight * (0.05 + Math.random() * 0.08);
        const vy = calcLaunchVy(startY, targetApex);
        const tApex = -vy / g;
        const targetDist = canvasWidth * 0.78;
        const vx = fromLeft ? (targetDist / (2 * tApex)) : -(targetDist / (2 * tApex));
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      } else if (style === 1) {
        // Side Wall Diagonal Slingshot (벽면 고각 사격)
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? (-cfg.radius * screenScale - 10) : (canvasWidth + cfg.radius * screenScale + 10);
        const startY = canvasHeight * (0.42 + Math.random() * 0.25);
        const targetApex = canvasHeight * (0.08 + Math.random() * 0.10);
        const vy = calcLaunchVy(startY, targetApex);
        const vx = fromLeft ? (360 + Math.random() * 120) : -(360 + Math.random() * 120);
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      } else if (style === 2) {
        // High Scissor Pop (중앙 고각 솟구침)
        const startX = canvasWidth * (0.25 + Math.random() * 0.50);
        const startY = canvasHeight + cfg.radius * screenScale + 15;
        const targetApex = canvasHeight * (0.05 + Math.random() * 0.06); // Top 5%~11%
        const vy = calcLaunchVy(startY, targetApex);
        const vx = (Math.random() - 0.5) * 110;
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      } else {
        // Double Inward Sweeper (저공 런지 유도)
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? canvasWidth * 0.15 : canvasWidth * 0.85;
        const startY = canvasHeight + cfg.radius * screenScale + 15;
        const targetApex = canvasHeight * (0.12 + Math.random() * 0.12);
        const vy = calcLaunchVy(startY, targetApex);
        const vx = fromLeft ? (260 + Math.random() * 120) : -(260 + Math.random() * 120);
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      }

      remainingSlots--;
    }
  }

  /* ---------------- 3. CLASSIC NINJA MODE (High Ballistic Arcs) ---------------- */
  _spawnClassicWave(canvasWidth, canvasHeight, availableSlots, currentLives) {
    const screenScale = Math.max(0.55, Math.min(2.0, Math.min(canvasWidth / 1280, canvasHeight / 720)));
    const fruitKeys = Object.keys(CONFIG.FRUITS).filter(
      k => k !== 'BOMB' && k !== 'HEART_BONUS'
    );

    const getRandomConfig = () => {
      const heartChance = currentLives < 5 
        ? CONFIG.GAME.HEART_BONUS_PROBABILITY * 1.5 
        : CONFIG.GAME.HEART_BONUS_PROBABILITY;

      if (Math.random() < heartChance) return CONFIG.FRUITS.HEART_BONUS;
      if (Math.random() < CONFIG.GAME.BOMB_PROBABILITY) return CONFIG.FRUITS.BOMB;
      const key = fruitKeys[Math.floor(Math.random() * fruitKeys.length)];
      return CONFIG.FRUITS[key];
    };

    const g = CONFIG.PHYSICS.GRAVITY;
    const calcLaunchVy = (startY, targetApexY) => {
      const dy = Math.max(120, startY - targetApexY);
      return -Math.sqrt(2 * g * dy);
    };

    let remainingSlots = availableSlots;

    while (remainingSlots > 0) {
      if (remainingSlots >= 2 && Math.random() < 0.45) {
        const formation = Math.floor(Math.random() * 3);

        if (formation === 0) {
          const cfg1 = getRandomConfig();
          const cfg2 = getRandomConfig();
          const startX = canvasWidth * 0.5 + (Math.random() - 0.5) * 50;
          const startY = canvasHeight + Math.max(cfg1.radius, cfg2.radius) * screenScale + 15;
          const targetApex = canvasHeight * (0.07 + Math.random() * 0.10);
          const vy = calcLaunchVy(startY, targetApex);
          const spreadVx = 180 + Math.random() * 90;

          this.fruits.push(new Fruit(cfg1, startX - 25, startY, -spreadVx, vy * (0.97 + Math.random() * 0.06), screenScale));
          this.fruits.push(new Fruit(cfg2, startX + 25, startY, spreadVx, vy * (0.97 + Math.random() * 0.06), screenScale));
          remainingSlots -= 2;
          continue;
        } else if (formation === 1) {
          const cfg1 = getRandomConfig();
          const cfg2 = getRandomConfig();
          const startY1 = canvasHeight + cfg1.radius * screenScale + 15;
          const startY2 = canvasHeight + cfg2.radius * screenScale + 15;
          const targetApex = canvasHeight * (0.08 + Math.random() * 0.12);
          const vy1 = calcLaunchVy(startY1, targetApex);
          const vy2 = calcLaunchVy(startY2, targetApex);

          this.fruits.push(new Fruit(cfg1, canvasWidth * 0.12, startY1, 220 + Math.random() * 100, vy1, screenScale));
          this.fruits.push(new Fruit(cfg2, canvasWidth * 0.88, startY2, -(220 + Math.random() * 100), vy2, screenScale));
          remainingSlots -= 2;
          continue;
        } else {
          const cfg1 = getRandomConfig();
          const cfg2 = getRandomConfig();
          const startY = canvasHeight + 85 * screenScale;
          const targetApex1 = canvasHeight * (0.06 + Math.random() * 0.10);
          const targetApex2 = canvasHeight * (0.10 + Math.random() * 0.12);
          this.fruits.push(new Fruit(cfg1, canvasWidth * 0.22, startY, 200 + Math.random() * 90, calcLaunchVy(startY, targetApex1), screenScale));
          this.fruits.push(new Fruit(cfg2, canvasWidth * 0.78, startY, -(200 + Math.random() * 90), calcLaunchVy(startY, targetApex2), screenScale));
          remainingSlots -= 2;
          continue;
        }
      }

      const cfg = getRandomConfig();
      const style = Math.floor(Math.random() * 5);

      if (style === 0) {
        const startX = canvasWidth * (0.30 + Math.random() * 0.40);
        const startY = canvasHeight + cfg.radius * screenScale + 15;
        const targetApex = canvasHeight * (0.05 + Math.random() * 0.08);
        const vy = calcLaunchVy(startY, targetApex);
        const vx = (Math.random() - 0.5) * 70;
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      } else if (style === 1) {
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? canvasWidth * (0.08 + Math.random() * 0.15) : canvasWidth * (0.77 + Math.random() * 0.15);
        const startY = canvasHeight + cfg.radius * screenScale + 15;
        const targetApex = canvasHeight * (0.08 + Math.random() * 0.12);
        const vy = calcLaunchVy(startY, targetApex);
        const speedX = 220 + Math.random() * 160;
        const vx = fromLeft ? speedX : -speedX;
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      } else if (style === 2) {
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? canvasWidth * 0.04 : canvasWidth * 0.96;
        const startY = canvasHeight + cfg.radius * screenScale + 15;
        const targetApex = canvasHeight * (0.10 + Math.random() * 0.12);
        const vy = calcLaunchVy(startY, targetApex);
        const tApex = -vy / g;
        const targetDistance = canvasWidth * 0.72;
        const vx = fromLeft ? (targetDistance / (2 * tApex)) : -(targetDistance / (2 * tApex));
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      } else if (style === 3) {
        const fromLeft = Math.random() < 0.5;
        const startX = fromLeft ? (-cfg.radius * screenScale - 10) : (canvasWidth + cfg.radius * screenScale + 10);
        const startY = canvasHeight * (0.50 + Math.random() * 0.25);
        const targetApex = canvasHeight * (0.10 + Math.random() * 0.14);
        const vy = calcLaunchVy(startY, targetApex);
        const vx = fromLeft ? (320 + Math.random() * 140) : -(320 + Math.random() * 140);
        this.fruits.push(new Fruit(cfg, startX, startY, vx, vy, screenScale));
      } else {
        const startX = canvasWidth * (0.20 + Math.random() * 0.60);
        const startY = canvasHeight + cfg.radius * screenScale + 15;
        const targetApex = canvasHeight * (0.06 + Math.random() * 0.08);
        const vy = calcLaunchVy(startY, targetApex);
        const vx = (canvasWidth * 0.5 - startX) * 0.45 + (Math.random() - 0.5) * 80;
        const fruit = new Fruit(cfg, startX, startY, vx, vy, screenScale);
        fruit.angularVelocity = (Math.random() - 0.5) * 1.8;
        this.fruits.push(fruit);
      }

      remainingSlots--;
    }
  }

  update(dt, activeSegments, canvasWidth, canvasHeight, currentTime, currentLives, headHitboxes = []) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnInterval || this.fruits.length === 0) {
      this.spawnTimer = 0;
      this.spawnWave(canvasWidth, canvasHeight, currentLives);
    }

    // 1. Bomb Heading Detection (폭탄은 머리로 들이받아 안전하게 격파/디퓨즈!)
    if (headHitboxes && headHitboxes.length > 0) {
      for (let i = this.fruits.length - 1; i >= 0; i--) {
        const fruit = this.fruits[i];
        if (fruit.isDead) continue;
        if (fruit.type === 'BOMB' || fruit.type === 'ALIEN_BOMB') {
          let headed = false;
          for (const head of headHitboxes) {
            const dist = Math.hypot(fruit.x - head.x, fruit.y - head.y);
            if (dist <= fruit.radius + head.radius) {
              headed = true;
              this.fruits.splice(i, 1);
              this._handleBombHeading(fruit, head, currentTime);
              break;
            }
          }
          if (headed) continue;
        }
      }
    }

    const touchRadius = CONFIG.BLADE.TOUCH_RADIUS || 28;

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
          // Spatial optimization: skip segment if fruit is clearly too far
          const minX = Math.min(seg.p1.x, seg.p2.x) - fruit.radius - touchRadius;
          const maxX = Math.max(seg.p1.x, seg.p2.x) + fruit.radius + touchRadius;
          const minY = Math.min(seg.p1.y, seg.p2.y) - fruit.radius - touchRadius;
          const maxY = Math.max(seg.p1.y, seg.p2.y) + fruit.radius + touchRadius;
          if (fruit.x < minX || fruit.x > maxX || fruit.y < minY || fruit.y > maxY) {
            continue;
          }

          const col = checkSegmentCircleCollision(seg.p1, seg.p2, fruit, touchRadius);
          if (col.hit) {
            this._handleSlice(fruit, col.cutAngle, col.normal, col.closestPoint, currentTime, seg.owner || 'P1');
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

  sliceAllFruits(owner = 'P1') {
    let slicedCount = 0;

    // Doctor Strange Dimensional Portal Ultimate
    if (this.gameMode === 'DOCTOR_STRANGE') {
      soundManager.playPortalOpen();
      this.particles.createDoctorStrangePortal(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
    }

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      if (fruit.isDead) continue;

      if (fruit.type === 'BOMB' || fruit.type === 'ALIEN_BOMB') {
        this.particles.createBladeSparks(fruit.x, fruit.y, '#facc15');
        this.fruits.splice(i, 1);
        continue;
      }

      if (fruit.type === 'HEART_BONUS' || fruit.type === 'COSMIC_STAR') {
        this.particles.createHeartHealParticles(fruit.x, fruit.y);
        this.onHeart(fruit, { x: fruit.x, y: fruit.y }, owner);
      } else {
        const cutAngle = (Math.random() - 0.5) * Math.PI;
        const normal = { x: Math.sin(cutAngle), y: -Math.cos(cutAngle) };

        if (this.gameMode === 'UFO_FISH') {
          this.particles.createStarlightBubbles(fruit.x, fruit.y, fruit.config.juiceColor || '#38bdf8');
        } else {
          this.particles.createFruitSplash(fruit.x, fruit.y, fruit.config.juiceColor, normal, false);
        }

        const halves = fruit.slice(cutAngle, normal);
        this.halfFruits.push(...halves);
        this.totalSlicedCount++;
        this.onScore(fruit.points * 2, fruit, { x: fruit.x, y: fruit.y }, owner);
      }

      slicedCount++;
      this.fruits.splice(i, 1);
    }

    return slicedCount;
  }

  _handleSlice(fruit, cutAngle, normal, hitPoint, currentTime, owner = 'P1') {
    if (fruit.type === 'BOMB' || fruit.type === 'ALIEN_BOMB') {
      soundManager.playBomb();
      this.particles.createBombExplosion(hitPoint.x, hitPoint.y);
      this.onBomb(fruit, owner);
      return;
    }

    if (fruit.type === 'HEART_BONUS' || fruit.type === 'COSMIC_STAR') {
      soundManager.playHeartRecovery();
      this.particles.createHeartHealParticles(hitPoint.x, hitPoint.y);
      this.onHeart(fruit, hitPoint, owner);
      return;
    }

    if (this.gameMode === 'UFO_FISH') {
      soundManager.playCosmicFishSlice();
      this.particles.createStarlightBubbles(hitPoint.x, hitPoint.y, fruit.config.juiceColor || '#38bdf8');
    } else {
      soundManager.playSlice();
      this.particles.createFruitSplash(hitPoint.x, hitPoint.y, fruit.config.juiceColor, normal, false);
    }

    const halves = fruit.slice(cutAngle, normal);
    this.halfFruits.push(...halves);

    this.totalSlicedCount++;
    this.sliceHistory.push(currentTime);
    const comboCount = this.sliceHistory.length;

    let pointsAwarded = fruit.points;
    if (comboCount >= 3) {
      const comboBonus = comboCount * 2;
      pointsAwarded += comboBonus;
      soundManager.playCombo(comboCount);
      this.onCombo(comboCount, comboBonus, owner);
    }

    this.onScore(pointsAwarded, fruit, hitPoint, owner);
  }

  _handleBombHeading(fruit, head, currentTime) {
    soundManager.playHeadingDefuse();
    this.particles.createBladeSparks(fruit.x, fruit.y, '#38bdf8');
    this.particles.createBladeSparks(fruit.x, fruit.y, '#facc15');
    this.particles.createShockwave(fruit.x, fruit.y, '#38bdf8', 160);

    const bonusPoints = 10;
    this.onScore(bonusPoints, fruit, { x: fruit.x, y: fruit.y }, head.owner);
    this.onHeadingDefuse(fruit, head, bonusPoints);
  }

  draw(ctx) {
    this.particles.drawSplatters(ctx);
    this.fruits.forEach(f => f.draw(ctx));
    this.halfFruits.forEach(h => h.draw(ctx));
    this.particles.drawParticles(ctx);
  }
}
