# 션샤인타자연습

한글(두벌식)과 영어(QWERTY)를 모두 지원하는 순수 프론트엔드 기반 웹 타자연습 프로그램입니다. 별도의 백엔드 서버나 빌드 과정 없이 정적 호스팅(Vercel, GitHub Pages 등)과 로컬 환경에서 바로 실행할 수 있으며, PWA(오프라인 지원 및 홈 화면 추가)에 최적화되어 있습니다.

## 주요 기능

- **한·영 즉시 전환**: 상단 헤더 토글로 한글 두벌식과 영문 QWERTY 자판 및 내장 연습 데이터를 언제든 전환할 수 있습니다.
- **4가지 연습 모드**:
  - **자리 연습**: 하단 가상 키보드 및 10개 손가락 가이드로 목표 키와 누를 손가락을 안내합니다. 쌍자음·이중모음·영문 대문자 입력 시 반대쪽 새끼손가락 `Shift` 조합을 동시에 강조합니다.
  - **낱말 연습 / 단문장 연습 / 장문장 연습**: 한글 IME 조합 중에는 오타로 판정하지 않고 조합 완료 시점에 실시간으로 오타를 표시하며, 완료 후 `Enter` 입력 시 정타율·오타율·타수(CPM/WPM) 결과를 제공합니다.
- **산성비 미니게임 (1~10단계)**: 난이도별 낙하 속도·생성 주기·최대 동시 단어 수를 지원하며, 방패 아이템 등 게임 요소를 포함합니다.
- **다중 사용자 프로필 & 5단계 등급 시스템 (Firebase Firestore 연동)**:
  - Firebase Firestore(`typing_users` 컬렉션) 실시간 동기화 및 기기별 `activeUserId` + `localStorage` 오프라인 캐시 백업 지원
  - 누적 연습 횟수·최고 타수·평균 정타율 기반 5단계 등급(`초보자` → `입문자` → `숙련자` → `전문가` → `마스터`) 자동 계산 및 승급 알림
  - **전체 현황 대시보드**: 사용자 비교 리더보드, 다음 등급 진행도, 모드별 통계 제공
  - 전체 사용자 데이터 JSON **백업(내보내기) / 복원(가져오기)** 지원
- **모바일·태블릿 & 블루투스 키보드 최적화 (PWA)**:
  - 반응형 레이아웃, 터치 기기 외장(블루투스) 키보드 모드(`inputmode="none"` 전환), 핀치 줌 방지
  - `manifest.json` 및 Service Worker(`sw.js`) 캐싱을 통한 오프라인 동작 지원

## 로컬 실행 방법

### 1. 정적 웹 서버로 실행 (권장 — PWA/Service Worker 포함)

```bash
# Python 3 내장 서버
python -m http.server 8765

# 또는 Node.js serve
npx serve .
```

브라우저에서 `http://localhost:8765`로 접속합니다.

### 2. 파일 직접 열기

별도 빌드 도구가 없으므로 `index.html`을 브라우저로 직접 열어도 타자 연습 및 프로필 저장 기능을 사용할 수 있습니다. (단, Service Worker 오프라인 캐싱은 `https://` 또는 `http://localhost` 환경에서 동작합니다.)

## Vercel 배포 방법

1. [Vercel](https://vercel.com/) 대시보드에서 **Add New... → Project**를 선택합니다.
2. GitHub 저장소 `seanshine1302/typingmaster`를 연결(Import)합니다.
3. 프로젝트 설정에서 다음과 같이 확인한 뒤 **Deploy**를 클릭합니다:
   - **Framework Preset**: `Other`
   - **Build Command**: 비워 둠 (정적 파일 그대로 제공)
   - **Output Directory**: `.` (또는 기본값 유지)
4. `vercel.json`의 헤더 설정으로 `sw.js` 및 `manifest.json`이 HTTPS 환경에서 올바른 캐시·MIME 정책으로 서빙됩니다.

## 프로젝트 구조

```text
.
├── index.html                    # 메인 진입점 (헤더, 모드 내비게이션, PWA 메타)
├── manifest.json                 # PWA 웹 앱 매니페스트
├── sw.js                         # 오프라인/네트워크 우선 Service Worker
├── vercel.json                   # Vercel 정적 배포 헤더 설정
├── css/
│   └── styles.css                # 전체 라이트 테마 및 반응형 스타일
├── icons/
│   ├── icon.svg                  # 벡터 앱 아이콘
│   ├── icon-192.png              # PWA 192x192 아이콘
│   └── icon-512.png              # PWA 512x512 아이콘
└── js/
    ├── app.js                    # 메인 앱 컨트롤러 및 결과 모달
    ├── data-ko.js                # 한글 연습 데이터 (자리/단어/단문장/장문장)
    ├── data-en.js                # 영어 연습 데이터 (자리/단어/단문장/장문장)
    ├── keyboard-config.js        # 두벌식/QWERTY 자판 배열 및 손가락 매핑
    ├── ime-evaluator.js          # 한글 IME 조합 안전 평가 및 타수 계산
    ├── mobile-viewport.js        # 모바일 뷰포트, 외장키보드, PWA 설치·SW 등록
    ├── profile-store.js          # 다중 사용자 기록 저장소, 로컬 캐시 및 5단계 등급 로직
    ├── firebase-sync.js          # Firebase Firestore 실시간 동기화 ES 모듈 브리지
    ├── components/
    │   ├── keyboard-view.js      # 가상 키보드 및 양손 손가락 SVG 가이드
    │   ├── profile-modal.js      # 사용자 전환/내 기록/백업·복원 모달
    │   └── dashboard-modal.js    # 전체 사용자 현황 및 등급 대시보드 모달
    └── modes/
        ├── position-mode.js      # 자리 연습 모드
        ├── text-practice-mode.js # 낱말·단문장·장문장 연습 모드
        └── acid-rain-mode.js     # 산성비 미니게임 모드 (1~10단계)
```
