/**
 * Deterministic Beat-Locked Rhythm Chart Generator
 * Type C Hybrid Design ("Beat Pose Arena" - Minimized Static Poses):
 *   - ~65% TAP Beat Orbs (hit/touch target pad on beat)
 *   - ~25% SLASH Notes (directional hand swipe across pad)
 *   - ~8% DODGE Barriers (brief head dodge left/right/duck)
 *   - 1-2 FEVER_POSE moments per track (optional Manse bonus at chorus drops)
 */

import { getTrackById } from './rhythmSynth.js';

export const RhythmNoteType = {
  TAP: 'TAP',
  SLASH: 'SLASH',
  DODGE: 'DODGE',
  FEVER_POSE: 'FEVER_POSE'
};

export const SlashDirection = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  UP: 'UP',
  DOWN: 'DOWN'
};

export const DodgeZone = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  TOP: 'TOP'
};

// 4 ergonomic upper/mid play zones (normalized coordinates [0..1])
export const RHYTHM_LANES = [
  { id: 0, name: 'LEFT_HIGH', side: 'L', nx: 0.23, ny: 0.31, color: '#22d3ee', glow: 'rgba(34, 211, 238, 0.55)' },
  { id: 1, name: 'LEFT_MID', side: 'L', nx: 0.21, ny: 0.62, color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.55)' },
  { id: 2, name: 'RIGHT_HIGH', side: 'R', nx: 0.77, ny: 0.31, color: '#f472b6', glow: 'rgba(244, 114, 182, 0.55)' },
  { id: 3, name: 'RIGHT_MID', side: 'R', nx: 0.79, ny: 0.62, color: '#facc15', glow: 'rgba(250, 204, 21, 0.55)' }
];

// Generous timing windows tailored for 30-60fps webcam motion tracking
export const TIMING_WINDOWS = {
  PERFECT_MS: 105,
  GREAT_MS: 185,
  GOOD_MS: 275,
  MISS_AFTER_MS: 275
};

export const GRADE_POINTS = {
  PERFECT: 300,
  GREAT: 200,
  GOOD: 100,
  MISS: 0,
  DODGE_CLEAR: 250,
  FEVER_BONUS: 600
};

/**
 * Evaluates absolute timing delta (in ms) into Rhythm Judgment Grade.
 * @param {number} absDeltaMs
 * @returns {'PERFECT'|'GREAT'|'GOOD'|'MISS'}
 */
export function evaluateTiming(absDeltaMs) {
  if (absDeltaMs <= TIMING_WINDOWS.PERFECT_MS) return 'PERFECT';
  if (absDeltaMs <= TIMING_WINDOWS.GREAT_MS) return 'GREAT';
  if (absDeltaMs <= TIMING_WINDOWS.GOOD_MS) return 'GOOD';
  return 'MISS';
}

/**
 * Generates a deterministic chart of beat-locked events for the given track.
 * @param {string} trackId
 * @param {number} [countInBeats=4]
 */
export function generateChart(trackId = 'neon_cruise', countInBeats = 4) {
  const track = getTrackById(trackId);
  const beatSec = 60 / track.bpm;
  const approachTime =
    track.difficulty === 'HARD' ? 0.98 : track.difficulty === 'NORMAL' ? 1.12 : 1.25;

  const events = [];
  let nextId = 1;

  const pushNote = (beatOffset, laneIndex, type, extra = {}) => {
    const targetTime = (countInBeats + beatOffset) * beatSec;
    events.push({
      id: nextId++,
      type,
      laneIndex,
      lane: laneIndex != null ? RHYTHM_LANES[laneIndex] : null,
      beatOffset,
      targetTime,
      approachTime,
      hit: false,
      missed: false,
      grade: null,
      ...extra
    });
  };

  // Musical bar loop (skip final bar for clean outro ring-out)
  const activeBars = Math.max(4, track.bars - 1);
  const slashDirs = [SlashDirection.DOWN, SlashDirection.RIGHT, SlashDirection.LEFT, SlashDirection.UP];
  const dodgeZones = [DodgeZone.LEFT, DodgeZone.RIGHT, DodgeZone.TOP];

  // Put 1 chorus Fever Pose on Easy/Normal, 2 on Hard (minimized pose frequency!)
  const chorusBarA = Math.floor(activeBars * 0.45);
  const chorusBarB = track.difficulty === 'HARD' ? Math.floor(activeBars * 0.78) : -1;

  for (let bar = 0; bar < activeBars; bar++) {
    const barBeat = bar * 4;

    // 1. Rare Chorus Fever Pose (Manse bonus wave, lasts ~2 beats, zero penalty if skipped)
    if (bar === chorusBarA || bar === chorusBarB) {
      pushNote(barBeat + 1.0, null, RhythmNoteType.FEVER_POSE, {
        label: '🙌 만세 피버! 양손을 머리 위로!',
        windowStart: (countInBeats + barBeat - 0.5) * beatSec,
        windowEnd: (countInBeats + barBeat + 2.5) * beatSec,
        durationMultiplierSec: 8.0
      });
      // Give breathing room on bar+1 after fever peak on Easy
      if (track.difficulty === 'EASY') continue;
    }

    // 2. Occasional Neon Dodge Barrier (every ~5-6 bars, starting bar 3)
    if (bar >= 3 && bar % 5 === 3 && bar !== chorusBarA && bar !== chorusBarB) {
      const zone = dodgeZones[Math.floor(bar / 5) % dodgeZones.length];
      pushNote(barBeat + 2.0, null, RhythmNoteType.DODGE, {
        dodgeZone: zone,
        label:
          zone === DodgeZone.TOP
            ? '⬇️ 머리 숙여 피하기!'
            : zone === DodgeZone.LEFT
              ? '➡️ 오른쪽으로 피해!'
              : '⬅️ 왼쪽으로 피해!'
      });
      // Also allow 1 clean beat tap before the barrier on Hard/Normal
      if (track.difficulty !== 'EASY') {
        pushNote(barBeat + 0.0, bar % 2 === 0 ? 0 : 2, RhythmNoteType.TAP);
      }
      continue;
    }

    // 3. Core Rhythmic Hand Pattern (88%+ of gameplay)
    if (track.difficulty === 'EASY') {
      // Bar alternates smoothly left/right on beats 0 & 2 (+ beat 3 fill on every 4th bar)
      const firstLane = bar % 2 === 0 ? 0 : 2;
      const secondLane = bar % 2 === 0 ? 3 : 1;

      pushNote(barBeat + 0.0, firstLane, RhythmNoteType.TAP);

      if (bar % 3 === 2) {
        const dir = firstLane < 2 ? SlashDirection.RIGHT : SlashDirection.LEFT;
        pushNote(barBeat + 2.0, secondLane, RhythmNoteType.SLASH, { direction: dir });
      } else {
        pushNote(barBeat + 2.0, secondLane, RhythmNoteType.TAP);
      }

      if (bar % 4 === 3) {
        pushNote(barBeat + 3.0, (bar + 1) % 4, RhythmNoteType.TAP);
      }
    } else if (track.difficulty === 'NORMAL') {
      // Flowing 4-beat groove: taps on 0, 1, 2 + directional slash on 3 every other bar
      const baseLeft = bar % 2 === 0;
      pushNote(barBeat + 0.0, baseLeft ? 0 : 2, RhythmNoteType.TAP);
      pushNote(barBeat + 1.0, baseLeft ? 1 : 3, RhythmNoteType.TAP);
      pushNote(barBeat + 2.0, baseLeft ? 2 : 0, RhythmNoteType.TAP);

      if (bar % 2 === 1) {
        const slashLane = baseLeft ? 3 : 1;
        const dir = slashDirs[bar % slashDirs.length];
        pushNote(barBeat + 3.0, slashLane, RhythmNoteType.SLASH, { direction: dir });
      }
    } else {
      // HARD (Overdrive Blitz): energetic 4-beat combos + occasional eighth-note double hit
      const pattern = bar % 4;
      if (pattern === 0) {
        pushNote(barBeat + 0.0, 0, RhythmNoteType.TAP);
        pushNote(barBeat + 1.0, 2, RhythmNoteType.TAP);
        pushNote(barBeat + 2.0, 1, RhythmNoteType.SLASH, { direction: SlashDirection.RIGHT });
        pushNote(barBeat + 3.0, 3, RhythmNoteType.SLASH, { direction: SlashDirection.LEFT });
      } else if (pattern === 1) {
        pushNote(barBeat + 0.0, 2, RhythmNoteType.TAP);
        pushNote(barBeat + 0.5, 0, RhythmNoteType.TAP);
        pushNote(barBeat + 1.5, 3, RhythmNoteType.TAP);
        pushNote(barBeat + 2.5, 1, RhythmNoteType.SLASH, { direction: SlashDirection.DOWN });
        pushNote(barBeat + 3.5, 2, RhythmNoteType.TAP);
      } else if (pattern === 2) {
        pushNote(barBeat + 0.0, 1, RhythmNoteType.TAP);
        pushNote(barBeat + 1.0, 3, RhythmNoteType.TAP);
        pushNote(barBeat + 2.0, 2, RhythmNoteType.SLASH, { direction: SlashDirection.UP });
        pushNote(barBeat + 3.0, 0, RhythmNoteType.SLASH, { direction: SlashDirection.DOWN });
      } else {
        pushNote(barBeat + 0.0, 0, RhythmNoteType.TAP);
        pushNote(barBeat + 1.0, 2, RhythmNoteType.TAP);
        pushNote(barBeat + 1.5, 3, RhythmNoteType.TAP);
        pushNote(barBeat + 2.5, 1, RhythmNoteType.TAP);
        pushNote(barBeat + 3.0, 2, RhythmNoteType.SLASH, { direction: SlashDirection.RIGHT });
      }
    }
  }

  // Sort chronologically
  events.sort((a, b) => a.targetTime - b.targetTime);

  return {
    track,
    beatSec,
    approachTime,
    events,
    totalScorableNotes: events.filter(
      (e) => e.type === RhythmNoteType.TAP || e.type === RhythmNoteType.SLASH || e.type === RhythmNoteType.DODGE
    ).length
  };
}
