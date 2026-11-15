# Galaga Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully-featured, authentic Galaga retro arcade game mode where the player controls the fighter's X-axis position smoothly using their head position (nose landmark), with continuous auto-fire, retro neon alien formations (Zako, Goei, Boss Galaga), dive attacks, tractor beam capture & dual-fighter rescue, and authentic procedural Web Audio sound synthesis.

**Architecture:**
A modular Galaga subsystem inside `js/game/galaga/` decoupled from the fruit-slicing logic. The `GalagaEngine` orchestrates the multi-layer starfield, player fighter with EMA/LERP smoothing, alien formation grid with Bezier dive curves, spiraling tractor beam, and auto-firing bullets. Seamlessly integrated into `gameEngine.js` as an official game mode (`CONFIG.MODES.GALAGA`) with corresponding start modal tab and instructions.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph "Core App & Input"
        PT[PoseTracker / Nose Landmark] --> GE[GameEngine]
        MM[Mouse / Touch Fallback] --> GE
        SM[SoundManager Web Audio]
    end

    subgraph "Galaga Mode Subsystem (js/game/galaga/)"
        GE --> GEngine[GalagaEngine]
        GEngine --> SF[Starfield]
        GEngine --> FT[Fighter (Head X-Axis Smoother)]
        GEngine --> AL[Alien Formation & Dive AI]
        GEngine --> TB[TractorBeam (Capture & Rescue)]
        GEngine --> BL[BulletManager (Player & Enemy)]
        FT --> BL
        AL --> BL
    end

    subgraph "UI Layer"
        GEngine --> UI[UIManager (Score & Lives HUD)]
    end
```

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5 Canvas 2D, Web Audio API, MediaPipe Pose (Nose Landmark), Node.js unit tests (Zero build tools).

**Spec:** Brainstorming discussion in conversation history (Approved at 2026-11-15 09:34).

## Global Constraints
- Pure ES Modules (`import`/`export`), no bundler or build step.
- Zero external audio/image assets: all graphics rendered with Canvas 2D vector path primitives, all sound synthesized via Web Audio API.
- Head tracking uses `poseTracker` nose landmark ($0.0 \sim 1.0$) mapped to canvas width with exponential smoothing filter ($0.12 \sim 0.16$).
- Must support mouse/touch fallback when camera is absent.
- Full compatibility with existing Classic, Doctor Strange, and UFO modes.

---

### Task 1: Starfield and Parallax Star Background (`js/game/galaga/starfield.js`)

**Files:**
- Create: `js/game/galaga/starfield.js`
- Test: `tests/galaga.test.js`

**Interfaces:**
- Produces: `Starfield` class with `update(dt, speedMultiplier)`, `render(ctx, width, height)`, `setWarp(active)`

- [ ] **Step 1: Write the failing test for Starfield**
  - Verify star initialization with 3 depth layers (speeds 40, 100, 220 px/s).
  - Verify downward scrolling and wrapping back to top when reaching `height`.
  - Verify `setWarp(true)` multiplies speed by 6x for stage warp transitions.
- [ ] **Step 2: Run test to confirm failure**
  - Run `node tests/galaga.test.js` and verify it fails (module not found).
- [ ] **Step 3: Implement `Starfield`**
  - 80-120 stars with varied colors (white, cyan, amber, lavender, crimson) and subtle twinkling alpha.
  - Efficient rendering in canvas 2D.
- [ ] **Step 4: Run test to confirm pass**
  - Run `node tests/galaga.test.js` and confirm Starfield tests pass.
- [ ] **Step 5: Commit**
  - `git add js/game/galaga/starfield.js tests/galaga.test.js && git commit -m "feat(galaga): implement starfield parallax background"`

---

### Task 2: Bullets & Procedural Galaga Audio (`js/game/galaga/bullet.js`, `js/audio/soundManager.js`)

**Files:**
- Create: `js/game/galaga/bullet.js`
- Modify: `js/audio/soundManager.js`
- Test: `tests/galaga.test.js`

**Interfaces:**
- Produces: `Bullet` (player yellow laser), `AlienMissile` (enemy red torpedo), `BulletManager`
- Produces: `soundManager.playGalagaShoot()`, `soundManager.playGalagaExplosion()`, `soundManager.playGalagaTractor()`, `soundManager.playGalagaDock()`

- [ ] **Step 1: Write failing tests for BulletManager and audio methods**
  - Test bullet trajectory (player bullets move up at -850 px/s, alien missiles move toward target angle at 400 px/s).
  - Test offscreen culling.
  - Test soundManager method presence.
- [ ] **Step 2: Run test to confirm failure**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 3: Implement `BulletManager` and audio methods**
  - High-velocity dual and single lasers with neon glow.
  - Synthesize authentic 8-bit Galaga laser chirp (high-to-low fast frequency ramp with harmonic square/sine wave).
  - Synthesize noise burst explosion with frequency decay.
  - Synthesize tractor beam wobbling oscillating dual tones.
- [ ] **Step 4: Run test to confirm pass**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 5: Commit**
  - `git add js/game/galaga/bullet.js js/audio/soundManager.js tests/galaga.test.js && git commit -m "feat(galaga): add bullet manager and procedural galaga sound effects"`

---

### Task 3: Aliens (Zako, Goei, Boss Galaga) & Grid Formation (`js/game/galaga/alien.js`)

**Files:**
- Create: `js/game/galaga/alien.js`
- Test: `tests/galaga.test.js`

**Interfaces:**
- Produces: `AlienType` enum, `Alien` class, `AlienFormation` class
- Zako: Blue Bee (1 HP, 100/200 pts), Goei: Red Butterfly (1 HP, 160/320 pts), Boss Galaga: Green-Blue (2 HP, 200/400 pts)

- [ ] **Step 1: Write failing tests for Aliens and Formation**
  - Test alien type properties, hit damage, and points calculation (diving vs in-formation).
  - Test formation grid layout (4 rows: row 0 = Boss, row 1 = Goei, rows 2-3 = Zako).
  - Test breathing sinusoidal oscillation.
- [ ] **Step 2: Run test to confirm failure**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 3: Implement `Alien` and `AlienFormation`**
  - Authentic procedural neon vector graphics for Zako, Goei, and Boss Galaga with 2-frame flapping animation.
  - Boss Galaga damage state (changes color from green-blue to blue-yellow on first hit).
  - Formation entry curves and periodic diving attack loops using cubic Bezier curves.
- [ ] **Step 4: Run test to confirm pass**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 5: Commit**
  - `git add js/game/galaga/alien.js tests/galaga.test.js && git commit -m "feat(galaga): implement alien types, neon sprites and formation AI"`

---

### Task 4: Fighter Ship with Smoothed Head Movement (`js/game/galaga/fighter.js`)

**Files:**
- Create: `js/game/galaga/fighter.js`
- Test: `tests/galaga.test.js`

**Interfaces:**
- Produces: `Fighter` class with `update(dt, targetX, canvasWidth, canvasHeight)`, `render(ctx)`, `triggerAutoFire(bulletManager, soundManager)`

- [ ] **Step 1: Write failing tests for Fighter**
  - Test LERP smoothing: sudden jump in `targetX` results in gradual exponential ease-in movement without teleporting.
  - Test boundary clamping: ship never moves past screen edges.
  - Test auto-fire interval (fires every 0.18s when alive).
  - Test dual-fighter mode (two ship hulls rendered side by side, spawns 2 parallel bullets).
- [ ] **Step 2: Run test to confirm failure**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 3: Implement `Fighter`**
  - White, red and blue retro fighter ship with rear engine glow pulse.
  - Robust LERP smoothing with $\alpha = 0.14$.
  - State management: `NORMAL`, `CAPTURED_PULL`, `DESTROYED`, `RESPAWNING`, `DUAL`.
- [ ] **Step 4: Run test to confirm pass**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 5: Commit**
  - `git add js/game/galaga/fighter.js tests/galaga.test.js && git commit -m "feat(galaga): implement player fighter with smooth head tracking and auto-fire"`

---

### Task 5: Tractor Beam & Dual Fighter Docking (`js/game/galaga/tractorBeam.js`)

**Files:**
- Create: `js/game/galaga/tractorBeam.js`
- Test: `tests/galaga.test.js`

**Interfaces:**
- Produces: `TractorBeam` class with `start(bossAlien)`, `update(dt, fighter)`, `render(ctx)`, `rescueCapturedShip(bossAlien)`

- [ ] **Step 1: Write failing tests for TractorBeam**
  - Test conical beam bounds check against fighter position.
  - Test capture sequence: pulls fighter towards boss and rotates.
  - Test rescue sequence: when boss holding ship is killed, captured ship spirals down and docks to create Dual Fighter.
- [ ] **Step 2: Run test to confirm failure**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 3: Implement `TractorBeam`**
  - Spiraling animated gradient energy cone with expanding rings.
  - Seamless state transition between normal play, capture animation, and rescue docking animation.
- [ ] **Step 4: Run test to confirm pass**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 5: Commit**
  - `git add js/game/galaga/tractorBeam.js tests/galaga.test.js && git commit -m "feat(galaga): implement tractor beam capture and dual fighter rescue"`

---

### Task 6: Galaga Engine Coordination & Collision System (`js/game/galaga/galagaEngine.js`)

**Files:**
- Create: `js/game/galaga/galagaEngine.js`
- Test: `tests/galaga.test.js`

**Interfaces:**
- Produces: `GalagaEngine` class with `start()`, `update(dt, currentTime, headPose)`, `render(ctx)`, `reset()`, `onScore`, `onGameOver`

- [ ] **Step 1: Write failing tests for GalagaEngine**
  - Test player bullet vs alien collision (kills alien, increments score, spawns explosion particles).
  - Test alien missile vs player collision (reduces life by 1, triggers invulnerability flash or game over).
  - Test wave clear progression.
- [ ] **Step 2: Run test to confirm failure**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 3: Implement `GalagaEngine`**
  - Circle/AABB bounding box collisions between lasers and alien hitboxes.
  - Score accumulation and high score synchronization.
  - Lives display (3 fighter icons).
  - Stage advance when all formation aliens are destroyed.
- [ ] **Step 4: Run test to confirm pass**
  - Run `node tests/galaga.test.js`.
- [ ] **Step 5: Commit**
  - `git add js/game/galaga/galagaEngine.js tests/galaga.test.js && git commit -m "feat(galaga): complete galaga engine with collision and stage loop"`

---

### Task 7: UI, Start Modal & GameEngine Integration (`index.html`, `css/ui.css`, `js/config.js`, `js/ui/uiManager.js`, `js/game/gameEngine.js`, `js/main.js`)

**Files:**
- Modify: `index.html` (add `btn-mode-galaga` tab, update instructions)
- Modify: `css/ui.css` (add Galaga tab neon styling and HUD styling)
- Modify: `js/config.js` (add `CONFIG.MODES.GALAGA`)
- Modify: `js/ui/uiManager.js` (bind Galaga tab and update mode description)
- Modify: `js/game/gameEngine.js` (integrate GalagaEngine loop and pose head input)
- Modify: `js/main.js` (pass mouse fallback coordinate for head in Galaga mode)
- Test: Unit tests and in-browser verification

- [ ] **Step 1: Add Galaga mode constant to `config.js`**
  - `MODES: { ..., GALAGA: 'GALAGA' }`.
- [ ] **Step 2: Add Galaga tab to `index.html` and styles in `css/ui.css`**
  - `<button id="btn-mode-galaga" class="game-mode-tab" data-mode="GALAGA"><span class="tab-emoji">👾</span><span class="tab-name">갤러그</span></button>`.
  - Neon purple/cyan active glow.
- [ ] **Step 3: Update `uiManager.js`**
  - Handle `GALAGA` mode selection with description:
    `👾 <strong>갤러그 모드</strong>: 머리를 좌우로 부드럽게 움직여 비행기 조종! 자동 연속 발사! 보스의 트랙터 빔을 피하고 외계인 편대를 섬멸하세요!`.
- [ ] **Step 4: Wire `gameEngine.js` and `main.js`**
  - In `gameEngine.startNewGame()`, if `gameMode === GALAGA`, initialize and launch `galagaEngine`.
  - Pass nose landmark X to `galagaEngine.update()`.
  - Mouse/touch movement emulation in `main.js` mapped to head position when camera is off.
- [ ] **Step 5: Run all unit tests**
  - `node tests/collision.test.js; node tests/gesture.test.js; node tests/fish.test.js; node tests/fruit.test.js; node tests/heading.test.js; node tests/galaga.test.js`.
- [ ] **Step 6: Commit**
  - `git add -A && git commit -m "feat(galaga): integrate galaga mode into UI, game engine and start screen"`

---

### Task 8: Verification, Push & GitHub Pages Deployment

**Files:**
- All modified and new files

- [ ] **Step 1: Syntax check all project JavaScript files**
  - `Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node -c $_.FullName }`
- [ ] **Step 2: Run complete test suite**
  - Execute all tests and ensure 100% pass.
- [ ] **Step 3: Push to GitHub `main` branch**
  - `git push origin main`
- [ ] **Step 4: Verify GitHub Actions Pages Deployment**
  - `gh run watch <run_id>` and verify successful deployment.
- [ ] **Step 5: Final review and report to user**
  - Provide live URL and summary of the completed Galaga mode.
