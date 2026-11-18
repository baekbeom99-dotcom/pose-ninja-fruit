import { soundManager } from '../audio/soundManager.js';

/**
 * UI Manager - Handles HUD, Hearts, Combo Popups, High Scores, Ultimate Gauge,
 * Fullscreen, Exit, and Visual Posture Guide Modal.
 */
export class UIManager {
  constructor() {
    this.scoreText = document.getElementById('score-text');
    this.highScoreText = document.getElementById('high-score-text');
    this.finalScoreText = document.getElementById('final-score-text');
    this.soloScorePanel = document.getElementById('solo-score-panel');
    this.gameoverSoloContent = document.getElementById('gameover-solo-content');

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
    this.btnStartFullscreen = document.getElementById('btn-start-fullscreen');
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

    // Special Game Modes Tabs
    this.btnModeClassic = document.getElementById('btn-mode-classic');
    this.btnModeStrange = document.getElementById('btn-mode-strange');
    this.btnModeUfo = document.getElementById('btn-mode-ufo');
    this.btnModeGalaga = document.getElementById('btn-mode-galaga');
    this.btnModeCrossy = document.getElementById('btn-mode-crossy');
    this.btnModePoop = document.getElementById('btn-mode-poop');
    this.btnModeRedLight = document.getElementById('btn-mode-redlight');
    this.ultimatePanel = document.getElementById('ultimate-panel');
    this.instructionModeDesc = document.getElementById('instruction-mode-desc');
    this.instructionSpecial = document.getElementById('instruction-special');
    this.instructionTip1 = document.getElementById('instruction-tip-1');
    this.instructionTip2 = document.getElementById('instruction-tip-2');
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
    // Special Game Modes Tabs
    const tabs = [
      { btn: this.btnModeClassic, mode: 'CLASSIC' },
      { btn: this.btnModeStrange, mode: 'DOCTOR_STRANGE' },
      { btn: this.btnModeUfo, mode: 'UFO_FISH' },
      { btn: this.btnModeGalaga, mode: 'GALAGA' },
      { btn: this.btnModeCrossy, mode: 'CROSSY' },
      { btn: this.btnModePoop, mode: 'POOP_DODGE' },
      { btn: this.btnModeRedLight, mode: 'RED_LIGHT' }
    ];

    tabs.forEach(({ btn, mode }) => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.setGameMode(mode);
        });
      }
    });

    // Fullscreen Toggle (Synchronized for HUD and Start Screen)
    const FULLSCREEN_ENTER_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/></svg>';
    const FULLSCREEN_EXIT_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4"/></svg>';

    const toggleFullscreen = () => {
      soundManager.init();
      soundManager.resume();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((err) => {
            console.warn('Exit fullscreen failed:', err);
          });
        }
      }
    };

    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', toggleFullscreen);
    }
    if (this.btnStartFullscreen) {
      this.btnStartFullscreen.addEventListener('click', toggleFullscreen);
    }

    const updateFullscreenUI = () => {
      const isFs = !!document.fullscreenElement;
      if (this.btnFullscreen) {
        this.btnFullscreen.textContent = isFs ? '⛶ 창모드' : '⛶ 전체화면';
      }
      if (this.btnStartFullscreen) {
        this.btnStartFullscreen.title = isFs ? '창모드로 전환 (ESC)' : '전체화면으로 전환';
        this.btnStartFullscreen.innerHTML = isFs ? FULLSCREEN_EXIT_SVG : FULLSCREEN_ENTER_SVG;
      }
    };

    document.addEventListener('fullscreenchange', updateFullscreenUI);
    document.addEventListener('webkitfullscreenchange', updateFullscreenUI);

    // Exit Button
    if (this.btnExit) {
      this.btnExit.addEventListener('click', () => {
        soundManager.stopGalagaBGM();
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

    [this.btnModeClassic, this.btnModeStrange, this.btnModeUfo, this.btnModeGalaga, this.btnModeCrossy, this.btnModePoop, this.btnModeRedLight].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    const restoreFruitTips = () => {
      if (this.instructionTip1) {
        this.instructionTip1.innerHTML = '💖 <strong>하트 보너스</strong>: 반짝이는 하트를 베면 생명(+1)이 회복됩니다!';
      }
      if (this.instructionTip2) {
        this.instructionTip2.innerHTML = '💣 <strong>폭탄 격파</strong>: 닿으면 하트 2개 차감! 머리(헤딩 ⚽)로 들이받으면 안전하게 격파 (+10점)!';
      }
    };

    if (mode === 'DOCTOR_STRANGE') {
      if (this.btnModeStrange) this.btnModeStrange.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '🔮 <strong>닥터 스트레인지 모드</strong>: 양손 사이를 잇는 마법 광선 검으로 모든 과일을 절단!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '🌀 <strong>Y자 차원 포털</strong>: 양팔을 위로 활짝 벌려 큰 <strong>Y자</strong> 포즈를 취하면 화면 전체 전멸!';
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
    } else if (mode === 'GALAGA') {
      if (this.btnModeGalaga) this.btnModeGalaga.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '👾 <strong>갤러그 모드</strong>: 머리를 좌우로 부드럽게 움직여 비행기 조종! 자동 연속 총알 발사!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '🚀 <strong>하이퍼 윙맨 폭격 (스테이지당 2회)</strong>: 만세🙌 자세(또는 Space)로 편대 메가 레이저 일제 사격 + 적 미사일 일괄 소거!';
      }
    } else if (mode === 'CROSSY') {
      if (this.btnModeCrossy) this.btnModeCrossy.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '🐔 <strong>길건너 점프 모드</strong>: <strong>제자리 점프</strong> 또는 <strong>🪽 양팔 날개짓</strong>으로 앞으로 1칸씩 전진!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '🛶 <strong>뗏목 표류 & 중앙 복귀</strong>: 강 위 뗏목(동전 포함)을 타면 좌우로 흘러갑니다! 육지로 돌아와 뛰면 중앙으로 자동 복귀!';
      }
      if (this.instructionTip1) {
        this.instructionTip1.innerHTML =
          '🚆 <strong>도로 & 철도 타이밍</strong>: 차와 기차 경고등을 피해 연속 전진 콤보 & 코인(⭐ +5점) 획득!';
      }
      if (this.instructionTip2) {
        this.instructionTip2.innerHTML =
          '🕹️ <strong>간편 조작 지원</strong>: <code>Space</code> / <code>↑</code> 키 또는 화면 클릭/터치로도 바로 점프 가능!';
      }
    } else if (mode === 'POOP_DODGE') {
      if (this.btnModePoop) this.btnModePoop.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '💩 <strong>똥피하기 모드</strong>: 머리 X좌표로 <strong>랜덤 캐릭터(033~038)</strong>를 조종해 쏟아지는 똥을 피하세요! (3초 한자리 금지)';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '🌈 <strong>무지개 똥 & 휴지 보너스</strong>: 🌈 무지개 똥(<code>+25점</code>) · 🧻 휴지(<code>+15점</code>) · ☂️ 우산 보호막을 획득하세요!';
      }
      if (this.instructionTip1) {
        this.instructionTip1.innerHTML =
          '🐘 <strong>Lv5+ 코끼리 똥 & 폭격 경보</strong>: 거대 코끼리 똥은 5초간 미끄러운 <strong>빙판</strong>을 만들고, 🚨 경보 시 <strong>안전구역</strong>으로 대피하세요!';
      }
      if (this.instructionTip2) {
        this.instructionTip2.innerHTML =
          '🖱️ <strong>마우스/터치 폴백</strong>: 카메라 없이도 마우스·손가락 좌우 이동으로 바로 플레이 가능합니다!';
      }
    } else if (mode === 'RED_LIGHT') {
      if (this.btnModeRedLight) this.btnModeRedLight.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '🌺 <strong>무궁화 꽃이 피었습니다</strong>: 제자리에서 힘차게 달리면 목표 지점(영희)이 점점 커지며 다가갑니다!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '👁️ <strong>붉은 눈동자 스캔</strong>: 구호가 끝나고 눈동자가 붉게 변하면 <strong>즉시 얼음!</strong> 움직임이 감지되면 탈락!';
      }
      if (this.instructionTip1) {
        this.instructionTip1.innerHTML =
          '🙌 <strong>만세 터치 & 반대방향 전력 질주</strong>: 목표 도착 후 <strong>만세</strong>로 술래를 터치하고 출발선까지 빠르게 도망치세요 (늦으면 잡힘)!';
      }
      if (this.instructionTip2) {
        this.instructionTip2.innerHTML =
          '🕹️ <strong>간편 조작 지원</strong>: <code>Space</code> 연타 또는 화면 터치·클릭으로도 달리기 및 만세 터치 가능!';
      }
    } else {
      restoreFruitTips();
      if (this.btnModeClassic) this.btnModeClassic.classList.add('active');
      if (this.instructionModeDesc) {
        this.instructionModeDesc.innerHTML =
          '⚔️ <strong>클래식 닌자 모드</strong>: 양손 독립 검기로 높이 솟구치는 과일을 베어보세요!';
      }
      if (this.instructionSpecial) {
        this.instructionSpecial.innerHTML =
          '⚡ <strong>필살기 (12개 절단 시)</strong>: 한글 자음(ㄱ, ㄴ, ㅅ, ㅇ) 포즈를 0.5초 유지하면 전멸기 발동!';
      }
    }
    if (mode !== 'CROSSY' && mode !== 'POOP_DODGE' && mode !== 'RED_LIGHT') {
      restoreFruitTips();
    }
  }

  setMode(twoPlayer = false) {
    this.isTwoPlayer = false;
    this.updateHUDMode(false, this.selectedGameMode);
  }

  updateHUDMode(twoPlayer = false, gameMode = 'CLASSIC') {
    const hideFruitUltimate =
      gameMode === 'GALAGA' ||
      gameMode === 'CROSSY' ||
      gameMode === 'POOP_DODGE' ||
      gameMode === 'RED_LIGHT';
    if (this.livesContainer) {
      this.livesContainer.classList.toggle('hidden', gameMode === 'RED_LIGHT');
    }
    if (this.soloScorePanel) this.soloScorePanel.classList.remove('hidden');
    if (this.ultimatePanel) {
      if (hideFruitUltimate) {
        this.ultimatePanel.classList.add('hidden');
      } else {
        this.ultimatePanel.classList.remove('hidden');
      }
    }
    if (this.btnGuide) {
      if (hideFruitUltimate) {
        this.btnGuide.classList.add('hidden');
      } else {
        this.btnGuide.classList.remove('hidden');
      }
    }
  }

  updateScores(p1Score, p2Score = 0, isTwoPlayer = false) {
    if (this.scoreText) this.scoreText.textContent = p1Score;
    if (p1Score > this.highScore) {
      this.highScore = p1Score;
      localStorage.setItem('pose_ninja_highscore', p1Score.toString());
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
    if (this.gameoverSoloContent) this.gameoverSoloContent.classList.remove('hidden');
    if (this.finalScoreText) {
      this.finalScoreText.textContent = p1Score;
    }
    this.gameoverModal.classList.remove('hidden');
  }

  hideGameOverModal() {
    this.gameoverModal.classList.add('hidden');
  }
}
