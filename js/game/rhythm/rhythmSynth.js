/**
 * Built-in Web Audio API Rhythm Synth Engine & Master Clock
 * Zero external audio assets: synthesizes drums, basslines, arpeggios, leads,
 * and rhythm judgment SFX on a sample-accurate AudioContext scheduler.
 */

export const RHYTHM_TRACKS = [
  {
    id: 'neon_cruise',
    title: '네온 크루즈',
    subtitle: '112 BPM · Chill Synthwave',
    difficulty: 'EASY',
    bpm: 112,
    bars: 18,
    accentColor: '#22d3ee',
    secondaryColor: '#38bdf8',
    bassWave: 'sawtooth',
    leadWave: 'triangle',
    bassNotes: [
      130.81, 0, 130.81, 0, 155.56, 0, 174.61, 0,
      196.0, 0, 174.61, 0, 155.56, 0, 146.83, 0
    ],
    leadNotes: [
      523.25, 0, 622.25, 0, 587.33, 523.25, 392.0, 0,
      466.16, 0, 523.25, 0, 698.46, 622.25, 523.25, 0
    ]
  },
  {
    id: 'cyber_pulse',
    title: '사이버 펄스',
    subtitle: '128 BPM · Electro Groove',
    difficulty: 'NORMAL',
    bpm: 128,
    bars: 22,
    accentColor: '#f472b6',
    secondaryColor: '#a855f7',
    bassWave: 'sawtooth',
    leadWave: 'square',
    bassNotes: [
      110.0, 110.0, 0, 220.0, 110.0, 0, 130.81, 0,
      146.83, 146.83, 0, 293.66, 164.81, 0, 196.0, 0
    ],
    leadNotes: [
      440.0, 0, 523.25, 659.25, 0, 587.33, 523.25, 0,
      659.25, 0, 783.99, 0, 659.25, 587.33, 523.25, 440.0
    ]
  },
  {
    id: 'overdrive_blitz',
    title: '오버드라이브',
    subtitle: '142 BPM · Neon Overdrive',
    difficulty: 'HARD',
    bpm: 142,
    bars: 24,
    accentColor: '#facc15',
    secondaryColor: '#f97316',
    bassWave: 'square',
    leadWave: 'sawtooth',
    bassNotes: [
      146.83, 146.83, 293.66, 146.83, 174.61, 174.61, 349.23, 174.61,
      196.0, 196.0, 392.0, 196.0, 220.0, 220.0, 440.0, 261.63
    ],
    leadNotes: [
      587.33, 698.46, 880.0, 698.46, 587.33, 880.0, 1046.5, 880.0,
      783.99, 698.46, 587.33, 698.46, 880.0, 1046.5, 1174.66, 880.0
    ]
  }
];

export function getTrackById(trackId) {
  return RHYTHM_TRACKS.find((t) => t.id === trackId) || RHYTHM_TRACKS[0];
}

export class RhythmSynth {
  constructor(externalSoundManager = null) {
    this.externalSound = externalSoundManager;
    this.ctx = null;
    this.noiseBuffer = null;
    this.isMuted = false;

    this.isPlaying = false;
    this.currentTrack = RHYTHM_TRACKS[0];
    this.trackStartAudioTime = 0;
    this.fallbackElapsed = 0;
    this.nextStepIndex = 0;
    this.nextStepTime = 0;
    this.schedulerTimer = null;
    this.activeNodes = new Set();

    // Pre-song beat count-in (4 beats before step 0 notes drop)
    this.countInBeats = 4;
  }

  _ensureContext() {
    if (this.externalSound && this.externalSound.ctx) {
      this.ctx = this.externalSound.ctx;
      this.noiseBuffer = this.externalSound.noiseBuffer || this.noiseBuffer;
    }

    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch (err) {
        this.ctx = null;
      }
    }

    if (this.ctx && !this.noiseBuffer) {
      const sampleRate = this.ctx.sampleRate || 44100;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 0.5, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {}
    }

    return this.ctx;
  }

  /**
   * Returns current track timeline in seconds, starting at 0.0 when playback begins.
   * Uses AudioContext.currentTime in browser for zero-drift audio/visual sync,
   * and accumulated dt in headless Node tests.
   */
  getSongTime() {
    if (!this.isPlaying) return this.fallbackElapsed;
    if (this.ctx && typeof this.ctx.currentTime === 'number') {
      return Math.max(0, this.ctx.currentTime - this.trackStartAudioTime);
    }
    return Math.max(0, this.fallbackElapsed);
  }

  advanceFallbackTime(dt) {
    if (!this.isPlaying) return;
    if (!this.ctx) {
      this.fallbackElapsed += Math.max(0, dt);
    }
  }

  getTrackDuration(track = this.currentTrack) {
    const stepSec = 60 / track.bpm / 4; // 16th note
    const countInSec = this.countInBeats * (60 / track.bpm);
    const totalSteps = track.bars * 16;
    return countInSec + totalSteps * stepSec;
  }

  start(trackId = 'neon_cruise') {
    this.stop();
    this.currentTrack = getTrackById(trackId);
    this.isPlaying = true;
    this.fallbackElapsed = 0;
    this.nextStepIndex = 0;

    if (this.externalSound) {
      this.isMuted = !!this.externalSound.isMuted;
      if (typeof this.externalSound.init === 'function') this.externalSound.init();
      if (typeof this.externalSound.resume === 'function') this.externalSound.resume();
    }

    const ctx = this._ensureContext();
    if (ctx && typeof ctx.currentTime === 'number') {
      const leadOffset = 0.06;
      this.trackStartAudioTime = ctx.currentTime + leadOffset;
      this.nextStepTime = this.trackStartAudioTime;
      this._scheduleLoop();
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.activeNodes.forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop();
        node.disconnect();
      } catch (e) {}
    });
    this.activeNodes.clear();
  }

  _scheduleLoop() {
    if (!this.isPlaying || !this.ctx) return;

    const lookaheadSec = 0.16;
    const stepSec = 60 / this.currentTrack.bpm / 4; // 16th note step
    const countInSteps = this.countInBeats * 4;
    const totalSteps = countInSteps + this.currentTrack.bars * 16;

    while (
      this.nextStepIndex < totalSteps &&
      this.nextStepTime < this.ctx.currentTime + lookaheadSec
    ) {
      if (!this.isMuted && !(this.externalSound && this.externalSound.isMuted)) {
        this._scheduleStep(this.nextStepIndex, this.nextStepTime, stepSec, countInSteps);
      }
      this.nextStepTime += stepSec;
      this.nextStepIndex++;
    }

    if (this.nextStepIndex < totalSteps && this.isPlaying) {
      this.schedulerTimer = setTimeout(() => this._scheduleLoop(), 25);
    }
  }

  _scheduleStep(globalStep, time, stepSec, countInSteps) {
    // Count-in metronome clicks on quarter beats (steps 0, 4, 8, 12)
    if (globalStep < countInSteps) {
      if (globalStep % 4 === 0) {
        const isFirst = globalStep === 0;
        this._playMetronomeClick(time, isFirst ? 980 : 720, isFirst ? 0.18 : 0.12);
      }
      return;
    }

    const songStep = globalStep - countInSteps;
    const stepInBar = songStep % 16;
    const barIndex = Math.floor(songStep / 16);
    const track = this.currentTrack;

    // 1. Kick on 0, 4, 8, 12 (plus syncopated kick for Hard track)
    if (
      stepInBar % 4 === 0 ||
      (track.difficulty === 'HARD' && (stepInBar === 10 || stepInBar === 14))
    ) {
      this._playKick(time);
    }

    // 2. Snare on 4 & 12
    if (stepInBar === 4 || stepInBar === 12) {
      this._playSnare(time);
    }

    // 3. Hi-hat on off-beats & 16ths in higher intensity bars
    if (stepInBar % 2 === 1 || (track.difficulty !== 'EASY' && stepInBar % 2 === 0)) {
      const openHat = stepInBar === 2 || stepInBar === 10;
      this._playHiHat(time, openHat ? 0.08 : 0.04, openHat ? 0.075 : 0.04);
    }

    // 4. Driving Synth Bassline
    const bassFreq = track.bassNotes[stepInBar % track.bassNotes.length];
    if (bassFreq > 0) {
      // Shift root up a 4th or 5th every 4 bars for musical progression
      const harmonicMult = barIndex % 8 >= 4 ? (barIndex % 8 >= 6 ? 1.122 : 1.335) : 1.0;
      this._playSynthVoice(
        bassFreq * harmonicMult,
        time,
        stepSec * 1.4,
        track.bassWave || 'sawtooth',
        0.095,
        750
      );
    }

    // 5. Neon Lead / Arpeggio
    const leadFreq = track.leadNotes[stepInBar % track.leadNotes.length];
    if (leadFreq > 0 && barIndex >= 1) {
      const chorusBoost = barIndex >= 4 && barIndex % 8 >= 4 ? 1.0 : 0.72;
      const harmonicMult = barIndex % 8 >= 4 ? 1.0 : 1.0;
      this._playSynthVoice(
        leadFreq * harmonicMult,
        time,
        stepSec * 1.75,
        track.leadWave || 'triangle',
        0.065 * chorusBoost,
        2800
      );
    }
  }

  _trackNode(node) {
    this.activeNodes.add(node);
    if (node && typeof node === 'object') {
      node.onended = () => {
        this.activeNodes.delete(node);
      };
    }
  }

  _playMetronomeClick(time, freq, vol = 0.14) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, time + 0.06);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this._trackNode(osc);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  _playKick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);

    gain.gain.setValueAtTime(0.42, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this._trackNode(osc);
    osc.start(time);
    osc.stop(time + 0.19);
  }

  _playSnare(time) {
    if (!this.ctx) return;
    // Noise snap
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      this._trackNode(noise);
      noise.start(time);
      noise.stop(time + 0.15);
    }

    // Body thump
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.09);

    oscGain.gain.setValueAtTime(0.18, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    this._trackNode(osc);
    osc.start(time);
    osc.stop(time + 0.11);
  }

  _playHiHat(time, duration = 0.04, volume = 0.04) {
    if (!this.ctx || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    this._trackNode(noise);
    noise.start(time);
    noise.stop(time + duration + 0.01);
  }

  _playSynthVoice(freq, time, duration, wave = 'sawtooth', vol = 0.08, cutoff = 1800) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(250, cutoff * 0.45), time + duration);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    this._trackNode(osc);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  // ---- Immediate Player Feedback SFX ----

  playHitSFX(grade = 'PERFECT', isSlash = false) {
    const ctx = this._ensureContext();
    if (!ctx || this.isMuted || (this.externalSound && this.externalSound.isMuted)) return;

    const now = ctx.currentTime;
    if (grade === 'MISS') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
      return;
    }

    const baseFreq = grade === 'PERFECT' ? 1046.5 : grade === 'GREAT' ? 880 : 659.25;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isSlash ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(isSlash ? baseFreq * 1.45 : baseFreq * 1.12, now + 0.09);

    gain.gain.setValueAtTime(grade === 'PERFECT' ? 0.22 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playDodgeClearSFX() {
    const ctx = this._ensureContext();
    if (!ctx || this.isMuted || (this.externalSound && this.externalSound.isMuted)) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playFeverTriggerSFX() {
    const ctx = this._ensureContext();
    if (!ctx || this.isMuted || (this.externalSound && this.externalSound.isMuted)) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const t = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }
}
