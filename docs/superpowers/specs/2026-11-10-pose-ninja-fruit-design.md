# Pose Ninja Fruit - System Design Document

**Date:** 2026-11-10  
**Status:** Approved for Implementation  
**Target Environment:** Web Browser (Desktop & Mobile Webcam via GitHub Pages / HTTPS)  
**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES Modules), MediaPipe Tasks-Vision (PoseLandmarker via CDN), Web Audio API  

---

## 1. Executive Summary & Objectives

**Pose Ninja Fruit** is a responsive, web-based motion-sensing fruit-slashing game inspired by Fruit Ninja. It runs entirely inside standard modern web browsers (Chrome, Safari, Edge, Firefox) without requiring build tools or native app installations.

### Key Goals
- **Real-Time Body Tracking**: Track the user's upper body / hands using MediaPipe Pose via webcam (or mobile front-facing camera).
- **Two-Hand Blade Slicing**: Map left and right wrist/index landmarks to interactive glowing neon blades with speed-based cutting activation.
- **Classic Arcade Gameplay**: Fruits (watermelons, oranges, apples, pineapples, bananas) and bombs launch from the bottom in parabolic arcs. Slicing fruits scores points, slicing bombs loses lives or ends the run.
- **Zero-Dependency Asset Pipeline**: Procedurally rendered vector/canvas graphics for fruits and procedural Web Audio API synthesizers for sounds (swish, slice, boom, combo).
- **Instant GitHub Pages Deployment**: Fully static No-Build architecture executable directly from GitHub Pages over HTTPS.

---

## 2. System Architecture & Rendering Pipeline

### 2.1 Multi-Layer Canvas Architecture
To maintain smooth 60 FPS gameplay independent of camera inference latency (~25-30 FPS), the UI and game rendering are decoupled into three stacked layers:

```
[Viewport: 100vw x 100vh, position: relative]
 ├── <video id="webcam" autoplay playsinline muted> (Hidden or opacity-dimmed, scaleX(-1))
 ├── <canvas id="bg-canvas">       (z-index: 1) Video feed + Semi-transparent skeleton joints
 ├── <canvas id="game-canvas">     (z-index: 2) Fruits, half-slices, bombs, splatters, juice particles
 ├── <canvas id="blade-canvas">    (z-index: 3) Smooth neon trail curves (Catmull-Rom), spark particles
 └── <div id="ui-container">       (z-index: 4) Score, hearts, combo banners, game over modal
```

### 2.2 Coordinate System & Mirroring
- **Mirror Mode**: To provide natural hand-eye coordination like a mirror, the video feed and coordinate mapping are flipped horizontally (`scaleX(-1)`).
- **Aspect Ratio Normalization**: MediaPipe landmarks are returned as normalized coordinates $[0, 1]$. These are mapped to canvas dimensions while maintaining aspect ratio:
  $$X_{canvas} = (1 - x_{norm}) \times W_{canvas}$$
  $$Y_{canvas} = y_{norm} \times H_{canvas}$$

---

## 3. Directory & File Structure

```text
fruit/
├── index.html                    # Root HTML document, CDN scripts, canvas stack
├── css/
│   ├── main.css                  # Reset, responsive viewport, canvas layering
│   └── ui.css                    # Heads-up display (HUD), animations, modals
├── js/
│   ├── config.js                 # Global constants (gravity, fruit types, colors, speeds)
│   ├── main.js                   # Application bootstrap & orchestrator
│   ├── camera/
│   │   ├── cameraManager.js      # MediaDevices navigator, stream lifecycle, mobile flip
│   │   └── poseTracker.js        # MediaPipe PoseLandmarker initialization & inference
│   ├── game/
│   │   ├── gameEngine.js         # 60 FPS main game loop (RAF), state transitions
│   │   ├── bladeManager.js       # Hand trail history, EMA smoothing, velocity, trail rendering
│   │   ├── fruitManager.js       # Spawner waves, active entity collection, cleanup
│   │   ├── fruit.js              # Fruit/Bomb entity, parabolic physics, sliced halves
│   │   ├── collision.js          # Segment-to-circle collision & slicing angle calculator
│   │   └── particleSystem.js     # Juice drips, splatter stamps, explosion sparks
│   ├── audio/
│   │   └── soundManager.js       # Web Audio API procedural sound generators
│   └── ui/
│       └── uiManager.js          # Score counters, combo floating text, life hearts
└── docs/
    └── superpowers/specs/        # Specifications and implementation documentation
```

---

## 4. Detailed Component Design

### 4.1 Pose Tracking & Blade Manager (`poseTracker.js`, `bladeManager.js`)
- **Keypoints Used**:
  - Left Blade: Landmark 15 (LEFT_WRIST) and 19 (LEFT_INDEX)
  - Right Blade: Landmark 16 (RIGHT_WRIST) and 20 (RIGHT_INDEX)
- **Exponential Moving Average (EMA) Smoothing**:
  Reduces landmark jitter when hands move slightly:
  $$P_{filtered}(t) = \alpha \cdot P_{raw}(t) + (1 - \alpha) \cdot P_{filtered}(t - 1) \quad (\alpha \approx 0.65)$$
- **Velocity Thresholding**:
  Each hand maintains a rolling history of the last 6 positions with timestamps.
  $$\text{Velocity} = \frac{\Delta \text{distance}}{\Delta t} \quad (\text{px/second})$$
  - If $\text{Velocity} \ge 400\text{ px/s}$: Blade is **active** (emits sparks, glowing trail, triggers slice).
  - If $\text{Velocity} < 400\text{ px/s}$: Blade is **idle** (faint tracker indicator, no slicing capability).

### 4.2 Collision & Slicing Math (`collision.js`)
- **Segment-to-Circle Collision**:
  For an active blade moving from point $A$ to point $B$, and a fruit at center $C$ with radius $R$:
  $$\vec{AB} = B - A, \quad \vec{AC} = C - A$$
  $$t = \text{clamp}\left(\frac{\vec{AC} \cdot \vec{AB}}{\|\vec{AB}\|^2}, 0, 1\right)$$
  $$P_{closest} = A + t \cdot \vec{AB}$$
  $$\text{Distance} = \|C - P_{closest}\|$$
  $$\text{Collision occurs if } \text{Distance} \le R$$

- **Cut Angle & Split Velocity**:
  - Slicing direction vector: $\vec{D} = \frac{B - A}{\|B - A\|}$
  - Normal vector: $\vec{N} = (-D_y, D_x)$
  - Cut angle: $\theta = \operatorname{atan2}(D_y, D_x)$
  - When sliced, the fruit splits into two halves ($Half_1, Half_2$).
  - $Half_1$ velocity: $\vec{v}_1 = \vec{v}_{fruit} + \vec{N} \cdot 3.5 + \text{angular velocity}$
  - $Half_2$ velocity: $\vec{v}_2 = \vec{v}_{fruit} - \vec{N} \cdot 3.5 - \text{angular velocity}$

### 4.3 Fruit Types & Procedural Rendering (`fruit.js`)
Fruits are drawn procedurally via 2D Canvas primitives to avoid external image loading latency:
1. **Watermelon**: Dark green outer arc, light green rind, vibrant red flesh, black seeds.
2. **Orange**: Bright orange peel, pale inner segments, radial segment dividers.
3. **Apple**: Deep red body, indentation at top, small brown stem and green leaf.
4. **Pineapple**: Golden yellow diamond cross-hatching, crown of spiky green leaves.
5. **Bomb**: Matte black metal sphere, sparkling animated fuse at top, red warning pulse.

### 4.4 Procedural Audio Synthesis (`soundManager.js`)
Uses `window.AudioContext`:
- **Blade Swish**: Band-pass filtered White Noise buffer with fast exponential volume decay (80ms).
- **Fruit Slice**: Dual-oscillator sine wave with sharp pitch drop (1200Hz to 200Hz) over 120ms + subtle high-pass burst.
- **Bomb Explosion**: Low-frequency sawtooth oscillator (120Hz to 30Hz) mixed with low-pass filtered noise and distortion.
- **Combo Chime**: Ascending pentatonic arpeggio (C5, D5, E5, G5, A5) synthesized with pure sine harmonics.

---

## 5. Game State Machine & Scoring Logic

```
   [Loading / Request Camera]
              │
              ▼
    [Ready / Press Start]
              │
              ▼
   ┌────> [Playing] <───────────────────┐
   │          │                         │
   │          ├─ Fruit sliced ──> Combo tracker (+1, +2...)
   │          ├─ Fruit missed ──> Lose 1 life (Max 3)
   │          ├─ Bomb sliced  ──> Lose 3 lives / Immediate Game Over
   │          │
   │          ▼ (Lives == 0)
   └───── [Game Over Modal] ──(Restart)─┘
```

- **Combos**: Slicing 3 or more fruits within a single 300ms window triggers a "Combo!" banner and awards $1.5\times$ to $3\times$ bonus points.
- **High Score**: Persisted in `localStorage`.

---

## 6. GitHub Pages Deployment Configuration

1. Repository root directory serves `index.html`.
2. CDN assets:
   - `@mediapipe/tasks-vision` via `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js`
   - Pose model WASM & `.task` model hosted on Google Cloud Storage CDN (standard MediaPipe endpoints).
3. Zero build commands, zero dependencies to compile.

---

## 7. Verification & Testing Plan

1. **Camera Stream Verification**: Confirm video loads on Chrome desktop and mobile Safari/Chrome with correct mirroring.
2. **Inference Latency & FPS**: Measure MediaPipe processing time per frame ($\le 35\text{ms}$ on modern devices).
3. **Slicing Sensitivity**: Test high-speed swings vs stationary hands (ensure no false-positive cuts when resting).
4. **Collision Accuracy**: Verify cut angle matches the hand swing trajectory.
5. **Audio Latency**: Ensure Web Audio plays instantly upon collision without audio thread stutter.
