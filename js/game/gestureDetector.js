/**
 * Korean Consonant Pose Detector ('ㅅ', 'ㅈ', 'ㄱ', 'ㄴ')
 * Optimized for natural webcam framing with relaxed thresholds and visual silhouette SVGs.
 */

export const CONSONANT_POSES = [
  {
    id: 'SIOT',
    symbol: 'ㅅ',
    name: '시옷(ㅅ) 참격',
    desc: '머리 위/앞으로 양손을 모아 세모(∧) 지붕 만들기!',
    color: '#38bdf8',
    illustrationSvg: `
      <svg viewBox="0 0 100 100" class="pose-stickman">
        <circle cx="50" cy="22" r="8" fill="#38bdf8"/>
        <line x1="50" y1="30" x2="50" y2="65" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="35" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="65" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
        <polyline points="35,40 30,22 48,10" fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="65,40 70,22 52,10" fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="50" cy="10" r="4.5" fill="#ffffff"/>
      </svg>
    `
  },
  {
    id: 'JIEUT',
    symbol: 'ㅈ',
    name: '지읒(ㅈ) 천벌',
    desc: '양팔을 머리 위 대각선 양옆으로 만세(V) 벌리기!',
    color: '#f43f5e',
    illustrationSvg: `
      <svg viewBox="0 0 100 100" class="pose-stickman">
        <circle cx="50" cy="24" r="8" fill="#f43f5e"/>
        <line x1="50" y1="32" x2="50" y2="65" stroke="#f43f5e" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="35" y2="90" stroke="#f43f5e" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="65" y2="90" stroke="#f43f5e" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="38" x2="20" y2="10" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
        <line x1="50" y1="38" x2="80" y2="10" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
        <circle cx="20" cy="10" r="4.5" fill="#ffffff"/>
        <circle cx="80" cy="10" r="4.5" fill="#ffffff"/>
      </svg>
    `
  },
  {
    id: 'GIYEOK',
    symbol: 'ㄱ',
    name: '기역(ㄱ) 뇌격',
    desc: '한 팔은 어깨 높이 수평, 다른 팔은 아래로 직각(ㄱ)!',
    color: '#facc15',
    illustrationSvg: `
      <svg viewBox="0 0 100 100" class="pose-stickman">
        <circle cx="50" cy="24" r="8" fill="#facc15"/>
        <line x1="50" y1="32" x2="50" y2="65" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="35" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="65" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="38" x2="16" y2="38" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
        <polyline points="50,38 74,38 74,68" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="16" cy="38" r="4.5" fill="#ffffff"/>
        <circle cx="74" cy="68" r="4.5" fill="#ffffff"/>
      </svg>
    `
  },
  {
    id: 'NIEUN',
    symbol: 'ㄴ',
    name: '니은(ㄴ) 파도',
    desc: '한 팔은 아래로 수직, 다른 팔은 옆으로 수평(ㄴ)!',
    color: '#a855f7',
    illustrationSvg: `
      <svg viewBox="0 0 100 100" class="pose-stickman">
        <circle cx="50" cy="24" r="8" fill="#a855f7"/>
        <line x1="50" y1="32" x2="50" y2="65" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="35" y2="90" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="65" x2="65" y2="90" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
        <polyline points="50,38 26,38 26,68" fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="50" y1="38" x2="82" y2="38" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
        <circle cx="26" cy="68" r="4.5" fill="#ffffff"/>
        <circle cx="82" cy="38" r="4.5" fill="#ffffff"/>
      </svg>
    `
  }
];

export class GestureDetector {
  constructor() {
    this.currentHoldTime = 0;
    this.requiredHoldTime = 0.18; // Fast 180ms reaction
    this.isTriggered = false;
  }

  evaluate(targetPoseId, landmarks, dt, mirror = true) {
    if (!landmarks || landmarks.length < 25) {
      this.currentHoldTime = Math.max(0, this.currentHoldTime - dt * 2);
      return { matched: false, progress: 0, triggered: false };
    }

    const matched = this._checkPose(targetPoseId, landmarks, mirror);

    if (matched) {
      this.currentHoldTime += dt;
      const progress = Math.min(1.0, this.currentHoldTime / this.requiredHoldTime);

      if (this.currentHoldTime >= this.requiredHoldTime && !this.isTriggered) {
        this.isTriggered = true;
        this.currentHoldTime = 0;
        return { matched: true, progress: 1.0, triggered: true };
      }

      return { matched: true, progress, triggered: false };
    } else {
      this.currentHoldTime = Math.max(0, this.currentHoldTime - dt * 2.5);
      this.isTriggered = false;
      const progress = Math.min(1.0, this.currentHoldTime / this.requiredHoldTime);
      return { matched: false, progress, triggered: false };
    }
  }

  reset() {
    this.currentHoldTime = 0;
    this.isTriggered = false;
  }

  /**
   * Relaxed, webcam-friendly posture detection using shoulder relative coordinates
   */
  _checkPose(poseId, lm, mirror) {
    const lSh = lm[11];
    const rSh = lm[12];
    const lWr = lm[15];
    const rWr = lm[16];

    if (!lWr || !rWr || !lSh || !rSh) return false;

    const getX = (p) => (mirror ? 1 - p.x : p.x);
    const getY = (p) => p.y;

    const lw = { x: getX(lWr), y: getY(lWr) };
    const rw = { x: getX(rWr), y: getY(rWr) };
    const l_sh = { x: getX(lSh), y: getY(lSh) };
    const r_sh = { x: getX(rSh), y: getY(rSh) };

    const avgShoulderY = (l_sh.y + r_sh.y) / 2;
    const shoulderDist = Math.abs(l_sh.x - r_sh.x);

    switch (poseId) {
      case 'SIOT': {
        // 'ㅅ' (Mountain/Roof): Both hands ABOVE shoulders AND close together (less than 1.4x shoulder distance)
        const bothHandsAboveShoulders = lw.y < avgShoulderY && rw.y < avgShoulderY;
        const handsClose = Math.abs(lw.x - rw.x) < Math.max(0.28, shoulderDist * 1.3);
        return bothHandsAboveShoulders && handsClose;
      }

      case 'JIEUT': {
        // 'ㅈ' / V Victory: Both hands ABOVE shoulders AND wide apart (greater than 1.1x shoulder distance)
        const bothHandsAboveShoulders = lw.y < avgShoulderY && rw.y < avgShoulderY;
        const handsWide = Math.abs(lw.x - rw.x) > Math.max(0.30, shoulderDist * 1.1);
        return bothHandsAboveShoulders && handsWide;
      }

      case 'GIYEOK': {
        // 'ㄱ' (One hand high/horizontal, other hand low/vertical)
        const hand1High = lw.y < avgShoulderY + 0.12;
        const hand2Low = rw.y > avgShoulderY + 0.15;

        const altHand1High = rw.y < avgShoulderY + 0.12;
        const altHand2Low = lw.y > avgShoulderY + 0.15;

        return (hand1High && hand2Low) || (altHand1High && altHand2Low);
      }

      case 'NIEUN': {
        // 'ㄴ' (One hand low near waist, other hand extended horizontal out)
        const oneLow = lw.y > avgShoulderY + 0.18;
        const otherHoriz = Math.abs(rw.y - avgShoulderY) < 0.22 && Math.abs(rw.x - r_sh.x) > 0.12;

        const altOneLow = rw.y > avgShoulderY + 0.18;
        const altOtherHoriz = Math.abs(lw.y - avgShoulderY) < 0.22 && Math.abs(lw.x - l_sh.x) > 0.12;

        return (oneLow && otherHoriz) || (altOneLow && altOtherHoriz);
      }

      default:
        return false;
    }
  }
}
