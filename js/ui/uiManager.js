/**
 * UI Manager - Handles HUD, Hearts, Combo Popups, High Scores, and Modals
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
    this.startModal = document.getElementById('start-modal');
    this.gameoverModal = document.getElementById('gameover-modal');
    this.statusPill = document.getElementById('status-pill');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');

    this.comboTimeout = null;
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

  updateLives(lives, maxLives = 3) {
    for (let i = 1; i <= maxLives; i++) {
      const heart = document.getElementById(`life-${i}`);
      if (heart) {
        if (i > lives) {
          heart.classList.add('lost');
        } else {
          heart.classList.remove('lost');
        }
      }
    }
  }

  showCombo(count, bonusPoints) {
    if (!this.comboContainer) return;

    if (this.comboTimeout) {
      clearTimeout(this.comboTimeout);
    }

    this.comboTitle.textContent = `${count}x COMBO!`;
    this.comboScore.textContent = `+${bonusPoints} BONUS`;

    this.comboContainer.classList.remove('active');
    // Force DOM reflow to re-trigger animation
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
