/**
 * Pose Ninja Fruit - Global Configuration
 */
export const CONFIG = {
  // Canvas & Video display configuration
  CANVAS: {
    WIDTH: 1280,
    HEIGHT: 720,
    MIRROR: true
  },

  // Blade Tracking & Sensitivity
  BLADE: {
    MIN_VELOCITY_TO_SLICE: 350, // px per second minimum to activate slicing
    TRAIL_LENGTH: 16,            // History points for longer luxurious trail rendering
    SMOOTHING_ALPHA: 0.65,       // EMA weight for new frame (0 to 1)
    COLORS: {
      LEFT: {
        CORE: '#ffffff',
        GLOW: '#00e5ff', // Cyan
        SPARK: '#38bdf8'
      },
      RIGHT: {
        CORE: '#ffffff',
        GLOW: '#ff007f', // Neon Magenta/Pink
        SPARK: '#f43f5e'
      }
    }
  },

  // Game Physics
  PHYSICS: {
    GRAVITY: 940,               // Pixels per second squared
    AIR_RESISTANCE: 0.998,
    HALF_SEPARATION_SPEED: 300, // Speed at which sliced halves push apart
    HALF_ANGULAR_VELOCITY: 5.5  // Rotation speed of sliced halves
  },

  // Gameplay Settings
  GAME: {
    START_LIVES: 5,
    MAX_LIVES: 5,
    COMBO_WINDOW_MS: 340,        // Time window to count multi-fruit combos
    SPAWN_INTERVAL_MIN: 1.4,     // Seconds (more frequent for active workout)
    SPAWN_INTERVAL_MAX: 2.6,     // Seconds
    DIFFICULTY_RAMP_INTERVAL: 12,// Seconds to increase difficulty
    BOMB_PROBABILITY: 0.16,      // Chance of spawning a bomb in a wave
    HEART_BONUS_PROBABILITY: 0.12 // Chance of spawning a heart bonus item
  },

  // Fruit Types and Visual Palette
  FRUITS: {
    WATERMELON: {
      type: 'WATERMELON',
      radius: 46,
      points: 1,
      color: '#22c55e',       // Rind green
      fleshColor: '#ef4444',  // Red flesh
      juiceColor: '#dc2626',  // Deep red juice
      rindColor: '#86efac'    // Pale green inner rind
    },
    ORANGE: {
      type: 'ORANGE',
      radius: 38,
      points: 1,
      color: '#f97316',       // Bright orange
      fleshColor: '#fb923c',
      juiceColor: '#ea580c',
      rindColor: '#ffedd5'
    },
    APPLE: {
      type: 'APPLE',
      radius: 36,
      points: 1,
      color: '#dc2626',       // Bright red
      fleshColor: '#fef08a',  // Pale yellow flesh
      juiceColor: '#b91c1c',
      rindColor: '#fecaca'
    },
    BANANA: {
      type: 'BANANA',
      radius: 34,
      points: 2,
      color: '#eab308',       // Bright yellow
      fleshColor: '#fef9c3',  // Cream
      juiceColor: '#ca8a04',
      rindColor: '#fef08a'
    },
    PINEAPPLE: {
      type: 'PINEAPPLE',
      radius: 48,
      points: 3,
      color: '#d97706',       // Golden amber
      fleshColor: '#fde047',  // Vibrant yellow
      juiceColor: '#b45309',
      rindColor: '#65a30d'    // Green crown
    },
    HEART_BONUS: {
      type: 'HEART_BONUS',
      radius: 44,
      points: 5,
      color: '#ec4899',       // Glowing Rose Pink
      fleshColor: '#f43f5e',  // Radiant Heart Red
      juiceColor: '#fb7185',  // Sparkle Petals
      rindColor: '#facc15'    // Golden Halo
    },
    BOMB: {
      type: 'BOMB',
      radius: 40,
      points: 0,
      color: '#1e293b',       // Dark slate
      fleshColor: '#ff0044',  // Danger core
      juiceColor: '#ffaa00',  // Sparks
      rindColor: '#94a3b8'
    }
  }
};
