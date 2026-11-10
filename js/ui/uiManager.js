/**
 * UI Manager - Handles HUD, Hearts, Combo Popups, High Scores, Ultimate Gauge,
 * and 1-Player vs 2-Player Duo Mode Display.
 */
export class UIManager {
  constructor() {
    this.scoreText = document.getElementById('score-text');
    this.highScoreText = document.getElementById('high-score-text');
    this.finalScoreText = document.getElementById('final-score-text');
    this.soloScorePanel = document.getElementById('solo-score-panel');
    this.duoScorePanel = document.getElementById('duo-score-panel');
    this.p1ScoreText = document.getElementById('p1-score-text');
    this.p2ScoreText = document.getElementById('p2-score-text');

    this.gameoverSoloContent = document.getElementById('gameover-solo-content');
    this.gameoverDuoContent = document.getElementById('gameover-duo-content');
    this.duoWinnerBanner = document.getElementById('duo-winner-banner');
    this.p1FinalScore = document.getElementById('p1-final-score');
    this.p2FinalScore = document.getElementById('p2-final-score');

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

    // Mode Buttons
    this.btnModeSolo = document.getElementById('btn-mode-solo');
    this.btnModeDuo = document.getElementById('btn-mode-duo');
    this.instructionPlayers = document.getElementById('instruction-players');

    this.comboTimeout = null;
    this.healTimeout = null;
    this.ultimateTimeout = null;
    this.ringCircumference = 2 * Math.PI * 44;
    this.highScore = parseInt(localStorage.getItem('pose_ninja_highscore') || '0', 10);
    this.isTwoPlayer = false;

    this.updateHighScoreDisplay();
    this._bindModeButtons();
  }

  _bindModeButtons() {
    if (this.btnModeSolo && this.btnModeDuo) {
      this.btnModeSolo.addEventListener('click', () => {
        this.setMode(false);
      });
      this.btnModeDuo.addEventListener('click', () => {
        this.setMode(true);
      });
    }
  }

  setMode(twoPlayer) {
    this.isTwoPlayer = twoPlayer;
    if (twoPlayer) {
      this.btnModeDuo.classList.add('active');
      this.btnModeSolo.classList.remove('active');
      if (this.instructionPlayers) {
        this.instructionPlayers.innerHTML =
          '👥 <strong>2인 대결 모드</strong>: 1P(왼쪽 하늘색) vs 2P(오른쪽 분홍색) 실시간 골격 분리 경쟁!';
      }
    } else {
      this.btnModeSolo.classList.add('active');
      this.btnModeDuo.classList.remove('active');
      if (this.instructionPlayers) {
        this.instructionPlayers.innerHTML =
          '⚔️ <strong>1인 모드</strong>: 양손(왼손 하늘색 / 오른손 파란색)을 빠르게 휘둘러 베기!';
      }
    }
  }

  updateHUDMode(twoPlayer) {
    if (twoPlayer) {
      if (this.soloScorePanel) this.soloScorePanel.classList.add('hidden');
      if (this.duoScorePanel) this.duoScorePanel.classList.remove('hidden');
    } else {
      if (this.soloScorePanel) this.soloScorePanel.classList.remove('hidden');
      if (this.duoScorePanel) this.duoScorePanel.classList.add('hidden');
    }
  }

  updateScores(p1Score, p2Score = 0, isTwoPlayer = false) {
    if (isTwoPlayer) {
      if (this.p1ScoreText) this.p1ScoreText.textContent = p1Score;
      if (this.p2ScoreText) this.p2ScoreText.textContent = p2Score;
    } else {
      if (this.scoreText) this.scoreText.textContent = p1Score;
      if (p1Score > this.highScore) {
        this.highScore = p1Score;
        localStorage.setItem('pose_ninja_highscore', p1Score.toString());
        this.updateHighScoreDisplay();
      }
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

  updateChargingProgress(progress) {
    if (!this.chargeRingCircle) return;
    const offset = this.ringCircumference * (1 - progress);
    this.chargeRingCircle.style.strokeDashoffset = offset;
  }

  showUltimateBanner(poseName, owner = 'P1') {
    if (!this.ultimateBanner) return;
    if (this.ultimateTimeout) {
      clearTimeout(this.ultimateTimeout);
    }

    if (this.ultimateBannerTitle) {
      const tag = this.isTwoPlayer ? `[${owner}] ` : '';
      this.ultimateBannerTitle.textContent = `⚡ ${tag}${poseName} 발동! ⚡`;
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

  showCombo(count, bonusPoints, owner = 'P1') {
    if (!this.comboContainer) return;

    if (this.comboTimeout) {
      clearTimeout(this.comboTimeout);
    }

    const tag = this.isTwoPlayer ? `${owner} ` : '';
    this.comboTitle.textContent = `${tag}${count}x COMBO!`;
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

  showGameOverModal(p1Score, p2Score = 0, isTwoPlayer = false) {
    if (isTwoPlayer) {
      if (this.gameoverSoloContent) this.gameoverSoloContent.classList.add('hidden');
      if (this.gameoverDuoContent) this.gameoverDuoContent.classList.remove('hidden');

      if (this.p1FinalScore) this.p1FinalScore.textContent = p1Score;
      if (this.p2FinalScore) this.p2FinalScore.textContent = p2Score;

      if (this.duoWinnerBanner) {
        if (p1Score > p2Score) {
          this.duoWinnerBanner.textContent = '👑 1P (CYAN) 승리!';
          this.duoWinnerBanner.style.color = '#38bdf8';
        } else if (p2Score > p1Score) {
          this.duoWinnerBanner.textContent = '👑 2P (PINK) 승리!';
          this.duoWinnerBanner.style.color = '#f43f5e';
        } else {
          this.duoWinnerBanner.textContent = '🤝 무승부 (DRAW)!';
          this.duoWinnerBanner.style.color = '#facc15';
        }
      }
    } else {
      if (this.gameoverSoloContent) this.gameoverSoloContent.classList.remove('hidden');
      if (this.gameoverDuoContent) this.gameoverDuoContent.classList.add('hidden');
      if (this.finalScoreText) {
        this.finalScoreText.textContent = p1Score;
      }
    }

    this.gameoverModal.classList.remove('hidden');
  }

  hideGameOverModal() {
    this.gameoverModal.classList.add('hidden');
  }
}
