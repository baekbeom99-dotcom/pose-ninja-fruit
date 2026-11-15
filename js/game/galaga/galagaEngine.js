/**
 * Galaga Mode Core Engine
 * Coordinates starfield, fighter, alien formation AI, bullets, tractor beam,
 * splitting asteroids, challenging bonus stages, power-up items, and Manse EMP shockwave.
 */

import { Starfield } from './starfield.js';
import { Fighter } from './fighter.js';
import { AlienFormation, AlienType, BonusAlien } from './alien.js';
import { BulletManager } from './bullet.js';
import { TractorBeam } from './tractorBeam.js';
import { Asteroid } from './asteroid.js';
import { soundManager } from '../../audio/soundManager.js';

export class GalagaEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.starfield = new Starfield(width, height, 90);
    this.fighter = new Fighter(width / 2, height - 75);
    this.formation = new AlienFormation(width, height);
    this.bulletManager = new BulletManager();
    this.tractorBeam = new TractorBeam();

    this.score = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.stage = 1;
    this.state = 'PLAYING'; // 'PLAYING', 'STAGE_CLEAR', 'GAMEOVER'
    this.stageClearTimer = 0;
    this.tractorTimer = 0;
    this.tractorInterval = 8.5;

    // 만세 제스처 EMP 미사일 일괄 제거 (스테이지당 2회 제공)
    this.empStock = 2;
    this.empCooldown = 0;
    this.shockwaves = [];

    // 소행성 및 메테오 (Stage 2+)
    this.asteroids = [];
    this.asteroidTimer = 0;

    // 챌린징 스테이지 (보너스 라운드: 3, 6, 9...)
    this.isChallengingStage = false;
    this.challengingHits = 0;
    this.challengingTotal = 40;
    this.challengingAliens = [];
    this.challengingCompleted = false;
    this.challengingResultTimer = 0;
    this.challengingBonusAwarded = false;

    this.particles = [];

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};

    // 키보드 비상 발사 폴백 (Space 또는 E 키)
    if (typeof window !== 'undefined') {
      this._onKeyDown = (e) => {
        if (e.code === 'Space' || e.key === 'e' || e.key === 'E') {
          if (this.state === 'PLAYING') {
            this.triggerEmpShockwave();
          }
        }
      };
      window.addEventListener('keydown', this._onKeyDown);
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    this.stop();
  }

  start() {
    this.reset();
    this.state = 'PLAYING';
    if (this.sound) {
      if (typeof this.sound.init === 'function') this.sound.init();
      if (typeof this.sound.resume === 'function') this.sound.resume();
      if (typeof this.sound.playGalagaIntro === 'function') {
        this.sound.playGalagaIntro(() => {
          if (this.state === 'PLAYING' && typeof this.sound.startGalagaBGM === 'function') {
            this.sound.startGalagaBGM();
          }
        });
      } else if (typeof this.sound.startGalagaBGM === 'function') {
        this.sound.startGalagaBGM();
      }
    }
  }

  stop() {
    this.state = 'GAMEOVER';
    if (this.sound && typeof this.sound.stopGalagaBGM === 'function') {
      this.sound.stopGalagaBGM();
    }
  }

  reset() {
    if (this.sound && typeof this.sound.stopGalagaBGM === 'function') {
      this.sound.stopGalagaBGM();
    }

    this.score = 0;
    this.lives = 5;
    this.stage = 1;
    this.bulletManager.clear();
    this.tractorBeam.deactivate();
    this.fighter = new Fighter(this.width / 2, this.height - 75);
    this._initStage();

    if (this.ui) {
      this.ui.updateScores(0, 0, false);
      this.ui.updateLives(this.lives, 5);
    }
  }

  _initStage() {
    this.state = 'PLAYING';
    this.stageClearTimer = 0;
    this.starfield.setWarp(false);
    this.starfield.setStage(this.stage);

    // 스테이지마다 EMP 스톡 2회 초기 충전!
    this.empStock = 2;
    this.empCooldown = 0;
    this.shockwaves = [];
    this.particles = [];
    this.asteroids = [];
    this.asteroidTimer = 0;

    if (this.fighter) {
      this.fighter.setInvulnerable(2.0);
    }

    if (this.stage % 3 === 0) {
      // 챌린징 스테이지 (Stage 3, 6, 9...)
      this.isChallengingStage = true;
      this.challengingHits = 0;
      this.challengingTotal = 40;
      this.challengingAliens = [];
      this.challengingCompleted = false;
      this.challengingResultTimer = 0;
      this.challengingBonusAwarded = false;
      this._buildChallengingWaves();
    } else {
      // 일반 편대 스테이지
      this.isChallengingStage = false;
      this.formation = new AlienFormation(this.width, this.height, this.stage);
      this.formation.startFlyIn();
      this.tractorInterval = Math.max(5.5, 8.5 - (this.stage - 1) * 0.7);
    }
  }

  _buildChallengingWaves() {
    this.challengingAliens = [];
    const w = this.width;
    const h = this.height;

    // 5개 편대 x 8기 = 총 40기 보너스 에일리언
    // Wave 0: Zako 좌측 상단 진입 -> 중앙 루프 -> 우측 상단 퇴장
    const wave0Curve = {
      p0: { x: -60, y: 120 },
      p1: { x: w * 0.45, y: h * 0.65 },
      p2: { x: w * 0.75, y: h * 0.25 },
      p3: { x: w + 60, y: 80 }
    };
    for (let i = 0; i < 8; i++) {
      this.challengingAliens.push(new BonusAlien(AlienType.ZAKO, wave0Curve, 0.8 + i * 0.22, 4.0));
    }

    // Wave 1: Goei 우측 상단 진입 -> 중앙 S자 곡선 -> 좌측 상단 퇴장
    const wave1Curve = {
      p0: { x: w + 60, y: 140 },
      p1: { x: w * 0.55, y: h * 0.68 },
      p2: { x: w * 0.25, y: h * 0.30 },
      p3: { x: -60, y: 100 }
    };
    for (let i = 0; i < 8; i++) {
      this.challengingAliens.push(new BonusAlien(AlienType.GOEI, wave1Curve, 4.2 + i * 0.22, 4.0));
    }

    // Wave 2: Zako 중앙 상단 진입 -> 좌측 8자 선회 -> 하단 좌측 퇴장
    const wave2Curve = {
      p0: { x: w * 0.45, y: -50 },
      p1: { x: w * 0.15, y: h * 0.40 },
      p2: { x: w * 0.60, y: h * 0.55 },
      p3: { x: -60, y: h * 0.75 }
    };
    for (let i = 0; i < 8; i++) {
      this.challengingAliens.push(new BonusAlien(AlienType.ZAKO, wave2Curve, 7.6 + i * 0.22, 4.0));
    }

    // Wave 3: Zako 중앙 상단 진입 -> 우측 8자 선회 -> 하단 우측 퇴장
    const wave3Curve = {
      p0: { x: w * 0.55, y: -50 },
      p1: { x: w * 0.85, y: h * 0.40 },
      p2: { x: w * 0.40, y: h * 0.55 },
      p3: { x: w + 60, y: h * 0.75 }
    };
    for (let i = 0; i < 8; i++) {
      this.challengingAliens.push(new BonusAlien(AlienType.ZAKO, wave3Curve, 11.0 + i * 0.22, 4.0));
    }

    // Wave 4: Boss Galaga 중앙 상단 진입 -> 거대 반원 호버링 루프 -> 상단 퇴장
    const wave4Curve = {
      p0: { x: w * 0.50, y: -60 },
      p1: { x: w * 0.18, y: h * 0.60 },
      p2: { x: w * 0.82, y: h * 0.60 },
      p3: { x: w * 0.50, y: -60 }
    };
    for (let i = 0; i < 8; i++) {
      this.challengingAliens.push(new BonusAlien(AlienType.BOSS_GALAGA, wave4Curve, 14.4 + i * 0.25, 4.4));
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.starfield.resize(width, height);
    if (this.formation) {
      this.formation.resize(width, height);
    }
    if (this.fighter) {
      this.fighter.y = height - 75;
    }
  }

  /**
   * 만세 제스처 감지: 양 손목이 어깨와 코 위로 번쩍 들린 만세 자세
   */
  isMansePose(landmarks) {
    if (!landmarks || landmarks.length < 17) return false;
    const nose = landmarks[0];
    const lSh = landmarks[11];
    const rSh = landmarks[12];
    const lWr = landmarks[15];
    const rWr = landmarks[16];
    if (!lSh || !rSh || !lWr || !rWr) return false;

    const avgShoulderY = (lSh.y + rSh.y) / 2;
    // 양 손목이 어깨보다 최소 0.08 이상 상단
    const wristsAboveShoulder = lWr.y < avgShoulderY - 0.08 && rWr.y < avgShoulderY - 0.08;
    // 양 손목이 코 높이보다 상단
    const wristsAboveNose = !nose || (lWr.y < nose.y + 0.04 && rWr.y < nose.y + 0.04);
    // 양 손이 모아진 세모(ㅅ)가 아니라 양옆으로 벌려진 만세(V) 자세
    const armsApart = Math.abs(lWr.x - rWr.x) > 0.12;

    return wristsAboveShoulder && wristsAboveNose && armsApart;
  }

  /**
   * EMP 충격파 발동: 화면 내 모든 적 미사일 즉시 일괄 파괴
   */
  triggerEmpShockwave() {
    if (this.empStock <= 0) return false;
    this.empStock--;
    this.empCooldown = 1.3;

    // 1. 화면 내 모든 외계인 미사일 폭파 및 소멸
    const missileCount = this.bulletManager.alienMissiles.length;
    for (let i = 0; i < missileCount; i++) {
      const m = this.bulletManager.alienMissiles[i];
      this._spawnExplosion(m.x, m.y, 'EMP_SPARK');
    }
    this.bulletManager.alienMissiles = [];

    // 2. 화면 전체로 퍼져나가는 푸른 전자기 펄스(EMP) 충격파 링 생성
    this.shockwaves.push({
      x: this.fighter ? this.fighter.x : this.width / 2,
      y: this.fighter ? this.fighter.y : this.height / 2,
      radius: 15,
      maxRadius: Math.max(this.width, this.height) * 1.15,
      speed: 1500,
      alpha: 1.0
    });

    // 3. 강력한 EMP 폭발 사운드 재생
    if (this.sound && typeof this.sound.playEmpBlast === 'function') {
      this.sound.playEmpBlast();
    }
    return true;
  }

  update(dt, currentTime, headPose, poses) {
    if (this.state === 'GAMEOVER') return;

    // 1. Process head tracking input
    let targetX = this.fighter.x;
    if (headPose && typeof headPose.x === 'number') {
      targetX = (1.0 - headPose.x) * this.width;
    }

    // 2. Update Starfield
    this.starfield.update(dt);

    // 3. Stage clear handling
    if (this.state === 'STAGE_CLEAR') {
      this.stageClearTimer += dt;
      if (this.stageClearTimer >= 2.5) {
        this.stage++;
        this._initStage();
      }
      return;
    }

    // 4. Update Fighter
    this.fighter.update(dt, targetX, this.width, this.height, this.bulletManager, this.sound);

    // 5. 만세 제스처 감지 및 EMP 발동
    if (this.empCooldown > 0) {
      this.empCooldown -= dt;
    }
    if (poses && poses.length > 0 && poses[0] && this.empCooldown <= 0 && this.empStock > 0) {
      if (this.isMansePose(poses[0])) {
        this.triggerEmpShockwave();
      }
    }

    // 6. Update Asteroids (Stage 2+)
    if (!this.isChallengingStage && this.stage >= 2) {
      this.asteroidTimer += dt;
      if (this.asteroidTimer >= 8.5) {
        this.asteroidTimer = 0;
        const startX = Math.random() * (this.width - 160) + 80;
        this.asteroids.push(new Asteroid(startX, -30, 'LARGE'));
      }
    }
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];
      ast.update(dt, this.width, this.height);
      if (ast.isDead) {
        this.asteroids.splice(i, 1);
      }
    }

    // 7. Mode-specific AI updates
    if (this.isChallengingStage) {
      // 챌린징 스테이지 업데이트
      for (let i = 0; i < this.challengingAliens.length; i++) {
        this.challengingAliens[i].updateBonus(dt);
      }

      // 모든 40기 퇴장 또는 격추 확인
      const allDone = this.challengingAliens.every(a => a.isDead);
      if (allDone && !this.challengingCompleted) {
        this.challengingCompleted = true;
        if (!this.challengingBonusAwarded) {
          this.challengingBonusAwarded = true;
          const bonus = this.challengingHits === this.challengingTotal ? 10000 : this.challengingHits * 100;
          this.score += bonus;
          this.onScore(this.score);
          if (this.ui) this.ui.updateScores(this.score, 0, false);
          if (this.sound && typeof this.sound.playGalagaDock === 'function') {
            this.sound.playGalagaDock();
          }
        }
      }

      if (this.challengingCompleted) {
        this.challengingResultTimer += dt;
        if (this.challengingResultTimer >= 3.2) {
          this.state = 'STAGE_CLEAR';
          this.stageClearTimer = 1.0;
          this.starfield.setWarp(true);
        }
      }
    } else {
      // 일반 편대 스테이지 업데이트
      this.formation.update(dt, this.width, this.height, this.bulletManager, this.fighter.x, this.fighter.y);

      // Tractor beam 주기적 발동
      this.tractorTimer += dt;
      if (this.tractorTimer >= this.tractorInterval && !this.tractorBeam.isActive) {
        const activeTractorBoss = this.formation.aliens.find(a => !a.isDead && a.isTractorRun);
        if (!activeTractorBoss) {
          this.tractorTimer = 0;
          const bosses = this.formation.aliens.filter(a => !a.isDead && a.type === AlienType.BOSS_GALAGA && !a.isDiving && !a.isTractorRun);
          if (bosses.length > 0) {
            const chosenBoss = bosses[Math.floor(Math.random() * bosses.length)];
            chosenBoss.startTractorDescent(Math.min(420, this.height * 0.50));
          }
        }
      }

      const beamingBoss = this.formation.aliens.find(a => !a.isDead && a.isTractorRun && a.tractorState === 'BEAMING');
      if (beamingBoss && !this.tractorBeam.isActive && !this.tractorBeam.capturedShip) {
        this.tractorBeam.activate(beamingBoss);
        if (this.sound && typeof this.sound.playGalagaTractor === 'function') {
          this.sound.playGalagaTractor();
        }
      }

      const prevBeamActive = this.tractorBeam.isActive;
      this.tractorBeam.update(dt, this.fighter, this.sound);
      this.tractorBeam.updateRescue(dt, this.fighter, this.sound);

      if (prevBeamActive && !this.tractorBeam.isActive && beamingBoss) {
        beamingBoss.finishTractorRun();
      }

      // 일반 스테이지 클리어 확인
      if (this.formation.allDestroyed() && this.state === 'PLAYING') {
        this.state = 'STAGE_CLEAR';
        this.stageClearTimer = 0;
        this.starfield.setWarp(true);
        if (this.sound && typeof this.sound.playGalagaDock === 'function') {
          this.sound.playGalagaDock();
        }
      }
    }

    // 8. Update Bullets, Shockwaves, and Particles
    this.bulletManager.update(dt, this.width, this.height);
    this._updateShockwaves(dt);
    this._updateParticles(dt);

    // 9. Check Collisions
    this.checkCollisions(dt);
  }

  checkCollisions(dt = 0.016) {
    // A. 챌린징 스테이지 탄환 충돌
    if (this.isChallengingStage) {
      for (let b = this.bulletManager.playerBullets.length - 1; b >= 0; b--) {
        const bullet = this.bulletManager.playerBullets[b];
        let bulletHit = false;

        for (let a = 0; a < this.challengingAliens.length; a++) {
          const alien = this.challengingAliens[a];
          if (alien.isDead || alien.x < -50 || alien.x > this.width + 50) continue;

          const dist = Math.hypot(bullet.x - alien.x, bullet.y - alien.y);
          if (dist <= alien.radius + bullet.width / 2 + 4) {
            bulletHit = true;
            alien.isDead = true;
            this.challengingHits++;
            this.score += 100;
            this.onScore(this.score);
            if (this.ui) this.ui.updateScores(this.score, 0, false);
            if (this.sound && typeof this.sound.playGalagaExplosion === 'function') {
              this.sound.playGalagaExplosion();
            }
            this._spawnExplosion(alien.x, alien.y, alien.type);
            break;
          }
        }

        if (bulletHit && !bullet.isPiercing) {
          this.bulletManager.playerBullets.splice(b, 1);
        }
      }
      return;
    }

    // B. 일반 스테이지 탄환 vs 소행성 충돌
    for (let b = this.bulletManager.playerBullets.length - 1; b >= 0; b--) {
      const bullet = this.bulletManager.playerBullets[b];
      let bulletHit = false;

      for (let i = this.asteroids.length - 1; i >= 0; i--) {
        const ast = this.asteroids[i];
        if (ast.isDead) continue;

        const dist = Math.hypot(bullet.x - ast.x, bullet.y - ast.y);
        if (dist <= ast.radius + bullet.width / 2 + 3) {
          bulletHit = true;
          ast.isDead = true;
          this.asteroids.splice(i, 1);
          this.score += ast.points;
          this.onScore(this.score);
          if (this.ui) this.ui.updateScores(this.score, 0, false);

          if (this.sound && typeof this.sound.playAsteroidHit === 'function') {
            this.sound.playAsteroidHit();
          }
          this._spawnExplosion(ast.x, ast.y, 'ASTEROID');

          // 대형 소행성은 2개의 고속 소형 소행성 조각으로 분열!
          if (ast.size === 'LARGE') {
            this.asteroids.push(new Asteroid(ast.x - 12, ast.y, 'SMALL', -80, 130));
            this.asteroids.push(new Asteroid(ast.x + 12, ast.y, 'SMALL', 80, 130));
          } else {
            // 소형 소행성 파괴 시 45% 확률로 파워업 아이템 드랍!
            if (Math.random() < 0.45) {
              const types = ['TRIPLE', 'PIERCER', 'SHIELD', 'HEART'];
              const chosenType = types[Math.floor(Math.random() * types.length)];
              this.bulletManager.spawnPowerUp(ast.x, ast.y, chosenType);
            }
          }
          break;
        }
      }

      if (bulletHit && !bullet.isPiercing) {
        this.bulletManager.playerBullets.splice(b, 1);
      }
    }

    // C. 일반 스테이지 탄환 vs 적 편대 충돌
    for (let b = this.bulletManager.playerBullets.length - 1; b >= 0; b--) {
      const bullet = this.bulletManager.playerBullets[b];
      let bulletHit = false;

      for (let a = 0; a < this.formation.aliens.length; a++) {
        const alien = this.formation.aliens[a];
        if (alien.isDead) continue;

        const dist = Math.hypot(bullet.x - alien.x, bullet.y - alien.y);
        if (dist <= alien.radius + bullet.width / 2 + 2) {
          bulletHit = true;
          const pointsAwarded = alien.hit();

          if (pointsAwarded > 0) {
            this.score += pointsAwarded;
            this.onScore(this.score);
            if (this.ui) this.ui.updateScores(this.score, 0, false);
          }

          if (alien.isDead) {
            if (this.sound && typeof this.sound.playGalagaExplosion === 'function') {
              this.sound.playGalagaExplosion();
            }
            this._spawnExplosion(alien.x, alien.y, alien.type);

            // 급강하 중인 적 격추 시 25% 확률로 파워업 아이템 드랍!
            if (alien.isDiving && Math.random() < 0.25) {
              const types = ['TRIPLE', 'PIERCER', 'SHIELD', 'HEART'];
              const chosenType = types[Math.floor(Math.random() * types.length)];
              this.bulletManager.spawnPowerUp(alien.x, alien.y, chosenType);
            }

            // 트랙터 빔을 쏘는 개체가 죽으면 즉시 트랙터 빔 소멸!
            if (this.tractorBeam.isActive && this.tractorBeam.boss === alien) {
              if (this.tractorBeam.isPulling && this.tractorBeam.pullingShip) {
                this.tractorBeam.pullingShip.isCaptured = false;
                this.tractorBeam.pullingShip.angle = 0;
                this.tractorBeam.pullingShip.y = this.height - 75;
                this.lives = Math.min(this.maxLives, this.lives + 1);
                this.onLivesChanged(this.lives);
                if (this.ui) this.ui.updateLives(this.lives, this.maxLives);
              }
              this.tractorBeam.deactivate();
            }

            // 포획된 아군기 구출
            if (alien.type === AlienType.BOSS_GALAGA) {
              if (this.tractorBeam.capturedShip && this.tractorBeam.capturedShip.boss === alien) {
                this.tractorBeam.releaseCapturedShip();
              }
            }
          } else if (alien.isShielded === false && pointsAwarded === 50) {
            // 방어막 파괴 스파크 효과
            this._spawnExplosion(alien.x, alien.y, 'SHIELD_BREAK');
          }
          break;
        }
      }

      if (bulletHit && !bullet.isPiercing) {
        this.bulletManager.playerBullets.splice(b, 1);
      }
    }

    // D. 파워업 아이템 vs 플레이어 기체 충돌
    for (let p = this.bulletManager.powerups.length - 1; p >= 0; p--) {
      const pu = this.bulletManager.powerups[p];
      if (pu.isDead) continue;

      const dist = Math.hypot(pu.x - this.fighter.x, pu.y - this.fighter.y);
      if (dist <= this.fighter.width / 2 + pu.radius) {
        pu.isDead = true;
        this.bulletManager.powerups.splice(p, 1);

        if (this.sound && typeof this.sound.playPowerUp === 'function') {
          this.sound.playPowerUp();
        }

        if (pu.type === 'TRIPLE') {
          this.fighter.setWeapon('TRIPLE', 12.0);
        } else if (pu.type === 'PIERCER') {
          this.fighter.setWeapon('PIERCER', 12.0);
        } else if (pu.type === 'SHIELD') {
          this.fighter.setShield(true);
        } else if (pu.type === 'HEART') {
          this.lives = Math.min(this.maxLives, this.lives + 1);
          this.onLivesChanged(this.lives);
          if (this.ui) this.ui.updateLives(this.lives, this.maxLives);
        }
      }
    }

    // E. 소행성 vs 플레이어 기체 충돌
    if (!this.fighter.isDead && !this.fighter.isCaptured && !this.fighter.isInvulnerable) {
      for (let i = this.asteroids.length - 1; i >= 0; i--) {
        const ast = this.asteroids[i];
        if (ast.isDead) continue;

        const dist = Math.hypot(ast.x - this.fighter.x, ast.y - this.fighter.y);
        if (dist <= this.fighter.width / 2 + ast.radius) {
          ast.isDead = true;
          this.asteroids.splice(i, 1);
          this._spawnExplosion(ast.x, ast.y, 'ASTEROID');
          this._handleFighterHit();
          break;
        }
      }
    }

    // F. 트랙터 빔 vs 플레이어 기체
    if (this.tractorBeam.isActive && !this.fighter.isCaptured && !this.fighter.isInvulnerable) {
      const exposure = this.tractorBeam.updateExposure(dt, this.fighter);

      if (exposure.triggerCapture && !this.tractorBeam.isPulling) {
        const capturedFighter = this.fighter;
        this.tractorBeam.startCapture(capturedFighter);

        this.lives = Math.max(0, this.lives - 1);
        this.onLivesChanged(this.lives);
        if (this.ui) this.ui.updateLives(this.lives, 5);

        if (this.lives <= 0) {
          this.tractorBeam.onCaptureComplete = () => {
            this._triggerGameOver();
          };
        } else {
          this.tractorBeam.onCaptureComplete = () => {
            if (this.state !== 'GAMEOVER') {
              this.fighter = new Fighter(this.width / 2, this.height - 75);
              this.fighter.setInvulnerable(2.0);
            }
          };
        }
      }
    } else {
      this.tractorBeam.updateExposure(dt, this.fighter);
    }

    // G. 외계인 미사일 vs 플레이어 기체
    if (!this.fighter.isDead && !this.fighter.isCaptured && !this.fighter.isInvulnerable) {
      for (let m = this.bulletManager.alienMissiles.length - 1; m >= 0; m--) {
        const missile = this.bulletManager.alienMissiles[m];
        const dist = Math.hypot(missile.x - this.fighter.x, missile.y - this.fighter.y);

        if (dist <= this.fighter.width / 2 + missile.radius) {
          missile.isDead = true;
          this.bulletManager.alienMissiles.splice(m, 1);
          this._handleFighterHit();
          break;
        }
      }
    }

    // H. 급강하 외계인 몸체 vs 플레이어 기체
    if (!this.fighter.isDead && !this.fighter.isCaptured && !this.fighter.isInvulnerable) {
      for (let a = 0; a < this.formation.aliens.length; a++) {
        const alien = this.formation.aliens[a];
        if (alien.isDead || !alien.isDiving) continue;

        const dist = Math.hypot(alien.x - this.fighter.x, alien.y - this.fighter.y);
        if (dist <= this.fighter.width / 2 + alien.radius) {
          alien.isDead = true;
          this._spawnExplosion(alien.x, alien.y, alien.type);
          this._handleFighterHit();
          break;
        }
      }
    }
  }

  _handleFighterHit() {
    this._spawnExplosion(this.fighter.x, this.fighter.y, 'FIGHTER');
    if (this.sound && typeof this.sound.playGalagaExplosion === 'function') {
      this.sound.playGalagaExplosion();
    }

    // 1. 방어막이 활성화된 경우 피해를 무효화하고 보호막만 소멸
    if (this.fighter.hasShield) {
      this.fighter.setShield(false);
      this.fighter.setInvulnerable(1.6);
      return;
    }

    // 2. 듀얼 파이터인 경우 싱글 파이터로 복구
    if (this.fighter.isDual) {
      this.fighter.setDual(false);
      this.fighter.setInvulnerable(2.2);
    } else {
      // 3. 라이프 차감
      this.lives = Math.max(0, this.lives - 1);
      this.onLivesChanged(this.lives);
      if (this.ui) this.ui.updateLives(this.lives, 5);

      if (this.lives <= 0) {
        this._triggerGameOver();
      } else {
        this.fighter.setInvulnerable(2.5);
      }
    }
  }

  _triggerGameOver() {
    this.state = 'GAMEOVER';
    if (this.sound && typeof this.sound.stopGalagaBGM === 'function') {
      this.sound.stopGalagaBGM();
    }
    this.onGameOver(this.score);
    if (this.ui) {
      this.ui.showGameOverModal(this.score, 0, false);
    }
  }

  _spawnExplosion(x, y, type) {
    let color = '#38bdf8';
    if (type === 'FIGHTER') color = '#38bdf8';
    else if (type === 'ASTEROID') color = '#94a3b8';
    else if (type === 'EMP_SPARK') color = '#00f0ff';
    else if (type === 'SHIELD_BREAK') color = '#38bdf8';
    else if (type === AlienType.ZAKO) color = '#0284c7';
    else if (type === AlienType.GOEI) color = '#ef4444';
    else if (type === AlienType.BOSS_GALAGA) color = '#10b981';

    const count = type === 'EMP_SPARK' ? 8 : 18;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        color,
        size: 2.5 + Math.random() * 3
      });
    }
  }

  _updateShockwaves(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.alpha = Math.max(0, 1.0 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    // 1. Starfield (Nebula atmosphere per stage)
    this.starfield.render(ctx);

    // 2. Mode-specific actors
    if (this.isChallengingStage) {
      for (let i = 0; i < this.challengingAliens.length; i++) {
        this.challengingAliens[i].render(ctx);
      }
    } else {
      this.formation.render(ctx);
      for (let i = 0; i < this.asteroids.length; i++) {
        this.asteroids[i].render(ctx);
      }
      this.tractorBeam.render(ctx, this.height, this.fighter);
    }

    // 3. Bullets, PowerUps, and Shockwaves
    this.bulletManager.render(ctx);
    this._renderShockwaves(ctx);
    this._renderParticles(ctx);

    // 4. Fighter
    this.fighter.render(ctx);

    // 5. HUD: Stage Indicator (Classic arcade style badge at bottom right)
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 8;
    ctx.fillText(`STAGE ${this.stage}`, this.width - 24, this.height - 24);

    // 6. HUD: EMP Stock & Weapon Status at top-left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`⚡ EMP [만세]: ${this.empStock}/2`, 24, 32);

    if (this.fighter.weaponTimer > 0) {
      ctx.fillStyle = this.fighter.weaponType === 'PIERCER' ? '#c084fc' : '#38bdf8';
      ctx.fillText(`WEAPON: ${this.fighter.weaponType} (${Math.ceil(this.fighter.weaponTimer)}s)`, 24, 56);
    } else if (this.fighter.hasShield) {
      ctx.fillStyle = '#10b981';
      ctx.fillText(`SHIELD: ACTIVE 🛡️`, 24, 56);
    }

    // 7. HUD: Challenging Stage Hits & Results
    if (this.isChallengingStage) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.font = '900 22px sans-serif';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.fillText(`⭐ CHALLENGING STAGE ⭐`, this.width / 2, 40);

      ctx.font = '700 16px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`NUMBER OF HITS: ${this.challengingHits} / ${this.challengingTotal}`, this.width / 2, 66);

      if (this.challengingCompleted) {
        ctx.font = '900 32px sans-serif';
        if (this.challengingHits === this.challengingTotal) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(`PERFECT! 10,000 PTS BONUS!`, this.width / 2, this.height / 2 - 20);
        } else {
          ctx.fillStyle = '#facc15';
          ctx.fillText(`SPECIAL BONUS: ${this.challengingHits * 100} PTS`, this.width / 2, this.height / 2 - 20);
        }
      }
    }
    ctx.restore();

    // 8. Stage Clear Warp Banner
    if (this.state === 'STAGE_CLEAR') {
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.font = '900 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 15;
      ctx.fillText(`STAGE ${this.stage} CLEAR!`, this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 20px sans-serif';
      ctx.fillText(`WARPING TO STAGE ${this.stage + 1}...`, this.width / 2, this.height / 2 + 25);
      ctx.restore();
    }
  }

  _renderShockwaves(ctx) {
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      ctx.save();
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, Math.max(0, sw.radius - 8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _renderParticles(ctx) {
    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
