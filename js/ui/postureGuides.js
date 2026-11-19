/**
 * Mode-Specific Posture Guides
 * Ensures the Posture Guide modal displays ONLY the actions & poses relevant
 * to the currently selected/active game mode.
 */

const SVG_ATTRS = 'viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="pose-stickman" aria-hidden="true"';

function makeStickSvg(innerMarkup) {
  return `<svg ${SVG_ATTRS}>${innerMarkup}</svg>`;
}

const CARD_SIOT = {
  title: '시옷(ㅅ) 참격',
  desc: '머리 위·앞으로 양손을 모아 세모(∧) 지붕 만들기',
  svg: makeStickSvg(`
    <circle cx="50" cy="22" r="8" fill="#38bdf8"/>
    <line x1="50" y1="30" x2="50" y2="65" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="35" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="65" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
    <polyline points="35,40 30,22 48,10" fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="65,40 70,22 52,10" fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="50" cy="10" r="4.5" fill="#ffffff"/>
  `)
};

const CARD_IEUNG = {
  title: '이응(ㅇ) 광륜',
  desc: '양팔을 둥글게 모아 커다란 원(○) 만들기',
  svg: makeStickSvg(`
    <circle cx="50" cy="28" r="7" fill="#06b6d4"/>
    <line x1="50" y1="35" x2="50" y2="65" stroke="#06b6d4" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="35" y2="90" stroke="#06b6d4" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="65" y2="90" stroke="#06b6d4" stroke-width="4" stroke-linecap="round"/>
    <path d="M 50,36 C 26,34 22,14 42,8 C 50,5 58,5 66,10 C 82,18 76,34 50,36" fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
    <circle cx="50" cy="8" r="4.5" fill="#ffffff"/>
    <circle cx="50" cy="36" r="4.5" fill="#ffffff"/>
  `)
};

const CARD_GIYEOK = {
  title: '기역(ㄱ) 뇌격',
  desc: '한 팔은 옆으로 수평, 다른 팔은 아래로 직각(ㄱ)',
  svg: makeStickSvg(`
    <circle cx="50" cy="24" r="8" fill="#facc15"/>
    <line x1="50" y1="32" x2="50" y2="65" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="35" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="65" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="38" x2="16" y2="38" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
    <polyline points="50,38 74,38 74,68" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="16" cy="38" r="4.5" fill="#ffffff"/>
    <circle cx="74" cy="68" r="4.5" fill="#ffffff"/>
  `)
};

const CARD_NIEUN = {
  title: '니은(ㄴ) 파도',
  desc: '한 팔은 아래로 수직, 다른 팔은 옆으로 수평(ㄴ)',
  svg: makeStickSvg(`
    <circle cx="50" cy="24" r="8" fill="#a855f7"/>
    <line x1="50" y1="32" x2="50" y2="65" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="35" y2="90" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="65" x2="65" y2="90" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
    <polyline points="50,38 26,38 26,68" fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="50" y1="38" x2="82" y2="38" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
    <circle cx="26" cy="68" r="4.5" fill="#ffffff"/>
    <circle cx="82" cy="38" r="4.5" fill="#ffffff"/>
  `)
};

const CARD_HEAD_STEER = {
  title: '머리 좌우 이동',
  desc: '고개·상체를 좌우로 움직여 캐릭터 위치 조종',
  svg: makeStickSvg(`
    <circle cx="50" cy="28" r="10" fill="#38bdf8"/>
    <line x1="50" y1="38" x2="50" y2="70" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
    <polyline points="28,28 14,28 20,22" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="72,28 86,28 80,22" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="50" y1="70" x2="38" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="70" x2="62" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
  `)
};

const CARD_MANSE = {
  title: '양팔 만세 (🙌)',
  desc: '양 손목을 머리 위로 번쩍 들어 올리기',
  svg: makeStickSvg(`
    <circle cx="50" cy="30" r="8" fill="#facc15"/>
    <line x1="50" y1="38" x2="50" y2="68" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="68" x2="36" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="68" x2="64" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="46" x2="28" y2="12" stroke="#4ade80" stroke-width="5" stroke-linecap="round"/>
    <line x1="50" y1="46" x2="72" y2="12" stroke="#4ade80" stroke-width="5" stroke-linecap="round"/>
    <circle cx="28" cy="12" r="4.5" fill="#ffffff"/>
    <circle cx="72" cy="12" r="4.5" fill="#ffffff"/>
  `)
};

export const MODE_POSTURE_GUIDES = {
  CLASSIC: {
    title: '🗡️ 클래식 자세 가이드',
    desc: '양손으로 과일을 베고, 12개 절단 시 아래 한글 자음 필살기 자세를 취하세요!',
    cards: [CARD_SIOT, CARD_IEUNG, CARD_GIYEOK, CARD_NIEUN]
  },
  UFO_FISH: {
    title: '🛸 UFO 과일 자세 가이드',
    desc: '우주 어류를 베어 게이지를 채운 뒤, 요구되는 자음 포즈를 취하세요!',
    cards: [CARD_SIOT, CARD_IEUNG, CARD_GIYEOK, CARD_NIEUN]
  },
  DOCTOR_STRANGE: {
    title: '🔮 닥터 스트레인지 자세 가이드',
    desc: '두 손 사이를 잇는 마법 광선으로 베고, 필살기 시 큰 Y자 포즈를 취하세요!',
    cards: [
      {
        title: '양손 마법 광선 절단',
        desc: '양손을 벌려 두 손 사이로 이어지는 빛의 검으로 과일 절단',
        svg: makeStickSvg(`
          <circle cx="50" cy="26" r="8" fill="#facc15"/>
          <line x1="50" y1="34" x2="50" y2="68" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="44" x2="18" y2="48" stroke="#fb923c" stroke-width="4.5" stroke-linecap="round"/>
          <line x1="50" y1="44" x2="82" y2="48" stroke="#fb923c" stroke-width="4.5" stroke-linecap="round"/>
          <line x1="18" y1="48" x2="82" y2="48" stroke="#fef08a" stroke-width="3" stroke-dasharray="5,4"/>
          <circle cx="18" cy="48" r="5" fill="#ffffff"/>
          <circle cx="82" cy="48" r="5" fill="#ffffff"/>
        `)
      },
      {
        title: 'Y자 차원 포털 필살기',
        desc: '양팔을 대각선 위로 활짝 뻗어 커다란 Y자 만들기',
        accentColor: '#f59e0b',
        svg: makeStickSvg(`
          <path d="M42,28 Q50,18 58,28 L64,52 L36,52 Z" fill="#b91c1c" opacity="0.85"/>
          <circle cx="50" cy="22" r="8" fill="#facc15"/>
          <line x1="50" y1="30" x2="50" y2="65" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="65" x2="35" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="65" x2="65" y2="90" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
          <polyline points="50,38 33,24 18,9" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="50,38 67,24 82,9" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="50" cy="24" r="21" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="5,3"/>
          <circle cx="18" cy="9" r="4.5" fill="#ffffff"/>
          <circle cx="82" cy="9" r="4.5" fill="#ffffff"/>
        `)
      }
    ]
  },
  GALAGA: {
    title: '👾 갤러그 자세 가이드',
    desc: '총알은 자동 발사됩니다! 머리 이동과 만세 필살기 두 동작만 사용하세요.',
    cards: [
      CARD_HEAD_STEER,
      {
        ...CARD_MANSE,
        title: '만세 🙌 하이퍼 폭격',
        desc: '양손을 머리 위로 들어 윙맨 메가 레이저 + 미사일 일괄 소거!'
      }
    ]
  },
  CROSSY: {
    title: '🐔 길건너 점프 자세 가이드',
    desc: '제자리 점프 또는 양팔 날개짓 중 편한 동작으로 1칸씩 앞으로 점프하세요!',
    cards: [
      {
        title: '제자리 점프',
        desc: '가볍게 제자리에서 껑충 뛰면 앞으로 1칸 점프',
        svg: makeStickSvg(`
          <circle cx="50" cy="20" r="8" fill="#4ade80"/>
          <line x1="50" y1="28" x2="50" y2="56" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>
          <polyline points="50,56 38,72 44,82" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="50,56 62,72 56,82" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="50,10 42,16 58,16" fill="none" stroke="#facc15" stroke-width="3" stroke-linecap="round"/>
        `)
      },
      {
        title: '양팔 날개짓 (🪽)',
        desc: '양팔을 옆으로 벌려 올렸다가 내리며 파닥이면 전진',
        svg: makeStickSvg(`
          <circle cx="50" cy="26" r="8" fill="#38bdf8"/>
          <line x1="50" y1="34" x2="50" y2="66" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="42" x2="14" y2="26" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
          <line x1="50" y1="42" x2="86" y2="26" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
          <line x1="50" y1="66" x2="36" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="66" x2="64" y2="90" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
        `)
      }
    ]
  },
  POOP_DODGE: {
    title: '💩 똥피하기 자세 가이드',
    desc: '머리 좌우 위치로 캐릭터를 움직여 똥을 피하고 무지개 똥·우산을 받으세요!',
    cards: [
      CARD_HEAD_STEER,
      {
        title: '3초 한자리 금지 & 안전구역',
        desc: '한 곳에 3초 멈추지 말고, 경보 시 초록 안전구역으로 대피하세요',
        svg: makeStickSvg(`
          <rect x="34" y="14" width="32" height="76" rx="4" fill="rgba(74, 222, 128, 0.28)" stroke="#4ade80" stroke-width="2"/>
          <circle cx="50" cy="36" r="8" fill="#fde047"/>
          <line x1="50" y1="44" x2="50" y2="70" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="70" x2="40" y2="88" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="70" x2="60" y2="88" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>
        `)
      }
    ]
  },
  RED_LIGHT: {
    title: '🌺 무궁화 꽃이 피었습니다 자세 가이드',
    desc: '초록불엔 점프·달리기, 빨간 눈일 땐 얼음, 도착 후 만세 터치하고 도망치세요!',
    cards: [
      {
        title: '제자리 점프 / 달리기',
        desc: '구호 중 제자리에서 뛰면 목표(영희)가 크게 가까워집니다',
        svg: makeStickSvg(`
          <circle cx="50" cy="22" r="8" fill="#4ade80"/>
          <line x1="50" y1="30" x2="50" y2="60" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>
          <polyline points="50,38 28,32 24,48" fill="none" stroke="#facc15" stroke-width="4.5" stroke-linecap="round"/>
          <polyline points="50,38 72,46 76,30" fill="none" stroke="#facc15" stroke-width="4.5" stroke-linecap="round"/>
          <polyline points="50,60 36,78 30,90" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>
          <polyline points="50,60 66,74 72,88" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>
        `)
      },
      {
        title: '붉은 눈 = 즉시 얼음!',
        desc: '구호가 끝나고 눈이 붉게 변하면 몸·손 움직임을 멈추세요',
        svg: makeStickSvg(`
          <circle cx="50" cy="26" r="8" fill="#f87171"/>
          <circle cx="46" cy="25" r="2" fill="#dc2626"/>
          <circle cx="54" cy="25" r="2" fill="#dc2626"/>
          <line x1="50" y1="34" x2="50" y2="68" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="42" x2="36" y2="64" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="42" x2="64" y2="64" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="68" x2="42" y2="90" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="68" x2="58" y2="90" stroke="#f87171" stroke-width="4" stroke-linecap="round"/>
        `)
      },
      {
        ...CARD_MANSE,
        title: '목표 도착 후 만세 터치',
        desc: '영희 앞에 도착하면 양손을 번쩍 들어 터치하고 빠르게 도망치세요!'
      }
    ]
  },
  UMBRELLA: {
    title: '☔ 우산 게임 자세 가이드',
    desc: '한 손 또는 양손 손바닥을 아이 머리 위에 올려 소낙비를 막아주세요!',
    cards: [
      {
        title: '손으로 우산 만들기',
        desc: '아이의 머리 바로 위쪽 공간에 손을 대면 손바닥 아래만 안전구역이 됩니다',
        svg: makeStickSvg(`
          <path d="M18,40 Q50,14 82,40 Z" fill="#fb923c" stroke="#fde047" stroke-width="3"/>
          <rect x="20" y="40" width="60" height="50" fill="rgba(253, 224, 71, 0.2)"/>
          <circle cx="50" cy="64" r="8" fill="#facc15"/>
          <line x1="50" y1="72" x2="50" y2="88" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
        `)
      },
      {
        title: '아이 따라 집까지 이동',
        desc: '학교(우측)에서 집(좌측)까지 아이 속도에 맞춰 따라가고, 울면 1.5초 뒤 다시 씌워주세요',
        svg: makeStickSvg(`
          <line x1="78" y1="62" x2="22" y2="62" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>
          <polyline points="32,52 20,62 32,72" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="58" cy="40" r="8" fill="#38bdf8"/>
          <path d="M36,24 Q58,12 80,24 Z" fill="#fb923c"/>
        `)
      }
    ]
  },
  BREAKOUT: {
    title: '🧱 벽돌깨기 자세 가이드',
    desc: '양손을 벌린 X위치로 이동하고 양 손목의 높이 차이로 시소를 기울이세요!',
    cards: [
      {
        title: '양손 좌우 이동',
        desc: '양손의 가운데 X축 위치(미인식 시 어깨/머리)로 반사 패들을 이동',
        svg: makeStickSvg(`
          <line x1="16" y1="66" x2="84" y2="66" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/>
          <circle cx="24" cy="40" r="6" fill="#ffffff"/>
          <circle cx="76" cy="40" r="6" fill="#ffffff"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
        `)
      },
      {
        title: '양 손목 높이 차이 = 시소 각도',
        desc: '한쪽 손목을 높이고 다른 쪽을 낮추면 패들이 기울어 공 반사각을 정밀 제어!',
        svg: makeStickSvg(`
          <line x1="18" y1="54" x2="82" y2="76" stroke="#facc15" stroke-width="6" stroke-linecap="round"/>
          <circle cx="20" cy="34" r="6" fill="#38bdf8"/>
          <circle cx="80" cy="56" r="6" fill="#fb923c"/>
          <line x1="20" y1="34" x2="80" y2="56" stroke="#fde047" stroke-width="2.5" stroke-dasharray="4,3"/>
        `)
      }
    ]
  }
};

export function getPostureGuideForMode(gameMode = 'CLASSIC') {
  return MODE_POSTURE_GUIDES[gameMode] || MODE_POSTURE_GUIDES.CLASSIC;
}
