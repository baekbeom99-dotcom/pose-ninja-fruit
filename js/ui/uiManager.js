/**
 * UI Manager - Handles HUD, Hearts, Combo Popups, High Scores, Ultimate Gauge,
 * 1-Player vs 2-Player Duo Mode, Fullscreen, Exit, and Visual Posture Guide Modal.
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
    this.headingContainer = document.getElementById('heading-container');
    this.headingBannerText = document.getElementById('heading-banner-text');
    this.startModal = document.getElementById('start-modal');
    this.gameoverModal = document.getElementById('gameover-modal');
    this.guideModal = document.getElementById('guide-modal');
    this.statusPill = document.getElementById('status-pill');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');

    // Controls
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.btnExit = document.getElementById('btn-exit');
    this.btnGuide = document.getElementById('btn-guide');
    this.closeGuideBtn = document.getElementById('close-guide-btn');

    // Ultimate HUD elements
    this.ultimateCount = document.getElementById('ultimate-count');
    this.ultimateGaugeFill = document.getElementById('ultimate-gauge-fill');
    this.ultimatePoseCard = document.getElementById('ultimate-pose-card');
    this.poseStickmanWrap = document.getElementById('pose-stickman-wrap');
    this.chargeRingCircle = document.getElementById('charge-ring-circle');
    this.ultimateMoveName = document.getElementById('ultimate-move-name');
    this.ultimateMoveDesc = document.getElementById('ultimate-move-desc');
    this.ultimateBanner = document.getElementById('ultimate-banner');
    this.ultimateBannerTitle = document.getElementById('ultimate-banner-title');

    // Mode Buttons
    this.btnModeSolo = document.getElementById('btn-mode-solo');
    this.btnModeDuo = document.getElementById('btn-mode-duo');
    this.instructionPlayers = document.getElementById('instruction-players');

    // Special Game Modes Tabs
    this.btnModeClassic = document.getElementById('btn-mode-classic');
    this.btnModeStrange = document.getElementById('btn-mode-strange');
    this.btnModeUfo = document.getElementById('btn-mode-ufo');
    this.instructionModeDesc = document.getElementById('instruction-mode-desc');
    this.instructionSpecial = document.getElementById('instruction-special');
    this.selectedGameMode = 'CLASSIC';

    this.onExitRequested = () => {};

    this.comboTimeout = null;
    this.healTimeout = null;
    this.headingTimeout = null;
    this.ultimateTimeout = null;
    this.ringCircumference = 2 * Math.PI * 44;
    this.highScore = parseInt(localStorage.getItem('pose_ninja_highscore') || '0', 10);
    this.isTwoPlayer = false;

    this.updateHighScoreDisplay();
    this._bindControls();
  }

  _bindControls() {
    // Player Count Toggle
    if (this.btnModeSolo && this.btnModeDuo) {
      this.btnModeSolo.addEventListener('click', () => {
        this.setMode(false);
      });
      this.btnModeDuo.addEventListener('click', () => {
        this.setMode(true);
      });
    }

    // Special Game Modes Tabs
    const tabs = [
      { btn: this.btnModeClassic, mode: 'CLASSIC' },
      { btn: this.btnModeStrange, mode: 'DOCTOR_STRANGE' },
      { btn: this.btnModeUfo, mode: 'UFO_FISH' }
    ];

    tabs.forEach(({ btn, mode }) => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.setGameMode(mode);
        });
      }
    });

    // Fullscreen Toggle
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.warn('Fullscreen request failed:', err);
          });
          this.btnFullscreen.textContent = '⛶ 창모드';
        } else {
          document.exitFullscreen().catch(() => {});
          this.btnFullscreen.textContent = '⛶ 전체화면';
        }
      });
    }

    // Exit Button
    if (this.btnExit) {
      this.btnExit.addEventListener('click', () => {
        this.onExitRequested();
        this.showStartModal();
      });
    }

    // Guide Modal
    const openGuide = () => {
      if (this.guideModal) this.guideModal.classList.remove('hidden');
    };
    const closeGuide = () => {
      if (this.guideModal) this.guideModal.classList.add('hidden');
    };

    if (this.btnGuide) this.btnGuide.addEventListener('click', openGuide);
    if (this.ultimatePoseCard) this.ultimatePoseCard.addEventListener('click', openGuide);
    if (this.closeGuideBtn) this.closeGuideBtn.addEventListener('click', closeGuide);
  }

  setGameMode(mode = 'CLASSIC') {
    this.selectedGameMode = mode;

    [this.btnModeClassic, this.btnModeStrange, this.btnModeUfo].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (mode === 'DOCTOR_STRANGE') {
      if (this.btnModeStrange) this.btnModeStrange.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '🔮 <strong>닥터 스트레인지 모드</strong>: 양손 사이를 잇는 마법 광선 검으로 모든 과일을 절단!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '🌀 <strong>차원 포털 오픈</strong>: 왼손 정면 가드 + 오른손 원을 그려 포털을 열면 화면 전체 전멸!';
      }
    } else if (mode === 'UFO_FISH') {
      if (this.btnModeUfo) this.btnModeUfo.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '🛸 <strong>UFO 과일 모드</strong>: 중력의 영향을 받지 않는 무중력 우주 과일들이 개성 넘치는 궤적으로 비행합니다!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '🌊 <strong>무중력 비행 궤적</strong>: 사인파, 8자 순찰, 제트 대시, 벽면 반사 궤적으로 비행하는 과일들을 베어보세요!';
      }
    } else {
      if (this.btnModeClassic) this.btnModeClassic.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '⚔️ <strong>클래식 닌자 모드</strong>: 양손 독립 검기로 높이 솟구치는 과일을 베어보세요!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '⚡ <strong>필살기 (12개 절단 시)</strong>: 한글 자음(ㄱ, ㄴ, ㅅ, ㅈ) 포즈를 0.5초 유지하면 전멸기 발동!';
      }
    }
  }

  setMode(twoPlayer) {
    this.isTwoPlayer = twoPlayer;
    if (twoPlayer) {
      this.btnModeDuo.classList.add('active');
      this.btnModeSolo.classList.remove('active');
      if (this.instructionPlayers) {
        this.instructionPlayers.innerHTML =
          '👥 <strong>2인 대결 모드</strong>: 1P(왼쪽 하늘색) vs 2P(오른쪽 핑크색) 실시간 골격 분리 경쟁!';
      }
    } else {
      this.btnModeSolo.classList.add('active');
      this.btnModeDuo.classList.remove('active');
      if (this.instructionPlayers) {
        this.instructionPlayers.innerHTML =
          '⚔️ <strong>1인 모드</strong>: 양손(왼손 하늘색 / 오른손 파란색)을 빠르게 휘둘러 베기!';
      }
    }
    this.updateHUDMode(twoPlayer);
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
    // Theme switching disabled
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
      if (this.poseStickmanWrap) {
        this.poseStickmanWrap.innerHTML = currentPose.illustrationSvg || '';
      }

      if (isReady) {
        this.ultimatePoseCard.classList.remove('locked');
        this.ultimatePoseCard.classList.add('ready');
        this.ultimateMoveName.textContent = currentPose.name;
        this.ultimateMoveDesc.textContent = currentPose.desc;
      } else {
        this.ultimatePoseCard.classList.add('locked');
        this.ultimatePoseCard.classList.remove('ready');
        this.ultimateMoveName.textContent = currentPose.name;
        this.ultimateMoveDesc.textContent = `${threshold - clamped}개 더 베면 개방! (클릭 시 가이드)`;
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

  showHeadingDefuse(owner = 'P1', bonusPoints = 10) {
    if (!this.headingContainer) return;
    if (this.headingTimeout) {
      clearTimeout(this.headingTimeout);
    }

    const tag = this.isTwoPlayer ? `${owner} ` : '';
    if (this.headingBannerText) {
      this.headingBannerText.textContent = `${tag}헤딩 성공! 폭탄 방어 (+${bonusPoints}점)!`;
    }

    this.headingContainer.classList.remove('active');
    void this.headingContainer.offsetWidth;
    this.headingContainer.classList.add('active');

    this.headingTimeout = setTimeout(() => {
      this.headingContainer.classList.remove('active');
    }, 950);
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
