/**
 * Korean Consonant Pose Detector ('ㄱ', 'ㄴ', 'ㅅ', 'ㅈ')
 * Recognizes full-body postures from MediaPipe Pose normalized landmarks.
 */

export const CONSONANT_POSES = [
  {
    id: 'SIOT',
    symbol: 'ㅅ',
    name: '시옷 참격 (Slash of ㅅ)',
    desc: '머리 위로 양손을 모아 삼각형 산(∧) 모양 만들기!',
    color: '#38bdf8', // Neon Sky Blue
    svgPath: '<polygon points="50,15 15,85 30,85 50,45 70,85 85,85" fill="currentColor"/>'
  },
  {
    id: 'GIYEOK',
    symbol: 'ㄱ',
    name: '기역 뇌격 (Lightning of ㄱ)',
    desc: '왼팔은 옆으로 수평, 오른팔은 아래로 직각(ㄱ) 만들기!',
    color: '#facc15', // Gold
    svgPath: '<path d="M15,20 L85,20 L85,85 L65,85 L65,40 L15,40 Z" fill="currentColor"/>'
  },
  {
    id: 'NIEUN',
    symbol: 'ㄴ',
    name: '니은 파도 (Tsunami of ㄴ)',
    desc: '왼팔은 아래로 수직, 오른팔은 옆으로 수평(ㄴ) 만들기!',
    color: '#a855f7', // Electric Violet
    svgPath: '<path d="M20,15 L40,15 L40,65 L85,65 L85,85 L20,85 Z" fill="currentColor"/>'
  },
  {
    id: 'JIEUT',
    symbol: 'ㅈ',
    name: '지읒 천벌 (Heaven Strike ㅈ)',
    desc: '양팔을 머리 위 대각선 만세(V)로 활짝 펼치기!',
    color: '#f43f5e', // Crimson Red
    svgPath: '<path d="M15,20 L85,20 L85,36 L58,36 L85,85 L65,85 L48,52 L31,85 L12,85 L40,36 L15,36 Z" fill="currentColor"/>'
  }
];

export class GestureDetector {
  constructor() {
    this.currentHoldTime = 0;
    this.requiredHoldTime = 0.32; // Hold pose for 320ms to trigger
    this.isTriggered = false;
  }

  /**
   * Evaluates if the user is holding the requested target consonant pose
   * @param {string} targetPoseId - One of 'SIOT', 'GIYEOK', 'NIEUN', 'JIEUT'
   * @param {Array} landmarks - 33 MediaPipe pose landmarks
   * @param {number} dt - Delta time in seconds
   * @param {boolean} mirror - Horizontal mirror mode
   * @returns {{matched: boolean, progress: number, triggered: boolean}}
   */
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

  _checkPose(poseId, lm, mirror) {
    // MediaPipe Landmarks
    // 0: Nose, 11: L Shoulder, 12: R Shoulder, 13: L Elbow, 14: R Elbow, 15: L Wrist, 16: R Wrist
    const nose = lm[0];
    const lSh = lm[11];
    const rSh = lm[12];
    const lEl = lm[13];
    const rEl = lm[14];
    const lWr = lm[15];
    const rWr = lm[16];

    if (!lWr || !rWr || !lSh || !rSh) return false;

    // Convert to mirrored coordinate system if needed
    // In mirror mode: user's visual left is (1 - lm.x)
    const getX = (p) => (mirror ? 1 - p.x : p.x);
    const getY = (p) => p.y;

    const leftWrist = { x: getX(lWr), y: getY(lWr) };
    const rightWrist = { x: getX(rWr), y: getY(rWr) };
    const leftShoulder = { x: getX(lSh), y: getY(lSh) };
    const rightShoulder = { x: getX(rSh), y: getY(rSh) };
    const headY = nose ? getY(nose) : (leftShoulder.y + rightShoulder.y) / 2 - 0.2;

    switch (poseId) {
      case 'SIOT': {
        // 'ㅅ' (Mountain / Roof pose): Both hands high above head & close together horizontally
        const bothHandsHigh = leftWrist.y < headY && rightWrist.y < headY;
        const handsClose = Math.abs(leftWrist.x - rightWrist.x) < 0.22;
        return bothHandsHigh && handsClose;
      }

      case 'GIYEOK': {
        // 'ㄱ' (Top horizontal arm, other arm downward vertical)
        // Hand 1: high and extended horizontally (at shoulder/head height)
        // Hand 2: down low below chest/hips
        const oneHandHigh = leftWrist.y < leftShoulder.y + 0.1;
        const otherHandLow = rightWrist.y > rightShoulder.y + 0.18;
        const oneHandWide = Math.abs(leftWrist.x - leftShoulder.x) > 0.15;

        // Or opposite hands
        const altOneHandHigh = rightWrist.y < rightShoulder.y + 0.1;
        const altOtherHandLow = leftWrist.y > leftShoulder.y + 0.18;
        const altOneHandWide = Math.abs(rightWrist.x - rightShoulder.x) > 0.15;

        return (oneHandHigh && otherHandLow && oneHandWide) || (altOneHandHigh && altOtherHandLow && altOneHandWide);
      }

      case 'NIEUN': {
        // 'ㄴ' (One hand down vertical, other hand extended horizontally outward)
        const oneHandDown = leftWrist.y > leftShoulder.y + 0.2;
        const otherHandHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 0.22 && Math.abs(rightWrist.x - rightShoulder.x) > 0.18;

        const altOneHandDown = rightWrist.y > rightShoulder.y + 0.2;
        const altOtherHandHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 0.22 && Math.abs(leftWrist.x - leftShoulder.x) > 0.18;

        return (oneHandDown && otherHandHorizontal) || (altOneHandDown && altOtherHandHorizontal);
      }

      case 'JIEUT': {
        // 'ㅈ' / Victory V (Both hands raised wide above head like V)
        const bothHandsAboveShoulders = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;
        const handsWideApart = Math.abs(leftWrist.x - rightWrist.x) > 0.38;
        return bothHandsAboveShoulders && handsWideApart;
      }

      default:
        return false;
    }
  }
}
