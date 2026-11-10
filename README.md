# 🍎 Pose Ninja Fruit (포즈 닌자 프루트)

> **웹캠 또는 스마트폰 전면 카메라**로 사용자의 골격(Pose)을 실시간 추적하여 양손으로 과일을 베는 모션 인식 인터랙티브 웹 게임입니다.  
> 별도의 빌드 도구나 Node.js 환경 없이 **순수 HTML, CSS, Vanilla JavaScript, MediaPipe CDN**만으로 구동되며, GitHub Pages로 무료 HTTPS 배포되어 모바일에서도 카메라 권한을 지원합니다.

### 🎮 [라이브 플레이 바로가기 (Demo)](https://baekbeom99-dotcom.github.io/pose-ninja-fruit/)

---

## ✨ 핵심 기능

1. **👥 1인 모드 & 2인 대결 모드 (Solo & 2-Player Duo)**
   - **1인 모드**: 양손을 빠르게 휘둘러 플레이.
   - **2인 대결 모드**: 카메라 화면에 선 두 명의 골격을 동시 추적하여 **1P(왼쪽 플레이어 / 하늘색 칼날) vs 2P(오른쪽 플레이어 / 핑크색 칼날)** 실시간 점수 경쟁!
2. **🍎 2배 거대해진 과일 & 여유 있는 75% 투사체 속도**
   - 과일 크기를 기존 대비 **2배(2x)**로 확대하여 시인성과 타격 범위 대폭 향상!
   - 과일 투사체 속도를 **75%**로 완화하여 충분히 보고 벨 수 있는 쾌적한 반응성 제공.
3. **🎯 난이도 적응형 과일 출현 제한 (Pacing Regulation)**
   - 벤 과일 **10개 이하**: 한 화면에 **1개**씩만 출현
   - 벤 과일 **20개 이하**: 한 화면에 최대 **2개** 출현
   - 벤 과일 **30개 이상**: 한 화면에 최대 **3개** 출현
4. **⚡ 한글 자음 자세 필살기 (Ultimate Consonant Slash)**
   - **10개의 과일을 벨 때마다 필살기 게이지 100% 충전!**
   - 우측 상단 HUD에 이번에 발동할 **한글 자음(ㅅ, ㄱ, ㄴ, ㅈ)과 자세 가이드**가 표시됩니다.
   - 해당 자음 포즈(예: 'ㅅ' 머리 위로 손 모으기, 'ㅈ' 만세 V자 등)를 0.3초간 유지하면 **화면 전체 과일 일괄 전멸 + 번개 참격 이펙트**가 발동!
5. **🎨 매 게임 랜덤 비주얼 테마 (Random Visual Themes)**
   - 시작할 때마다 과일의 비주얼 스타일이 무작위로 변경됩니다:
     - **클레이모피즘 (Claymorphism)**: 쫀득쫀득하고 통통한 3D 점토 스타일
     - **레트로 픽셀아트 (8-bit Pixel)**: 고전 아케이드 도트 블록 스타일
     - **페이퍼크래프트 (Paper Cut)**: 겹겹이 쌓인 종이 질감과 접힌 선 연출
     - **사이버 네온 (Cyber Neon)**: 선명한 미래형 벡터 아케이드 스타일
6. **💖 하트 회복 보너스 & 5개 라이프**
   - 기본 5개의 생명 제공, 반짝이는 핑크 하트 보너스를 베면 +1 라이프 회복 및 보너스 점수.
7. **외부 에셋 의존성 제로 (Zero External Assets)**
   - 절차적 2D 캔버스 드로잉 & Web Audio API 실시간 음원 합성 (천상의 하프, 천둥 번개 필살기, 칼바람).
8. **마우스 & 모바일 터치 폴백(Fallback) 지원**

---

## 🎮 게임 조작 및 규칙

- **칼날 조작**: 카메라 앞에 서서 양손을 휘두르거나, 화면을 마우스/터치로 긁어 과일을 벱니다.
- **점수 획득**:
  - 수박, 오렌지, 사과: 1점
  - 바나나: 2점
  - 파인애플: 3점
- **콤보 시스템**: $320\text{ms}$ 내에 3개 이상의 과일을 연속으로 베면 콤보 점수 보너스($\times 2$) 및 팡파레 효과음 발동!
- **생명(라이프)**:
  - 과일을 베지 못하고 바닥으로 떨어뜨리면 생명(하트) 1개 감소 (총 3개)
  - 폭탄(Bomb)을 베면 즉시 폭발하며 게임 종료

---

## 🚀 GitHub Pages 1분 배포 방법

이 프로젝트는 빌드(`npm run build`)가 필요 없는 순수 정적 웹 구조입니다.

1. **GitHub 레포지토리 생성 및 Push**
   ```bash
   git remote add origin https://github.com/사용자아이디/레포지토리이름.git
   git branch -M main
   git push -u origin main
   ```
2. **GitHub Pages 활성화**
   - GitHub 레포지토리 페이지 상단의 **Settings** 클릭
   - 좌측 메뉴에서 **Pages** 클릭
   - **Build and deployment** 항목의 Source를 **Deploy from a branch**로 선택
   - Branch를 `main` / `/(root)`로 지정하고 **Save** 클릭
3. **접속하기**
   - 1~2분 후 `https://사용자아이디.github.io/레포지토리이름/` 주소로 접속하면 즉시 게임이 실행됩니다!  
   *(GitHub Pages는 기본적으로 무료 HTTPS를 제공하므로 모바일/웹캠 권한이 정상 작동합니다)*

---

## 💻 로컬에서 테스트하기

HTTPS 또는 로컬호스트(`localhost`) 환경에서 웹캠 권한이 활성화됩니다:

- **VS Code 사용 시**: `Live Server` 확장을 설치한 후 `index.html` 우클릭 $\to$ `Open with Live Server`
- **Python 사용 시**:
  ```bash
  python -m http.server 8000
  # 브라우저에서 http://localhost:8000 접속
  ```
- **Node.js 사용 시**:
  ```bash
  npx serve .
  ```

---

## 📂 디렉터리 구조

```text
fruit/
├── index.html                 # 메인 화면 & 3중 캔버스 레이어
├── README.md                  # 프로젝트 설명 및 배포 가이드
├── css/
│   ├── main.css               # 풀스크린 뷰포트 & 캔버스 스택 레이아웃
│   └── ui.css                 # HUD 점수판, 하트, 콤보 팝업, 모달 스타일
├── js/
│   ├── config.js              # 물리 상수, 과일 종류, 색상 팔레트 설정
│   ├── main.js                # 앱 부트스트랩 & 마우스 폴백
│   ├── camera/
│   │   ├── cameraManager.js   # 웹캠 스트림 및 전면 카메라 제어
│   │   └── poseTracker.js     # MediaPipe PoseLandmarker 및 네온 골격 드로잉
│   ├── game/
│   │   ├── gameEngine.js      # 60 FPS requestAnimationFrame 메인 루프
│   │   ├── bladeManager.js    # 양손 궤적 EMA 스무딩 & 네온 트레일
│   │   ├── fruitManager.js    # 과일 웨이브 스폰, 충돌 검사, 콤보 연산
│   │   ├── fruit.js           # 절차적 과일 렌더링 & 반토막 분리 물리
│   │   ├── particleSystem.js  # 과즙 파편, 배경 스플래터, 칼날 스파크
│   │   └── collision.js       # 선분-원 최단거리 충돌 및 절단 법선 벡터 수학
│   ├── audio/
│   │   └── soundManager.js    # Web Audio API 실시간 음원 합성기
│   └── ui/
│       └── uiManager.js       # 점수, 라이프, 콤보, 최고점수(localStorage) UI
└── tests/
    └── collision.test.js      # 충돌 판정 기하학 알고리즘 단위 테스트
```
