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
    MIN_VELOCITY_TO_SLICE: 0,    // Instant touch slicing (0 velocity threshold: any touch slices!)
    SWING_SOUND_VELOCITY: 160,   // Velocity required to play whoosh sound
    TOUCH_RADIUS: 28,            // Generous touch hitbox radius for hands/fingers
    TRAIL_LENGTH: 16,
    SMOOTHING_ALPHA: 0.65,
    COLORS: {
      P1_LEFT: { CORE: '#ffffff', GLOW: '#00e5ff', SPARK: '#38bdf8' },   // Cyan
      P1_RIGHT: { CORE: '#ffffff', GLOW: '#3b82f6', SPARK: '#60a5fa' },  // Blue
      P2_LEFT: { CORE: '#ffffff', GLOW: '#ff007f', SPARK: '#f43f5e' },   // Magenta / Pink
      P2_RIGHT: { CORE: '#ffffff', GLOW: '#f59e0b', SPARK: '#fcd34d' },  // Gold / Amber
      DOCTOR_STRANGE: {
        CORE: '#ffffff',
        INNER: '#fef08a',
        GLOW: '#f59e0b',
        SPARK: '#ea580c',
        MANDALA: '#f97316'
      }
    }
  },

  // Game Physics (High arcing, floaty 75% projectile speed)
  PHYSICS: {
    GRAVITY: 560,               // Softened gravity for floaty hangtime and soaring apex
    AIR_RESISTANCE: 0.9995,
    HALF_SEPARATION_SPEED: 260, // Sliced half separation speed
    HALF_ANGULAR_VELOCITY: 4.0  // Fruit rotation speed
  },

  // Gameplay Settings
  GAME: {
    START_LIVES: 5,
    MAX_LIVES: 5,
    COMBO_WINDOW_MS: 380,        // Generous combo window for larger fruits
    SPAWN_INTERVAL_MIN: 1.2,
    SPAWN_INTERVAL_MAX: 2.2,
    BOMB_PROBABILITY: 0.15,
    HEART_BONUS_PROBABILITY: 0.12,
    ULTIMATE_THRESHOLD: 12,      // 12 fruits to charge up ultimate
    GESTURE_HOLD_TIME: 0.50      // 500ms deliberate martial pose hold
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

  // Fruit Types - ALL RADII DOUBLED (2x Size)
  FRUITS: {
    WATERMELON: {
      type: 'WATERMELON',
      radius: 92, // was 46 (2x)
      points: 1,
      color: '#22c55e',
      fleshColor: '#ef4444',
      juiceColor: '#dc2626',
      rindColor: '#86efac'
    },
    ORANGE: {
      type: 'ORANGE',
      radius: 76, // was 38 (2x)
      points: 1,
      color: '#f97316',
      fleshColor: '#fb923c',
      juiceColor: '#ea580c',
      rindColor: '#ffedd5'
    },
    APPLE: {
      type: 'APPLE',
      radius: 72, // was 36 (2x)
      points: 1,
      color: '#dc2626',
      fleshColor: '#fef08a',
      juiceColor: '#b91c1c',
      rindColor: '#fecaca'
    },
    BANANA: {
      type: 'BANANA',
      radius: 68, // was 34 (2x)
      points: 2,
      color: '#eab308',
      fleshColor: '#fef9c3',
      juiceColor: '#ca8a04',
      rindColor: '#fef08a'
    },
    PINEAPPLE: {
      type: 'PINEAPPLE',
      radius: 96, // was 48 (2x)
      points: 3,
      color: '#d97706',
      fleshColor: '#fde047',
      juiceColor: '#b45309',
      rindColor: '#65a30d'
    },
    HEART_BONUS: {
      type: 'HEART_BONUS',
      radius: 88, // was 44 (2x)
      points: 5,
      color: '#ec4899',
      fleshColor: '#f43f5e',
      juiceColor: '#fb7185',
      rindColor: '#facc15'
    },
    BOMB: {
      type: 'BOMB',
      radius: 80, // was 40 (2x)
      points: 0,
      color: '#1e293b',
      fleshColor: '#ff0044',
      juiceColor: '#ffaa00',
      rindColor: '#94a3b8'
    }
  },

  // Space Fishes for UFO Flying Fish Mode (Zero-G Swimming Entities)
  FISHES: {
    NEON_GOLDFISH: {
      type: 'NEON_GOLDFISH',
      radius: 80,
      points: 1,
      color: '#06b6d4',
      fleshColor: '#38bdf8',
      juiceColor: '#00f2fe',
      rindColor: '#facc15',
      name: '네온 금붕어'
    },
    CYBER_CLOWNFISH: {
      type: 'CYBER_CLOWNFISH',
      radius: 76,
      points: 1,
      color: '#f97316',
      fleshColor: '#ffffff',
      juiceColor: '#fb923c',
      rindColor: '#38bdf8',
      name: '사이버 광대어'
    },
    COSMIC_JELLYFISH: {
      type: 'COSMIC_JELLYFISH',
      radius: 84,
      points: 2,
      color: '#a855f7',
      fleshColor: '#ec4899',
      juiceColor: '#d946ef',
      rindColor: '#f472b6',
      name: '우주 해파리'
    },
    ALAMO_FLYING_FISH: {
      type: 'ALAMO_FLYING_FISH',
      radius: 88,
      points: 2,
      color: '#3b82f6',
      fleshColor: '#60a5fa',
      juiceColor: '#93c5fd',
      rindColor: '#e0f2fe',
      name: '은하 날치'
    },
    MECHA_PUFFERFISH: {
      type: 'MECHA_PUFFERFISH',
      radius: 92,
      points: 3,
      color: '#10b981',
      fleshColor: '#34d399',
      juiceColor: '#6ee7b7',
      rindColor: '#facc15',
      name: '메카 복어'
    },
    COSMIC_STAR: {
      type: 'COSMIC_STAR',
      radius: 84,
      points: 5,
      color: '#facc15',
      fleshColor: '#fbbf24',
      juiceColor: '#fde047',
      rindColor: '#ec4899',
      name: '스타피쉬 하트'
    },
    ALIEN_BOMB: {
      type: 'ALIEN_BOMB',
      radius: 80,
      points: 0,
      color: '#475569',
      fleshColor: '#ef4444',
      juiceColor: '#f97316',
      rindColor: '#0f172a',
      name: '우주 기뢰'
    }
  },

  // Game Modes
  MODES: {
    CLASSIC: 'CLASSIC',
    DOCTOR_STRANGE: 'DOCTOR_STRANGE',
    UFO_FISH: 'UFO_FISH'
  }
};
