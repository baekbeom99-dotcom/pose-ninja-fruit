/**
 * Deterministic Beat-Locked Rhythm Chart Generator
 * Type C Hybrid Design ("Beat Pose Arena" - Minimized Static Poses):
 *   - 5 Semicircular Hitbox Sectors centered above the player's body with explicit gaps
 *   - ~65% TAP Tunnel Light Arches
 *   - ~25% SLASH Directional Light Arches
 *   - ~8% DODGE Barriers (brief head dodge left/right/top)
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

// Upper Semicircle Geometry divided into 5 spaced arc hitboxes (PI -> 2*PI clockwise)
export const SEMICIRCLE_SECTOR_COUNT = 5;
export const SEMICIRCLE_START_ANGLE = Math.PI;
export const SEMICIRCLE_END_ANGLE = Math.PI * 2;
export const SECTOR_GAP_RAD = (7 * Math.PI) / 180; // 7 deg gap between adjacent hitboxes
export const SECTOR_SPAN_RAD =
  (SEMICIRCLE_END_ANGLE - SEMICIRCLE_START_ANGLE - (SEMICIRCLE_SECTOR_COUNT - 1) * SECTOR_GAP_RAD) /
  SEMICIRCLE_SECTOR_COUNT;

export function getSectorAngleRange(sectorIndex) {
  const idx = Math.max(0, Math.min(SEMICIRCLE_SECTOR_COUNT - 1, sectorIndex));
  const startAngle = SEMICIRCLE_START_ANGLE + idx * (SECTOR_SPAN_RAD + SECTOR_GAP_RAD);
  const endAngle = startAngle + SECTOR_SPAN_RAD;
  const midAngle = (startAngle + endAngle) * 0.5;
  return { startAngle, endAngle, midAngle };
}

// 5 Semicircular Arch Hitbox Lanes (Left -> Crown -> Right), matching tunnel light hues
const LANE_DEFS = [
  { id: 0, name: 'ARCH_LEFT_LOW', side: 'L', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.65)' },
  { id: 1, name: 'ARCH_LEFT_HIGH', side: 'L', color: '#10b981', glow: 'rgba(16, 185, 129, 0.65)' },
  { id: 2, name: 'ARCH_CROWN_TOP', side: 'C', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.65)' },
  { id: 3, name: 'ARCH_RIGHT_HIGH', side: 'R', color: '#d946ef', glow: 'rgba(217, 70, 239, 0.65)' },
  { id: 4, name: 'ARCH_RIGHT_LOW', side: 'R', color: '#fb7185', glow: 'rgba(251, 113, 133, 0.65)' }
];

export const RHYTHM_LANES = LANE_DEFS.map((def) => {
  const angles = getSectorAngleRange(def.id);
  // Default normalized anchor coordinates derived mathematically around center (0.5, 0.70)
  const defaultR = 0.34;
  return {
    ...def,
    ...angles,
    nx: 0.5 + Math.cos(angles.midAngle) * defaultR,
    ny: 0.70 + Math.sin(angles.midAngle) * (defaultR * (16 / 9) * 0.85)
  };
});

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
 * Generates a deterministic chart of beat-locked events distributed across
 * the 5 semicircular arc hitboxes for the given track.
 * @param {string} trackId
 * @param {number} [countInBeats=4]
 */
export function generateChart(trackId = 'neon_cruise', countInBeats = 4) {
  const track = getTrackById(trackId);
  const beatSec = 60 / track.bpm;
  const approachTime =
    track.difficulty === 'HARD' ? 1.02 : track.difficulty === 'NORMAL' ? 1.18 : 1.32;

  const events = [];
  let nextId = 1;

  const pushNote = (beatOffset, laneIndex, type, extra = {}) => {
    const targetTime = (countInBeats + beatOffset) * beatSec;
    const clampedLane =
      laneIndex != null
        ? ((laneIndex % SEMICIRCLE_SECTOR_COUNT) + SEMICIRCLE_SECTOR_COUNT) % SEMICIRCLE_SECTOR_COUNT
        : null;
    events.push({
      id: nextId++,
      type,
      laneIndex: clampedLane,
      lane: clampedLane != null ? RHYTHM_LANES[clampedLane] : null,
      beatOffset,
      targetTime,
      approachTime,
      hit: false,
      missed: false,
      grade: null,
      ...extra
    });
  };

  const activeBars = Math.max(4, track.bars - 1);
  const slashDirs = [
    SlashDirection.DOWN,
    SlashDirection.RIGHT,
    SlashDirection.LEFT,
    SlashDirection.UP
  ];
  const dodgeZones = [DodgeZone.LEFT, DodgeZone.RIGHT, DodgeZone.TOP];

  const chorusBarA = Math.floor(activeBars * 0.45);
  const chorusBarB = track.difficulty === 'HARD' ? Math.floor(activeBars * 0.78) : -1;

  // Sweep order sequences across all 5 semicircle sectors (0..4)
  const archSweepSeq = [0, 1, 2, 3, 4, 3, 2, 1];

  for (let bar = 0; bar < activeBars; bar++) {
    const barBeat = bar * 4;

    // 1. Rare Chorus Fever Pose (Manse bonus wave, zero penalty if skipped)
    if (bar === chorusBarA || bar === chorusBarB) {
      pushNote(barBeat + 1.0, null, RhythmNoteType.FEVER_POSE, {
        label: '🙌 만세 피버! 양손을 머리 위로!',
        windowStart: (countInBeats + barBeat - 0.5) * beatSec,
        windowEnd: (countInBeats + barBeat + 2.5) * beatSec,
        durationMultiplierSec: 8.0
      });
      if (track.difficulty === 'EASY') continue;
    }

    // 2. Occasional Neon Dodge Barrier (every ~5 bars starting bar 3)
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
      if (track.difficulty !== 'EASY') {
        pushNote(barBeat + 0.0, zone === DodgeZone.LEFT ? 4 : 0, RhythmNoteType.TAP);
      }
      continue;
    }

    // 3. Rhythmic Tunnel Light Notes across the 5 Semicircle Hitboxes
    const seqBase = (bar * 2) % archSweepSeq.length;
    if (track.difficulty === 'EASY') {
      const laneA = archSweepSeq[seqBase];
      const laneB = archSweepSeq[(seqBase + 2) % archSweepSeq.length];

      pushNote(barBeat + 0.0, laneA, RhythmNoteType.TAP);

      if (bar % 3 === 2) {
        const dir = laneB <= 1 ? SlashDirection.RIGHT : laneB >= 3 ? SlashDirection.LEFT : SlashDirection.DOWN;
        pushNote(barBeat + 2.0, laneB, RhythmNoteType.SLASH, { direction: dir });
      } else {
        pushNote(barBeat + 2.0, laneB, RhythmNoteType.TAP);
      }

      if (bar % 4 === 3) {
        pushNote(barBeat + 3.0, 2, RhythmNoteType.TAP);
      }
    } else if (track.difficulty === 'NORMAL') {
      const l0 = (bar * 2) % 5;
      const l1 = (bar * 2 + 1) % 5;
      const l2 = (bar * 2 + 2) % 5;
      const l3 = (bar * 2 + 3) % 5;

      pushNote(barBeat + 0.0, l0, RhythmNoteType.TAP);
      pushNote(barBeat + 1.0, l1, RhythmNoteType.TAP);
      pushNote(barBeat + 2.0, l2, RhythmNoteType.TAP);

      if (bar % 2 === 1) {
        const dir = slashDirs[bar % slashDirs.length];
        pushNote(barBeat + 3.0, l3, RhythmNoteType.SLASH, { direction: dir });
      }
    } else {
      // HARD (Overdrive Blitz): crisp multi-sector arch sweeps & directional slashes
      const pat = bar % 4;
      if (pat === 0) {
        pushNote(barBeat + 0.0, 0, RhythmNoteType.TAP);
        pushNote(barBeat + 1.0, 1, RhythmNoteType.TAP);
        pushNote(barBeat + 2.0, 2, RhythmNoteType.SLASH, { direction: SlashDirection.RIGHT });
        pushNote(barBeat + 3.0, 4, RhythmNoteType.SLASH, { direction: SlashDirection.LEFT });
      } else if (pat === 1) {
        pushNote(barBeat + 0.0, 4, RhythmNoteType.TAP);
        pushNote(barBeat + 0.5, 3, RhythmNoteType.TAP);
        pushNote(barBeat + 1.5, 2, RhythmNoteType.TAP);
        pushNote(barBeat + 2.5, 1, RhythmNoteType.SLASH, { direction: SlashDirection.DOWN });
        pushNote(barBeat + 3.5, 0, RhythmNoteType.TAP);
      } else if (pat === 2) {
        pushNote(barBeat + 0.0, 1, RhythmNoteType.TAP);
        pushNote(barBeat + 1.0, 3, RhythmNoteType.TAP);
        pushNote(barBeat + 2.0, 2, RhythmNoteType.SLASH, { direction: SlashDirection.UP });
        pushNote(barBeat + 3.0, 4, RhythmNoteType.SLASH, { direction: SlashDirection.DOWN });
      } else {
        pushNote(barBeat + 0.0, 0, RhythmNoteType.TAP);
        pushNote(barBeat + 1.0, 4, RhythmNoteType.TAP);
        pushNote(barBeat + 1.5, 3, RhythmNoteType.TAP);
        pushNote(barBeat + 2.5, 1, RhythmNoteType.TAP);
        pushNote(barBeat + 3.0, 2, RhythmNoteType.SLASH, { direction: SlashDirection.RIGHT });
      }
    }
  }

  events.sort((a, b) => a.targetTime - b.targetTime);

  return {
    track,
    beatSec,
    approachTime,
    events,
    totalScorableNotes: events.filter(
      (e) =>
        e.type === RhythmNoteType.TAP ||
        e.type === RhythmNoteType.SLASH ||
        e.type === RhythmNoteType.DODGE
    ).length
  };
}
