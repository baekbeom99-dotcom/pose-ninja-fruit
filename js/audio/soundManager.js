/**
 * Procedural Sound Engine using Web Audio API
 * Generates all sound effects synthesized in real time (Zero external audio assets)
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.noiseBuffer = null;
    this.galagaBgmActive = false;
    this.galagaBgmTimer = null;
    this.galagaBgmNodes = [];
    this.galagaIntroTimeout = null;
  }

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

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  playSwish() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.05);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.14);
    filter.Q.setValueAtTime(3.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.14);
  }

  playSlice() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.1);

    oscGain.gain.setValueAtTime(0.45, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.08);
    }
  }

  playHeartRecovery() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const notes = [659.25, 830.61, 987.77, 1318.51, 1661.22];
    notes.forEach((freq, i) => {
      const start = this.ctx.currentTime + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  /**
   * Heroic power-up chime when Ultimate Move Gauge reaches 100%
   */
  playUltimateReady() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const notes = [440, 554.37, 659.25, 880, 1108.73]; // A Major triumph
    notes.forEach((freq, i) => {
      const start = this.ctx.currentTime + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  /**
   * Thunderous screen-clearing slash when Ultimate Move is triggered
   */
  playUltimateTrigger() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;

    // 1. Dual Sawtooth Lightning Roar
    [-7, 0, 7].forEach(detune => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.detune.setValueAtTime(detune, now);
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.8);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    });

    // 2. High Metallic Shink
    const shink = this.ctx.createOscillator();
    const shinkGain = this.ctx.createGain();
    shink.type = 'sine';
    shink.frequency.setValueAtTime(2400, now);
    shink.frequency.exponentialRampToValueAtTime(600, now + 0.25);
    shinkGain.gain.setValueAtTime(0.6, now);
    shinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    shink.connect(shinkGain);
    shinkGain.connect(this.ctx.destination);
    shink.start(now);
    shink.stop(now + 0.25);
  }

  playBomb() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.7);

    oscGain.gain.setValueAtTime(0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.linearRampToValueAtTime(100, now + 0.6);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.6);
    }
  }

  playCombo(comboCount = 3) {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    const count = Math.min(comboCount, frequencies.length);

    frequencies.slice(0, count).forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  playPortalOpen() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    // Mystical deep dimensional swell & chord
    const freqs = [196.0, 293.66, 392.0, 587.33, 880.0];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 0.8, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.6);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25 / freqs.length, now + 0.2 + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  playCosmicFishSlice() {
    if (!this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    // Crystalline starlight space chime
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playHeadingDefuse() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();

      const now = this.ctx.currentTime;
      // Punchy athletic header thud + triumphant energy ping
      const oscThud = this.ctx.createOscillator();
      const gainThud = this.ctx.createGain();
      oscThud.type = 'triangle';
      oscThud.frequency.setValueAtTime(220, now);
      oscThud.frequency.exponentialRampToValueAtTime(50, now + 0.16);
      gainThud.gain.setValueAtTime(0.55, now);
      gainThud.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      oscThud.connect(gainThud);
      gainThud.connect(this.ctx.destination);
      oscThud.start(now);
      oscThud.stop(now + 0.16);

      const oscChime = this.ctx.createOscillator();
      const gainChime = this.ctx.createGain();
      oscChime.type = 'sine';
      oscChime.frequency.setValueAtTime(880, now);
      oscChime.frequency.exponentialRampToValueAtTime(1760, now + 0.25);
      gainChime.gain.setValueAtTime(0.001, now);
      gainChime.gain.linearRampToValueAtTime(0.35, now + 0.04);
      gainChime.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      oscChime.connect(gainChime);
      gainChime.connect(this.ctx.destination);
      oscChime.start(now);
      oscChime.stop(now + 0.32);
    } catch (e) {
      console.warn('Heading sound playback error:', e);
    }
  }

  playGalagaShoot() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.09);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('Galaga shoot error:', e);
    }
  }

  playGalagaExplosion() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();
      const now = this.ctx.currentTime;

      // Noise burst
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.28);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.28);
      }

      // Low bass punch
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Galaga explosion error:', e);
    }
  }

  playGalagaTractor() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(380, now + 0.1);
      osc.frequency.linearRampToValueAtTime(260, now + 0.2);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Galaga tractor error:', e);
    }
  }

  playGalagaDock() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();
      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.06;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.28, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.12);
      });
    } catch (e) {
      console.warn('Galaga dock error:', e);
    }
  }

  playEmpBlast() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();
      const now = this.ctx.currentTime;

      // Heavy low frequency rumble + sub drop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.45);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);

      // Electric high sizzle burst
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2800, now);
        filter.frequency.exponentialRampToValueAtTime(600, now + 0.35);
        filter.Q.setValueAtTime(4.0, now);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.35, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.35);
      }
    } catch (e) {
      console.warn('EMP sound error:', e);
    }
  }

  playPowerUp() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      });
    } catch (e) {
      console.warn('PowerUp sound error:', e);
    }
  }

  playAsteroidHit() {
    if (!this.ctx || this.isMuted) return;
    try {
      this.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  // --- Galaga Original Arcade BGM & Intro Theme ---

  _playSquareNote(freq, startTime, duration, volume = 0.08) {
    if (!this.ctx || !freq || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      // 8-bit snappy chiptune envelope
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
      gain.gain.setValueAtTime(volume, startTime + duration - 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      this.galagaBgmNodes.push(osc);
    } catch (e) {
      // Audio node scheduling guard
    }
  }

  /**
   * Plays the iconic 1981 arcade Galaga Game Start fanfare (Nobuyuki Ohnogi)
   */
  playGalagaIntro(onComplete) {
    if (!this.ctx || this.isMuted) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    this.resume();
    this.stopGalagaBGM();

    const now = this.ctx.currentTime + 0.05;
    const t16 = 0.104; // 16th note at ~144 BPM

    const N = {
      F2: 87.31,
      Bb2: 116.54,
      C3: 130.81,
      Eb2: 77.78,
      F4: 349.23,
      A4: 440.00,
      Bb4: 466.16,
      C5: 523.25,
      D5: 587.33,
      Eb5: 622.25,
      F5: 698.46,
      G5: 783.99,
      Bb5: 932.33
    };

    // Lead Melody: [frequency, startStep, durationSteps]
    const melody = [
      // Phrase 1 (Bb arpeggio -> C, A, F)
      [N.F4, 0, 1],
      [N.Bb4, 1, 1],
      [N.D5, 2, 1],
      [N.F5, 3, 1],
      [N.D5, 4, 1],
      [N.Bb4, 5, 1],
      [N.C5, 6, 1.5],
      [N.A4, 7.5, 1.5],
      [N.F4, 9, 2],

      // Phrase 2 (Bb arpeggio -> C, F, F)
      [N.F4, 12, 1],
      [N.Bb4, 13, 1],
      [N.D5, 14, 1],
      [N.F5, 15, 1],
      [N.D5, 16, 1],
      [N.Bb4, 17, 1],
      [N.C5, 18, 1.5],
      [N.F5, 19.5, 1.5],
      [N.F5, 21, 2],

      // Phrase 3 (Rapid run down and climb up to high Bb)
      [N.G5, 24, 1],
      [N.F5, 25, 1],
      [N.Eb5, 26, 1],
      [N.D5, 27, 1],
      [N.C5, 28, 1],
      [N.Bb4, 29, 1],
      [N.A4, 30, 1],
      [N.Bb4, 31, 1],
      [N.C5, 32, 1.5],
      [N.F5, 33.5, 1.5],
      [N.Bb5, 35, 3.5]
    ];

    // Bassline accompaniment
    const bass = [
      [N.Bb2, 0, 2],
      [N.F2, 2, 2],
      [N.Bb2, 4, 2],
      [N.F2, 6, 2],
      [N.F2, 8, 2],
      [N.F2, 10, 2],

      [N.Bb2, 12, 2],
      [N.F2, 14, 2],
      [N.Bb2, 16, 2],
      [N.F2, 18, 2],
      [N.C3, 20, 2],
      [N.F2, 22, 2],

      [N.Eb2, 24, 2],
      [N.Bb2, 26, 2],
      [N.F2, 28, 2],
      [N.F2, 30, 2],
      [N.F2, 32, 2],
      [N.Bb2, 34, 4]
    ];

    melody.forEach(([freq, step, dur]) => {
      this._playSquareNote(freq, now + step * t16, dur * t16, 0.12);
    });

    bass.forEach(([freq, step, dur]) => {
      this._playSquareNote(freq, now + step * t16, dur * t16, 0.09);
    });

    const totalDuration = 38.5 * t16;
    if (typeof onComplete === 'function') {
      this.galagaIntroTimeout = setTimeout(() => {
        onComplete();
      }, (totalDuration + 0.1) * 1000);
    }
  }

  /**
   * Continuous looping authentic 8-bit Galaga arcade chiptune BGM
   */
  startGalagaBGM() {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    this.stopGalagaBGM();

    this.galagaBgmActive = true;
    this._scheduleNextGalagaBgmPattern(this.ctx.currentTime + 0.05);
  }

  _scheduleNextGalagaBgmPattern(startTime) {
    if (!this.galagaBgmActive || !this.ctx || this.isMuted) return;

    const t16 = 0.104; // 16th note at ~144 BPM
    const patternSteps = 64; // 4 bars = 64 sixteenth notes
    const patternDuration = patternSteps * t16; // ~6.656 seconds

    const N = {
      Bb2: 116.54,
      C3: 130.81,
      D3: 146.83,
      Eb3: 155.56,
      F2: 87.31,
      G2: 98.00,
      A2: 110.00,
      F3: 174.61,
      Bb3: 233.08,
      F4: 349.23,
      G4: 392.00,
      A4: 440.00,
      Bb4: 466.16,
      C5: 523.25,
      D5: 587.33,
      Eb5: 622.25,
      F5: 698.46,
      Bb5: 932.33
    };

    // 4-Bar Classic Arcade Groove (Lead & Bass)
    // Bar 0: Bb major groove
    // Bar 1: C minor groove
    // Bar 2: F major groove
    // Bar 3: Turnaround flourish
    const bassPattern = [
      // Bar 0 (0-15)
      [N.Bb2, 0], [N.Bb2, 2], [N.F2, 4], [N.Bb2, 6], [N.D3, 8], [N.F2, 10], [N.Bb2, 12], [N.D3, 14],
      // Bar 1 (16-31)
      [N.C3, 16], [N.C3, 18], [N.G2, 20], [N.C3, 22], [N.Eb3, 24], [N.G2, 26], [N.C3, 28], [N.Eb3, 30],
      // Bar 2 (32-47)
      [N.F2, 32], [N.F2, 34], [N.C3, 36], [N.F2, 38], [N.A2, 40], [N.C3, 42], [N.F2, 44], [N.A2, 46],
      // Bar 3 (48-63)
      [N.Bb2, 48], [N.D3, 50], [N.F3, 52], [N.Bb3, 54], [N.F3, 56], [N.D3, 58], [N.Bb2, 60]
    ];

    const leadPattern = [
      // Bar 0
      [N.F4, 0, 1.5], [N.Bb4, 2, 1.5], [N.D5, 4, 1.5], [N.Bb4, 6, 1.5],
      [N.F4, 8, 1.5], [N.D5, 10, 1.5], [N.Bb4, 12, 1.5], [N.F4, 14, 1.5],
      // Bar 1
      [N.G4, 16, 1.5], [N.C5, 18, 1.5], [N.Eb5, 20, 1.5], [N.C5, 22, 1.5],
      [N.G4, 24, 1.5], [N.Eb5, 26, 1.5], [N.C5, 28, 1.5], [N.G4, 30, 1.5],
      // Bar 2
      [N.A4, 32, 1.5], [N.C5, 34, 1.5], [N.F5, 36, 1.5], [N.C5, 38, 1.5],
      [N.A4, 40, 1.5], [N.F5, 42, 1.5], [N.C5, 44, 1.5], [N.A4, 46, 1.5],
      // Bar 3
      [N.Bb4, 48, 1.5], [N.D5, 50, 1.5], [N.F5, 52, 1.5], [N.Bb5, 54, 2.0],
      [N.F5, 57, 1.5], [N.D5, 59, 1.5], [N.Bb4, 61, 2.5]
    ];

    bassPattern.forEach(([freq, step]) => {
      this._playSquareNote(freq, startTime + step * t16, t16 * 1.5, 0.07);
    });

    leadPattern.forEach(([freq, step, dur]) => {
      this._playSquareNote(freq, startTime + step * t16, dur * t16, 0.08);
    });

    // Schedule next pattern 250ms before current pattern ends
    const nextStartTime = startTime + patternDuration;
    const msUntilNext = Math.max(100, (nextStartTime - this.ctx.currentTime - 0.25) * 1000);

    this.galagaBgmTimer = setTimeout(() => {
      if (this.galagaBgmActive) {
        this._scheduleNextGalagaBgmPattern(nextStartTime);
      }
    }, msUntilNext);
  }

  stopGalagaBGM() {
    this.galagaBgmActive = false;
    if (this.galagaBgmTimer) {
      clearTimeout(this.galagaBgmTimer);
      this.galagaBgmTimer = null;
    }
    if (this.galagaIntroTimeout) {
      clearTimeout(this.galagaIntroTimeout);
      this.galagaIntroTimeout = null;
    }
    if (this.galagaBgmNodes) {
      this.galagaBgmNodes.forEach(node => {
        try {
          node.stop();
          node.disconnect();
        } catch (e) {}
      });
      this.galagaBgmNodes = [];
    }
  }
}

export const soundManager = new SoundManager();
