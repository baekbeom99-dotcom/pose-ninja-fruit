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
    MIN_VELOCITY_TO_SLICE: 380, // px per second minimum to activate slicing
    TRAIL_LENGTH: 12,            // History points for trail rendering
    SMOOTHING_ALPHA: 0.65,       // EMA weight for new frame (0 to 1)
    COLORS: {
      LEFT: {
        CORE: '#ffffff',
        GLOW: '#00e5ff', // Cyan
        SPARK: '#80f0ff'
      },
      RIGHT: {
        CORE: '#ffffff',
        GLOW: '#ff007f', // Neon Magenta/Pink
        SPARK: '#ff80bf'
      }
    }
  },

  // Game Physics
  PHYSICS: {
    GRAVITY: 980,               // Pixels per second squared
    AIR_RESISTANCE: 0.998,
    HALF_SEPARATION_SPEED: 260, // Speed at which sliced halves push apart
    HALF_ANGULAR_VELOCITY: 5.0  // Rotation speed of sliced halves
  },

  // Gameplay Settings
  GAME: {
    START_LIVES: 3,
    MAX_LIVES: 3,
    COMBO_WINDOW_MS: 320,       // Time window to count multi-fruit combos
    SPAWN_INTERVAL_MIN: 1.8,    // Seconds
    SPAWN_INTERVAL_MAX: 3.2,    // Seconds
    DIFFICULTY_RAMP_INTERVAL: 15,// Seconds to increase difficulty
    BOMB_PROBABILITY: 0.18      // Chance of spawning a bomb in a wave
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
