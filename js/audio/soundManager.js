/**
 * Procedural Sound Engine using Web Audio API
 * Generates all sound effects synthesized in real time (Zero external audio assets)
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.noiseBuffer = null;
  }

  /**
   * Initializes AudioContext upon user gesture
   */
  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this._generateNoiseBuffer();
      }
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  /**
   * Resumes AudioContext if suspended (browser autoplay policy)
   */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Pre-computes 1-second white noise buffer for whoosh and explosion sounds
   */
  _generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Fast aerodynamic whoosh sound when swinging the blade
   */
  playSwish() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    filter.Q.setValueAtTime(3.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.12);
  }

  /**
   * Crisp, wet squish & slice sound when cutting a fruit
   */
  playSlice() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;

    // 1. Blade metallic ring & downward frequency sweep
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.09);

    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    // 2. High frequency noise pop for wet juice squish
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.28, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.07);
    }
  }

  /**
   * Heavy boom explosion when a bomb is sliced
   */
  playBomb() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;

    // Low sub rumble
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.6);

    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);

    // Noise blast
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.linearRampToValueAtTime(120, now + 0.5);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.5);
    }
  }

  /**
   * Ascending celebratory chime arpeggio for multi-fruit combos
   * @param {number} comboCount - Number of fruits sliced in combo
   */
  playCombo(comboCount = 3) {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
    const count = Math.min(comboCount, frequencies.length);

    frequencies.slice(0, count).forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
  }
}

export const soundManager = new SoundManager();
