# 모바일·태블릿 반응형 웹 개선 TODO

이 문서는 [`docs/RESPONSIVE_WEB_PLAN.md`](./RESPONSIVE_WEB_PLAN.md)를 실행하기 위한 작업
체크리스트다. 기존 class와 시각 언어를 유지하면서 구조 정리 → 공통 기반 → 화면별 개선 →
회귀 검증 순으로 진행한다.

- 상태: 로컬 구현·자동 검증·원격 CI 완료, 외부 Issue/실기기 확인 대기
- 우선순위: 모바일 현장 입력과 태블릿 입력/추정 병렬 배치가 P0
- 허용 가로 스크롤: 방문 비교표와 사진 스트립의 내부 스크롤만 허용
- 기준 뷰포트: 320, 360×800, 412×915, 768×1024, 1024×768, 1440×900
- 변경 원칙: 한 PR에서 구조 정리와 시각 변경을 섞지 않고, 각 단계 검증 후 다음 단계로 이동

## 0. 착수 조건과 기준선 — PR 1

- [ ] 구현 Issue를 만들고 배경, 문제, 목표, 비목표, 제약을 계획서에서 옮긴다.
- [x] 지원 환경을 최근 iOS/iPadOS Safari와 Android Chrome으로 기록한다.
- [x] mobile `≤767px`, tablet `768~1023px`, desktop `≥1024px` 기준을 기록한다.
- [x] 하단 내비게이션 유지, 허용 overflow, 브랜드/도메인 로직 비변경 가정을 기록한다.
- [x] 아래 화면 상태를 seed 데이터와 결정적 테스트 fixture로 재현할 수 있게 준비한다.
  - [x] 공개 홈과 로그인
  - [x] 방문 목록 기본/빈 목록/로딩/오류
  - [x] 입력 기본/필수값 오류/최대 메뉴/최대 사진/업로드 실패
  - [x] 상세 기본/추정 불가/사진 없음/긴 텍스트
  - [x] 방문 2개 비교/3개 비교/잘못된 비교 요청
- [ ] 모든 기준 뷰포트에서 변경 전 화면을 캡처해 Issue에 첨부한다.
- [x] 각 화면의 문서 `scrollWidth`, 고정 요소 겹침, 긴 문자열 잘림을 측정한다.
- [x] 767/768px과 1023/1024px 경계 앞뒤를 연속 resize해 결함을 기록한다.
- [x] 결함에 P0/P1 우선순위, 재현 경로, 영향 화면을 기록한다.

완료 기준: 기준 화면과 측정 방법을 다른 개발자가 재현할 수 있고, P0 결함 목록이 확정되어야 한다.

## 1. 스타일 경계 분리 — PR 2

- [x] `src/app/globals.css`의 selector와 참조 component를 다시 전역 검색한다.
- [x] Next.js 16의 저장소 내 CSS 가이드와 deprecation을 구현 직전에 다시 확인한다.
- [x] 전역 CSS를 아래 책임으로 나누는 파일 구성을 확정한다.
  - [x] token과 reset/base
  - [x] 공개 홈과 로그인
  - [x] 앱 셸과 공통 상태
  - [x] 방문 목록
  - [x] 방문 입력/수정
  - [x] 방문 상세와 관찰/사진
  - [x] 방문 비교
  - [x] viewport별 responsive override
- [x] `globals.css`를 유일한 진입점으로 유지하고 import 순서를 명시한다.
- [x] 모든 스타일 파일을 300줄 이하로 분리한다.
- [x] selector 이름, cascade 순서, specificity와 DOM class를 변경하지 않는다.
- [x] 개발 build와 production build의 CSS 순서가 같은 결과를 내는지 확인한다.
- [x] 기준선 캡처와 비교해 의도하지 않은 시각 diff가 없는지 검토한다.

완료 기준: 제품 동작과 화면이 바뀌지 않은 상태에서 스타일 책임이 격리되고 전체 검증이 통과해야 한다.

## 2. 대형 UI 컴포넌트 동작 보존 분리 — PR 3

- [x] `VisitForm`의 정의, route 호출, action, validation, 사진 흐름과 테스트를 전체 재확인한다.
- [x] 폼 상태·저장 orchestration과 화면 section의 경계를 정한다.
- [x] 기본 정보, 메뉴/가격, 좌석/고객, 운영/테이크아웃, 평가/메모, 예상 매출을 작은 component로 분리한다.
- [x] 필드 `id`, `name`, DOM 순서, aria 연결, 오류 포커스와 tab 순서를 유지한다.
- [x] 사진 준비/업로드/정렬/재시도와 이탈 경고 동작을 유지한다.
- [x] 상세 페이지에서 지표, 메뉴, 고객/관찰, 사진, 메모 section을 필요한 만큼 분리한다.
- [x] 변경 파일 300줄, 함수 50줄, 매개변수 5개, 순환 복잡도 10 이하를 확인한다.
- [x] 기존 단위·컴포넌트·E2E 테스트로 동작 동등성을 검증한다.
- [x] 기준선 캡처와 비교해 의도하지 않은 시각 diff가 없는지 검토한다.

완료 기준: 공개 component API와 사용자 동작을 유지하면서 이후 화면별 변경을 독립적으로 수행할 수 있어야 한다.

## 3. 공통 반응형 기반과 앱 셸 — PR 4

- [x] 간격, 글자 크기, 컨테이너 폭과 하단 고정 영역 높이를 의미 있는 token으로 정의한다.
- [x] 컨테이너와 제목에 `clamp()` 기반 유동 크기를 적용한다.
- [x] grid/flex 자식의 `min-width: 0`과 긴 문자열 줄바꿈 원칙을 적용한다.
- [x] 이미지와 media가 컨테이너 폭을 넘지 않도록 공통 경계를 적용한다.
- [x] `100vh` 사용처를 점검하고 필요한 화면을 `100dvh` 또는 안전한 fallback으로 전환한다.
- [x] 상·하단에 `env(safe-area-inset-*)`를 반영한다.
- [x] 하단 내비게이션과 페이지 콘텐츠의 bottom 여백을 하나의 token으로 맞춘다.
- [x] 하단 내비게이션, 비교 바와 향후 mobile 저장 bar의 z-index/간격 계약을 정의한다.
- [x] 주요 링크·버튼·칩·별점·아이콘 조작 영역을 최소 44×44px로 만든다.
- [x] hover 상태가 없는 터치 환경을 위해 focus-visible과 active 상태를 제공한다.
- [x] `prefers-reduced-motion`에서 이동·shimmer·pulse 효과를 줄이거나 제거한다.
- [x] 320~1,440px에서 앱 셸에 의도하지 않은 가로 overflow가 없는지 검증한다.

완료 기준: 모든 화면이 공유하는 크기·safe area·고정 요소·터치 기준이 자동 검사 가능한 상태여야 한다.

## 4. 공개 화면과 방문 목록 — PR 5

### 4.1 공개 홈과 로그인

- [x] 홈의 2열 preview가 tablet/mobile에서 자연스럽게 1열로 전환되게 한다.
- [x] 작은 화면의 제목, preview 지표와 CTA가 잘리거나 과도하게 축소되지 않게 한다.
- [x] 로그인 2열 → 1열 전환을 콘텐츠 폭 기준으로 조정한다.
- [x] 로그인 카드와 오류 메시지가 viewport 밖으로 나가지 않게 한다.
- [x] 화면 높이가 짧거나 landscape여도 로그인 입력과 CTA에 접근할 수 있게 한다.

### 4.2 앱 셸과 방문 목록

- [x] desktop 3열, tablet 2열, mobile 1열 목록을 경계 폭에서 검증한다.
- [x] 카드 이미지 비율과 높이를 안정화하고 사진 없음 fallback을 검증한다.
- [x] 최대 길이 카페명·지역·금액이 카드 레이아웃을 깨지 않게 한다.
- [x] 비교 선택 버튼을 44×44px 이상으로 만들고 선택/비활성 상태를 명확히 한다.
- [x] 비교 바가 하단 내비게이션·safe area·콘텐츠와 겹치지 않게 한다.
- [x] 2개 선택 성공, 3개 선택 성공, 4번째 선택 차단을 mobile에서 검증한다.
- [x] 빈 목록, 로딩, 조회 오류와 cleanup 경고 상태를 각 기준 폭에서 확인한다.

완료 기준: mobile/tablet에서 목록 탐색, 새 기록 진입과 비교 진입을 가림 없이 완료할 수 있어야 한다.

## 5. 방문 입력/수정 — PR 6

### 5.1 tablet 배치

- [x] 768–1023px에서 유동 폭 본문과 280–340px 예상 매출 패널을 병렬 배치한다.
- [x] 예상 매출 패널의 sticky top과 최대 높이를 앱 header/viewport에 맞춘다.
- [x] 2열/3열 필드가 최소 사용 폭 아래에서는 내부적으로 1열/2열로 줄어들게 한다.
- [x] 768×1024와 1024×768에서 입력과 실시간 추정치를 동시에 확인한다.

### 5.2 mobile 배치와 저장 동작

- [x] 767px 이하에서 폼 section과 예상 매출 전체 카드를 단일 열로 적층한다.
- [x] 현재 기준 매출, 저장 상태와 저장 CTA를 가진 compact mobile action을 추가한다.
- [x] mobile action을 하단 내비게이션 위에 배치하고 safe area를 반영한다.
- [x] mobile action과 전체 예상 카드가 같은 저장 상태·오류를 표시하게 한다.
- [ ] 가상 키보드가 열린 동안 mobile action이 현재 입력과 오류 메시지를 가리지 않게 한다.
- [x] 오류 요약 링크 이동 후 대상 필드가 sticky 요소에 가리지 않도록 scroll margin을 적용한다.

### 5.3 복합 입력

- [x] 메뉴 행을 mobile 카드형 grid로 바꾸고 이름 → 카테고리 → 가격 → 시그니처 → 정렬/삭제 순서를 유지한다.
- [x] 메뉴 10개에서 필드·정렬·삭제 조작과 오류 표시를 검증한다.
- [x] 사진 스트립에 touch scroll/snap을 적용하고 사진 조작 버튼을 44×44px 이상으로 만든다.
- [x] 일반 사진 10장과 메뉴판 사진 3장에서 선택·정렬·삭제·업로드 상태를 검증한다.
- [x] counter, segmented control, choice grid, quick value, rating의 touch target과 줄바꿈을 검증한다.
- [x] 신규 작성 성공과 수정 저장 성공을 360px mobile에서 검증한다.
- [x] 필수값 오류, 사진 부분 실패/재시도, 세션 만료와 이탈 경고를 mobile에서 검증한다.

완료 기준: 360px mobile과 768px tablet에서 입력·검증·저장·재시도를 완료하고 실시간 추정치에 접근할 수 있어야 한다.

## 6. 상세·관찰·사진·비교 — PR 7

### 6.1 방문 상세와 관찰

- [x] 긴 카페명과 상세 action이 mobile header에서 겹치지 않게 한다.
- [x] 매출 highlight를 mobile 1열, tablet/desktop 다중 열로 배치한다.
- [x] snapshot metric과 fact grid를 mobile 2열 또는 필요한 경우 1열로 배치한다.
- [x] 큰 KRW 값, `100%+`, 긴 태그와 메모가 잘리지 않게 한다.
- [x] 관찰 입력을 mobile 세로 배치하고 추가/수정/취소 CTA의 관계를 유지한다.
- [x] 관찰 chart와 목록에서 날짜·점유율·고객 수·action이 겹치지 않게 한다.
- [x] 빈 관찰과 저장/삭제 실패 상태를 mobile에서 확인한다.

### 6.2 갤러리와 lightbox

- [x] 갤러리를 mobile 2열, tablet 3열, desktop 4열로 검증한다.
- [x] lightbox에 safe-area 여백과 44×44px 닫기 target을 적용한다.
- [x] lightbox 열기 시 초점을 이동하고 Escape/닫기 후 원래 trigger로 복귀시킨다.
- [x] lightbox가 열린 동안 배경 스크롤과 배경 상호작용을 차단한다.
- [x] landscape와 고해상도 세로 사진이 viewport 안에 표시되는지 확인한다.

### 6.3 방문 비교

- [x] 비교표만 내부 가로 스크롤을 유지하고 페이지 자체는 overflow하지 않게 한다.
- [x] 첫 비교 항목 열과 table header를 sticky 처리한다.
- [x] 스크롤 가능 상태와 끝을 gradient/안내 문구로 전달한다.
- [x] touch, trackpad와 키보드로 가로 스크롤할 수 있게 한다.
- [x] 2개/3개 비교, 긴 이름·지역·매출 범위와 누락값을 mobile에서 검증한다.
- [x] 잘못된 ID, 중복 ID와 권한 없는 요청 안내가 작은 화면에서 잘리지 않게 한다.

완료 기준: 상세의 모든 정보·action과 비교표의 header/행 관계를 mobile/tablet에서 잃지 않아야 한다.

## 7. 반응형 자동 회귀와 실기기 QA — PR 8

### 7.1 Playwright viewport 검사

- [x] `tests/e2e/responsive.spec.ts`를 추가한다.
- [x] 360×800, 412×915, 768×1024, 1024×768, 1440×900 layout smoke를 구성한다.
- [x] 320px 최소 폭에서 공개 화면과 핵심 앱 화면 overflow smoke를 추가한다.
- [x] 전체 CRUD를 모든 폭에서 반복하지 않고 대표 성공/실패 흐름과 layout 검사를 분리한다.
- [x] 각 화면에서 `documentElement.scrollWidth <= clientWidth`를 검증한다.
- [x] 비교표·사진 스트립은 내부 `scrollWidth > clientWidth`를 허용하는 명시적 예외로 검증한다.
- [x] 하단 고정 요소와 현재 CTA/필드의 bounding box가 겹치지 않는지 검증한다.
- [x] 주요 touch target의 bounding box가 44×44px 이상인지 검증한다.
- [x] 오류 저장 후 첫 오류 필드가 viewport 안에 들어오고 focus되는지 검증한다.
- [x] 767/768px, 1023/1024px 경계 회귀 검사를 추가한다.

### 7.2 접근성·콘텐츠 경계

- [x] 기존 axe 검사를 모든 핵심 화면에서 유지한다.
- [x] 키보드만으로 하단 메뉴, 폼, 사진 lightbox와 비교표를 사용할 수 있는지 확인한다.
- [x] 200% 확대 상당의 CSS viewport에서 정보·기능 손실과 2차원 페이지 스크롤이 없는지 확인한다.
- [x] reduced motion 설정에서 불필요한 animation이 줄어드는지 확인한다.
- [x] 최대 길이 카페명/지역/메뉴/메모와 큰 숫자 fixture를 추가한다.
- [x] 사진 없음, 추정 불가, 빈 목록, 오류와 재시도 fixture를 검증한다.

### 7.3 실기기와 전체 검증

- [ ] iPhone Safari에서 portrait/landscape, safe area와 가상 키보드를 확인한다.
- [ ] iPad Safari 768px portrait와 1024px landscape에서 입력/예상 병렬 배치를 확인한다.
- [ ] Android Chrome에서 하단 메뉴, 저장 action, 숫자/시간 입력과 사진 선택을 확인한다.
- [x] 각 PR의 before/after 캡처와 남은 위험을 기록한다.
- [x] `npm run format:check`를 통과한다.
- [x] `npm run typecheck`를 통과한다.
- [x] `npm run lint`를 통과한다.
- [x] `npm test`를 통과한다.
- [x] `npm run build`를 통과한다.
- [x] `npm run test:e2e`를 통과한다.
- [x] 원격 CI에서 동일 검증이 통과하는지 확인한다.

로컬 최종 결과는 Chromium 32개 통과·28개 의도적 건너뜀, WebKit iPhone 13 에뮬레이션 14개 통과,
데스크톱 visual baseline 5개 통과, Vitest 95개 통과다. WebKit 에뮬레이션은 실기기 항목을 대체하지 않는다.
[GitHub Actions CI 33305830516](https://github.com/soob-forest/cafe-scout/actions/runs/33305830516)은
커밋 `b50bc5d6cb3c3a66467a805fac231f8b2e828e62`에서 성공했다.

완료 기준: 자동화된 viewport/접근성 검사와 대상 실기기 확인이 모두 통과하고 before/after 근거가 남아야 한다.

## 8. 최종 완료 조건

- [x] 320~1,440px에서 의도하지 않은 페이지 가로 스크롤이 없다.
- [x] mobile/tablet에서 로그인 → 목록 → 입력/저장 → 상세 → 비교 흐름을 완료한다.
- [x] 768px tablet에서 입력 본문과 실시간 예상 매출을 함께 볼 수 있다.
- [ ] 하단 내비게이션, 비교 바, mobile 저장 action, safe area와 실제 가상 키보드가 서로 겹치지 않는다.
- [x] 주요 touch target, focus 표시, 오류 이동, 200% 확대와 reduced motion 기준을 만족한다.
- [x] 긴 문자열, 최대 메뉴/사진, 빈 데이터와 오류·재시도 상태가 기준 폭에서 통과한다.
- [x] 데스크톱 레이아웃과 계산·인증·저장 동작에 회귀가 없다.
- [x] 변경 파일·함수·매개변수·복잡도 제한을 준수한다.
- [ ] 모든 가정, 영향도, 검증 결과와 남은 위험이 Issue/PR에 기록되어 있다.
