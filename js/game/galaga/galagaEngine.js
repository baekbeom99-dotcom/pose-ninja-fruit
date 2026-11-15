/**
 * Galaga Mode Core Engine
 * Coordinates starfield, fighter, alien formation AI, bullets, tractor beam, and collision detection.
 */

import { Starfield } from './starfield.js';
import { Fighter } from './fighter.js';
import { AlienFormation, AlienType } from './alien.js';
import { BulletManager } from './bullet.js';
import { TractorBeam } from './tractorBeam.js';
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

    this.particles = [];

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};
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
    this.state = 'PLAYING';
    this.stageClearTimer = 0;
    this.tractorTimer = 0;
    this.particles = [];

    this.starfield.setWarp(false);
    this.fighter = new Fighter(this.width / 2, this.height - 75);
    this.fighter.setInvulnerable(2.0);
    this.formation = new AlienFormation(this.width, this.height);
    this.bulletManager.clear();
    this.tractorBeam.deactivate();

    if (this.ui) {
      this.ui.updateScores(0, 0, false);
      this.ui.updateLives(this.lives, 5);
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.starfield.resize(width, height);
    this.formation.resize(width, height);
    if (this.fighter) {
      this.fighter.y = height - 75;
    }
  }

  update(dt, currentTime, headPose) {
    if (this.state === 'GAMEOVER') return;

    // 1. Process head tracking input
    let targetX = this.fighter.x;
    if (headPose && typeof headPose.x === 'number') {
      // Mirror horizontal movement for intuitive webcam experience
      targetX = (1.0 - headPose.x) * this.width;
    }

    // 2. Update Starfield
    this.starfield.update(dt);

    // 3. Stage clear handling
    if (this.state === 'STAGE_CLEAR') {
      this.stageClearTimer += dt;
      if (this.stageClearTimer >= 2.5) {
        // Advance stage
        this.stage++;
        this.state = 'PLAYING';
        this.stageClearTimer = 0;
        this.starfield.setWarp(false);
        this.formation = new AlienFormation(this.width, this.height, this.stage);
        this.tractorInterval = Math.max(5.5, 8.5 - (this.stage - 1) * 0.7);
        this.fighter.setInvulnerable(1.5);
      }
      return;
    }

    // 4. Update Fighter
    this.fighter.update(dt, targetX, this.width, this.height, this.bulletManager, this.sound);

    // 5. Update Formation AI
    this.formation.update(dt, this.width, this.height, this.bulletManager, this.fighter.x, this.fighter.y);

    // 6. Tractor beam periodic trigger: Boss Galaga descends first before firing beam
    this.tractorTimer += dt;
    if (this.tractorTimer >= this.tractorInterval && !this.tractorBeam.isActive) {
      const activeTractorBoss = this.formation.aliens.find(a => !a.isDead && a.isTractorRun);
      if (!activeTractorBoss) {
        this.tractorTimer = 0;
        const bosses = this.formation.aliens.filter(a => !a.isDead && a.type === AlienType.BOSS_GALAGA && !a.isDiving && !a.isTractorRun);
        if (bosses.length > 0) {
          const chosenBoss = bosses[Math.floor(Math.random() * bosses.length)];
          // Descend 20% deeper towards mid-screen before firing beam!
          chosenBoss.startTractorDescent(Math.min(420, this.height * 0.50));
        }
      }
    }

    // Check if descending boss reached target Y and should activate tractor beam
    const beamingBoss = this.formation.aliens.find(a => !a.isDead && a.isTractorRun && a.tractorState === 'BEAMING');
    if (beamingBoss && !this.tractorBeam.isActive && !this.tractorBeam.capturedShip) {
      this.tractorBeam.activate(beamingBoss);
      if (this.sound && typeof this.sound.playGalagaTractor === 'function') {
        this.sound.playGalagaTractor();
      }
    }

    // 7. Update Tractor beam and Bullets
    const prevBeamActive = this.tractorBeam.isActive;
    this.tractorBeam.update(dt, this.fighter, this.sound);
    this.tractorBeam.updateRescue(dt, this.fighter, this.sound);
    this.bulletManager.update(dt, this.width, this.height);

    // If beam just finished, tell boss to finish tractor run and return to formation
    if (prevBeamActive && !this.tractorBeam.isActive && beamingBoss) {
      beamingBoss.finishTractorRun();
    }

    // 8. Update Explosion Particles
    this._updateParticles(dt);

    // 9. Check Collisions
    this.checkCollisions(dt);

    // 10. Check Stage Clear
    if (this.formation.allDestroyed() && this.state === 'PLAYING') {
      this.state = 'STAGE_CLEAR';
      this.stageClearTimer = 0;
      this.starfield.setWarp(true);
      if (this.sound && typeof this.sound.playGalagaDock === 'function') {
        this.sound.playGalagaDock();
      }
    }
  }

  checkCollisions(dt = 0.016) {
    // 1. Player Bullets vs Aliens
    for (let b = this.bulletManager.playerBullets.length - 1; b >= 0; b--) {
      const bullet = this.bulletManager.playerBullets[b];
      let bulletHit = false;

      for (let a = 0; a < this.formation.aliens.length; a++) {
        const alien = this.formation.aliens[a];
        if (alien.isDead) continue;

        // Collision check
        const dist = Math.hypot(bullet.x - alien.x, bullet.y - alien.y);
        if (dist <= alien.radius + bullet.width / 2 + 2) {
          bulletHit = true;
          const pointsAwarded = alien.hit();

          if (pointsAwarded > 0) {
            // Alien destroyed!
            this.score += pointsAwarded;
            this.onScore(this.score);
            if (this.ui) {
              this.ui.updateScores(this.score, 0, false);
            }
            if (this.sound && typeof this.sound.playGalagaExplosion === 'function') {
              this.sound.playGalagaExplosion();
            }
            this._spawnExplosion(alien.x, alien.y, alien.type);

            // 트랙터 빔을 쏘는 개체가 죽으면 즉시 트랙터 빔 소멸!
            if (this.tractorBeam.isActive && this.tractorBeam.boss === alien) {
              if (this.tractorBeam.isPulling && this.tractorBeam.pullingShip) {
                // 당겨지던 기체 원복 및 하트 복구
                this.tractorBeam.pullingShip.isCaptured = false;
                this.tractorBeam.pullingShip.angle = 0;
                this.tractorBeam.pullingShip.y = this.height - 75;
                this.lives = Math.min(this.maxLives, this.lives + 1);
                this.onLivesChanged(this.lives);
                if (this.ui) this.ui.updateLives(this.lives, this.maxLives);
              }
              this.tractorBeam.deactivate();
            }

            // 보스가 기체를 이미 포획해 머리에 얹고 비행 중 격추된 경우 구출 및 듀얼 파이터 전개!
            if (alien.type === AlienType.BOSS_GALAGA) {
              if (this.tractorBeam.capturedShip && this.tractorBeam.capturedShip.boss === alien) {
                this.tractorBeam.releaseCapturedShip();
              }
            }
          }
          break;
        }
      }

      if (bulletHit) {
        this.bulletManager.playerBullets.splice(b, 1);
      }
    }

    // 2. Tractor Beam vs Fighter (Requires 1.0s exposure!)
    if (this.tractorBeam.isActive && !this.fighter.isCaptured && !this.fighter.isInvulnerable) {
      const exposure = this.tractorBeam.updateExposure(dt, this.fighter);

      if (exposure.triggerCapture && !this.tractorBeam.isPulling) {
        const capturedFighter = this.fighter;
        this.tractorBeam.startCapture(capturedFighter);

        // Player loses 1 fighter into capture
        this.lives = Math.max(0, this.lives - 1);
        this.onLivesChanged(this.lives);
        if (this.ui) this.ui.updateLives(this.lives, 5);

        if (this.lives <= 0) {
          // If no lives remain, trigger game over after capture animation finishes
          this.tractorBeam.onCaptureComplete = () => {
            this._triggerGameOver();
          };
        } else {
          // When ship finishes docking on boss, spawn reserve fighter!
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

    // 3. Alien Missiles vs Fighter
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

    // 4. Diving Alien Bodies vs Fighter
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

    if (this.fighter.isDual) {
      // Revert to single ship with invulnerability
      this.fighter.setDual(false);
      this.fighter.setInvulnerable(2.2);
    } else {
      // Deduct 1 life
      this.lives = Math.max(0, this.lives - 1);
      this.onLivesChanged(this.lives);
      if (this.ui) this.ui.updateLives(this.lives, 5);

      if (this.lives <= 0) {
        this._triggerGameOver();
      } else {
        // Respawn single fighter with invulnerability
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
    const color = type === 'FIGHTER' ? '#38bdf8' : (type === AlienType.ZAKO ? '#0284c7' : '#ef4444');
    const count = 18;
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
    // 1. Starfield
    this.starfield.render(ctx);

    // 2. Formation
    this.formation.render(ctx);

    // 3. Tractor Beam
    this.tractorBeam.render(ctx, this.height, this.fighter);

    // 4. Bullets
    this.bulletManager.render(ctx);

    // 5. Particles
    this._renderParticles(ctx);

    // 6. Fighter
    this.fighter.render(ctx);

    // 7. Stage Indicator (Classic arcade style badge at bottom right)
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 8;
    ctx.fillText(`STAGE ${this.stage}`, this.width - 24, this.height - 24);
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
