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
    MIN_VELOCITY_TO_SLICE: 350,
    TRAIL_LENGTH: 16,
    SMOOTHING_ALPHA: 0.65,
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
    GRAVITY: 940,
    AIR_RESISTANCE: 0.998,
    HALF_SEPARATION_SPEED: 320,
    HALF_ANGULAR_VELOCITY: 5.5
  },

  // Gameplay Settings
  GAME: {
    START_LIVES: 5,
    MAX_LIVES: 5,
    COMBO_WINDOW_MS: 340,
    SPAWN_INTERVAL_MIN: 1.4,
    SPAWN_INTERVAL_MAX: 2.6,
    DIFFICULTY_RAMP_INTERVAL: 12,
    BOMB_PROBABILITY: 0.16,
    HEART_BONUS_PROBABILITY: 0.12,
    ULTIMATE_THRESHOLD: 10 // Fruits needed to charge ultimate move
  },

  // Visual Themes randomly chosen on game start
  THEMES: [
    {
      id: 'CLAYMORPHISM',
      name: '클레이모피즘 (Claymorphism)',
      desc: '쫀득하고 부드러운 3D 점토 스타일',
      badgeColor: '#ec4899'
    },
    {
      id: 'PIXEL_ART',
      name: '레트로 픽셀아트 (8-bit Pixel)',
      desc: '고전 오락실 도트 픽셀 그래픽',
      badgeColor: '#38bdf8'
    },
    {
      id: 'PAPER_CUT',
      name: '페이퍼크래프트 (Paper Cut)',
      desc: '정교하게 겹쳐진 수제 종이공예 스타일',
      badgeColor: '#f59e0b'
    },
    {
      id: 'CLASSIC_VECTOR',
      name: '사이버 네온 (Cyber Neon)',
      desc: '선명한 벡터 아케이드 스타일',
      badgeColor: '#22c55e'
    }
  ],

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
