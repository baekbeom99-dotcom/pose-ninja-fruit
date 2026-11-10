/**
 * UI Manager - Handles HUD, Hearts, Combo Popups, High Scores, Ultimate Gauge & Modals
 */
export class UIManager {
  constructor() {
    this.scoreText = document.getElementById('score-text');
    this.highScoreText = document.getElementById('high-score-text');
    this.finalScoreText = document.getElementById('final-score-text');
    this.livesContainer = document.getElementById('lives-container');
    this.comboContainer = document.getElementById('combo-container');
    this.comboTitle = document.getElementById('combo-title');
    this.comboScore = document.getElementById('combo-score');
    this.healContainer = document.getElementById('heal-container');
    this.startModal = document.getElementById('start-modal');
    this.gameoverModal = document.getElementById('gameover-modal');
    this.statusPill = document.getElementById('status-pill');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');

    // Ultimate HUD elements
    this.ultimateCount = document.getElementById('ultimate-count');
    this.ultimateGaugeFill = document.getElementById('ultimate-gauge-fill');
    this.ultimatePoseCard = document.getElementById('ultimate-pose-card');
    this.poseSymbolSvg = document.getElementById('pose-symbol-svg');
    this.chargeRingCircle = document.getElementById('charge-ring-circle');
    this.ultimateMoveName = document.getElementById('ultimate-move-name');
    this.ultimateMoveDesc = document.getElementById('ultimate-move-desc');
    this.ultimateBanner = document.getElementById('ultimate-banner');
    this.ultimateBannerTitle = document.getElementById('ultimate-banner-title');
    this.themeBadge = document.getElementById('theme-badge');
    this.themeNameText = document.getElementById('theme-name-text');

    this.comboTimeout = null;
    this.healTimeout = null;
    this.ultimateTimeout = null;
    this.ringCircumference = 2 * Math.PI * 44; // ~276.46
    this.highScore = parseInt(localStorage.getItem('pose_ninja_highscore') || '0', 10);
    this.updateHighScoreDisplay();
  }

  updateScore(score) {
    if (this.scoreText) {
      this.scoreText.textContent = score;
    }
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem('pose_ninja_highscore', score.toString());
      this.updateHighScoreDisplay();
    }
  }

  updateHighScoreDisplay() {
    if (this.highScoreText) {
      this.highScoreText.textContent = this.highScore;
    }
  }

  updateLives(lives, maxLives = 5) {
    for (let i = 1; i <= maxLives; i++) {
      const heart = document.getElementById(`life-${i}`);
      if (heart) {
        if (i > lives) {
          heart.classList.add('lost');
          heart.classList.remove('recover');
        } else {
          const wasLost = heart.classList.contains('lost');
          heart.classList.remove('lost');
          if (wasLost) {
            heart.classList.add('recover');
            setTimeout(() => heart.classList.remove('recover'), 600);
          }
        }
      }
    }
  }

  setThemeBadge(theme) {
    if (this.themeNameText && theme) {
      this.themeNameText.textContent = `테마: ${theme.name}`;
    }
  }

  /**
   * Updates Ultimate Move progress, state, and target consonant card
   */
  updateUltimateGauge(slicedCount, threshold, isReady, currentPose) {
    const clamped = Math.min(slicedCount, threshold);
    const pct = (clamped / threshold) * 100;

    if (this.ultimateCount) {
      this.ultimateCount.textContent = `${clamped}/${threshold}`;
    }

    if (this.ultimateGaugeFill) {
      this.ultimateGaugeFill.style.width = `${pct}%`;
    }

    if (this.ultimatePoseCard && currentPose) {
      if (isReady) {
        this.ultimatePoseCard.classList.remove('locked');
        this.ultimatePoseCard.classList.add('ready');
        this.ultimateMoveName.textContent = currentPose.name;
        this.ultimateMoveDesc.textContent = currentPose.desc;
        this.poseSymbolSvg.innerHTML = `<text x="50" y="70" font-size="64" font-weight="900" text-anchor="middle" fill="${currentPose.color}">${currentPose.symbol}</text>`;
      } else {
        this.ultimatePoseCard.classList.add('locked');
        this.ultimatePoseCard.classList.remove('ready');
        this.ultimateMoveName.textContent = currentPose.name;
        this.ultimateMoveDesc.textContent = `${threshold - clamped}개 더 베면 개방!`;
        this.poseSymbolSvg.innerHTML = `<text x="50" y="70" font-size="64" font-weight="900" text-anchor="middle" fill="#94a3b8">${currentPose.symbol}</text>`;
      }
    }
  }

  /**
   * Updates circular charging ring when holding the consonant posture
   * @param {number} progress - 0.0 to 1.0
   */
  updateChargingProgress(progress) {
    if (!this.chargeRingCircle) return;
    const offset = this.ringCircumference * (1 - progress);
    this.chargeRingCircle.style.strokeDashoffset = offset;
  }

  /**
   * Displays explosive fullscreen banner upon triggering ultimate move
   */
  showUltimateBanner(poseName) {
    if (!this.ultimateBanner) return;
    if (this.ultimateTimeout) {
      clearTimeout(this.ultimateTimeout);
    }

    if (this.ultimateBannerTitle) {
      this.ultimateBannerTitle.textContent = `⚡ ${poseName} 발동! ⚡`;
    }

    this.ultimateBanner.classList.remove('active');
    void this.ultimateBanner.offsetWidth;
    this.ultimateBanner.classList.add('active');

    this.ultimateTimeout = setTimeout(() => {
      this.ultimateBanner.classList.remove('active');
    }, 1200);
  }

  showHeal() {
    if (!this.healContainer) return;
    if (this.healTimeout) {
      clearTimeout(this.healTimeout);
    }

    this.healContainer.classList.remove('active');
    void this.healContainer.offsetWidth;
    this.healContainer.classList.add('active');

    this.healTimeout = setTimeout(() => {
      this.healContainer.classList.remove('active');
    }, 850);
  }

  showCombo(count, bonusPoints) {
    if (!this.comboContainer) return;

    if (this.comboTimeout) {
      clearTimeout(this.comboTimeout);
    }

    this.comboTitle.textContent = `${count}x COMBO!`;
    this.comboScore.textContent = `+${bonusPoints} BONUS`;

    this.comboContainer.classList.remove('active');
    void this.comboContainer.offsetWidth;
    this.comboContainer.classList.add('active');

    this.comboTimeout = setTimeout(() => {
      this.comboContainer.classList.remove('active');
    }, 700);
  }

  setStatus(text, isReady = false) {
    if (this.statusText) this.statusText.textContent = text;
    if (this.statusDot) {
      if (isReady) {
        this.statusDot.classList.add('ready');
      } else {
        this.statusDot.classList.remove('ready');
      }
    }
  }

  hideStatus() {
    if (this.statusPill) {
      this.statusPill.style.display = 'none';
    }
  }

  showStartModal() {
    this.startModal.classList.remove('hidden');
    this.gameoverModal.classList.add('hidden');
  }

  hideStartModal() {
    this.startModal.classList.add('hidden');
  }

  showGameOverModal(finalScore) {
    if (this.finalScoreText) {
      this.finalScoreText.textContent = finalScore;
    }
    this.gameoverModal.classList.remove('hidden');
  }

  hideGameOverModal() {
    this.gameoverModal.classList.add('hidden');
  }
}
