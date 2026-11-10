# 🍎 Pose Ninja Fruit (포즈 닌자 프루트)

> **웹캠 또는 스마트폰 전면 카메라**로 사용자의 골격(Pose)을 실시간 추적하여 양손으로 과일을 베는 모션 인식 인터랙티브 웹 게임입니다.  
> 별도의 빌드 도구나 Node.js 환경 없이 **순수 HTML, CSS, Vanilla JavaScript, MediaPipe CDN**만으로 구동되며, GitHub Pages로 무료 HTTPS 배포되어 모바일에서도 카메라 권한을 지원합니다.

### 🎮 [라이브 플레이 바로가기 (Demo)](https://baekbeom99-dotcom.github.io/pose-ninja-fruit/)

---

## ✨ 핵심 기능

1. **실시간 전신/손 골격 추적 (MediaPipe Pose)**
   - 최신 `@mediapipe/tasks-vision` 라이브러리를 CDN으로 로드하여 브라우저에서 실시간 포즈 추정(~30 FPS)
   - 왼손(하늘색)과 오른손(분홍색)의 손목 및 검지 궤적을 실시간으로 추적
   - EMA(지수 이동 평균) 필터링으로 카메라 노이즈와 손 떨림 완벽 보정
2. **속도 감응형 네온 블레이드 (Neon Blade Trail)**
   - 손을 천천히 움직일 때는 베이지 않으며, $380\text{ px/s}$ 이상의 빠른 스윙 동작 시에만 칼날이 활성화
   - `lighter` 블렌딩 및 Catmull-Rom 곡선 기반 네온 발광 트레일 연출
3. **선분-원 정밀 충돌 판정 & 반토막 물리**
   - 손 이동 선분과 과일 원형 바운딩의 수학적 충돌 감지
   - 베어진 각도($\theta$)의 법선 벡터 방향으로 두 반토막 과일이 회전하며 양옆으로 분리
4. **외부 에셋 의존성 제로 (Zero External Assets)**
   - **절차적 2D 캔버스 드로잉**: 수박, 오렌지, 사과, 바나나, 파인애플, 폭탄을 코드로 즉석 렌더링
   - **Web Audio API 실시간 음원 합성**: 외부 `.mp3` 파일 없이 브라우저 내장 신디사이저로 칼바람(Whoosh), 과일 싹둑(Slice), 폭발(Boom), 콤보 차임벨 합성
5. **마우스 & 모바일 터치 폴백(Fallback) 지원**
   - 웹캠이 없거나 카메라 권한이 차단된 환경에서도 마우스 드래그 또는 스마트폰 화면 터치로 즉시 플레이 가능

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
