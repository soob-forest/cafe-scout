# 모바일·태블릿 반응형 웹 구현 보고서

- 작업일: 2026-08-30
- 기준 커밋: `37bea950ac1beafd3a530e1e3edb1ec61e811919`
- 지원 범위: 최근 iOS/iPadOS Safari, Android Chrome
- 구간: mobile `≤767px`, tablet `768~1023px`, desktop `≥1024px`
- 허용 가로 스크롤: 방문 비교표와 사진 선택 스트립 내부만 허용

## Problem 1-Pager

### 배경과 문제

현장 입력 도구인 Cafe Scout는 작은 모바일과 태블릿 세로 화면에서도 입력·추정·저장을 함께
수행해야 한다. 기존 구현은 2,113줄 전역 CSS와 1,460줄 방문 폼에 책임이 집중되어 있었고,
태블릿에서 예상 매출 패널이 사라지거나 모바일 고정 요소와 조작 영역이 겹칠 위험을 자동으로
검사하지 못했다.

### 목표

- 320~1,440px에서 의도하지 않은 페이지 가로 스크롤 제거
- mobile의 고정 내비게이션·저장 action과 tablet의 입력·추정 병렬 배치 보장
- 주요 조작 영역 44×44px, safe area, 오류 포커스, reduced motion 지원
- 기존 계산·인증·저장·사진 재시도 동작과 desktop 레이아웃 보존

### 비목표와 제약

- 브랜드 재설계, 계산 모델·DB·인증·사진 정책 변경은 하지 않는다.
- 새 CSS 프레임워크나 PWA를 도입하지 않는다.
- Next.js 16.3.1 저장소 내 CSS/viewport 가이드를 기준으로 한다.
- 변경 파일 300줄, 함수 50줄, 매개변수 5개, 복잡도 10 이하를 지킨다.

## 대안과 결정

| 결정          | 대안 A                                                                  | 대안 B                                                            | 선택과 이유                                                                                                  |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 스타일 구조   | 기존 전역 CSS에 media query 추가: 빠르지만 결합 증가                    | CSS Modules/Tailwind 전면 전환: 격리는 좋지만 회귀 범위가 큼      | 기존 class와 단일 진입점을 유지한 책임별 분리. cascade를 보존하면서 작은 변경 가능                           |
| 폼 분리       | section마다 많은 props 전달: 의존성이 명시적이나 누락 위험 큼           | 전역 상태 도입: 확장성은 있으나 범위 대비 과함                    | 폼 내부 Context + section component. 공개 API와 DOM 순서를 유지하고 폼 밖으로 추상화하지 않음                |
| 모바일 키보드 | 포커스 중 action을 숨김/재배치: 가림은 줄지만 pointer 전환 중 클릭 유실 | action 고정 + 여백/scroll margin: DOM이 안정적이나 공간 예약 필요 | 고정 위치와 180px scroll 여백을 유지하고 section 35 < action 36 < nav 41로 적층. E2E에서 pointer 적중을 검사 |
| 비교표        | 모바일 카드로 변환: 읽기 쉽지만 행 기준 비교가 약해짐                   | 내부 가로 스크롤 유지: 비교 관계 보존, 스크롤 안내 필요           | 첫 열·header sticky, 안내 문구와 내부 키보드 스크롤을 추가                                                   |

## 영향도

- 호출 경로: `app/layout` → `(app)/layout` → `AppShell` → 방문 route → visits feature component
- CSS: `globals.css`는 import 전용 진입점이며 base → 화면별 → tablet → mobile 순서를 유지한다.
- 폼: route가 사용하는 `VisitForm` props, 필드 id, aria 연결, DOM section 순서와 저장 action은 유지한다.
- 사진: 준비·압축·업로드·부분 실패·재시도·정렬 로직은 별도 경계로 이동했으며 정책은 바꾸지 않았다.
- 상세: 서버 데이터 조회는 page에, 화면 section은 visits feature에 둔다.

## 기준선과 발견 결함

변경 전 기준 커밋에서 format/typecheck/lint, 93개 단위 테스트, production build와 desktop/tablet/mobile
E2E 18개가 통과했다. 기준 커밋을 임시 worktree에서 재현해 6개 viewport × 6개 화면의 before 36장과
현재 구현 after 36장을 캡처했다. 방법과 판정은 [`RESPONSIVE_VISUAL_REVIEW.md`](./RESPONSIVE_VISUAL_REVIEW.md)에
기록했다.

| 우선순위 | 결함                                                          | 영향 화면        | 처리                                                       |
| -------- | ------------------------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| P0       | 768px에서 입력과 예상 매출을 동시에 볼 수 없음                | 방문 입력/수정   | 280~340px tablet 패널과 유동 본문 병렬 배치                |
| P0       | 포커스된 section이 고정 저장 action의 pointer를 가로챔        | mobile 입력/저장 | section 35 < action 36 < nav 41 적층과 pointer 회귀 검사   |
| P0       | desktop sticky의 `top`이 mobile 저장 bar에 남아 제목을 가림   | mobile 입력/저장 | mobile에서 `top: auto`, 상·하단 geometry assertion 추가    |
| P0       | 저장 실패 후 첫 필드가 disabled 해제 전에 focus되어 이동 실패 | 입력 검증        | focus 재시도 helper와 E2E viewport assertion 추가          |
| P1       | 일부 칩·정렬·quick value target이 44px 미만                   | 폼·사진          | 모든 주요 target 최소 크기 보정 및 geometry 검사           |
| P1       | 비교표의 가로 스크롤 관계가 불명확                            | 방문 비교        | 첫 열/header sticky, 안내, 키보드 스크롤 추가              |
| P1       | WebKit에서 비교표의 native 화살표 스크롤이 동작하지 않음      | 방문 비교        | 작은 client 경계에서 좌·우 화살표 scroll을 명시적으로 처리 |
| P1       | lightbox 초점·배경 스크롤 관리 부족                           | 상세 사진        | 초점 trap/복귀, Escape, body scroll lock, safe area 적용   |

## 구현 결과

- CSS를 14개 책임 파일로 분리했고 모든 스타일 파일을 300줄 이하로 유지했다.
- 홈·로그인·앱 셸에 `100dvh`, safe area, 유동 폭/글자 token과 긴 문자열 경계를 적용했다.
- 목록은 desktop 3열, tablet 2열, mobile 1열이며 비교 바와 하단 내비게이션 간격을 통일했다.
- 폼은 tablet 병렬, mobile 단일 열 + compact 저장 action으로 구성했다.
- 최대 메뉴는 mobile/tablet 카드 grid, 사진은 내부 scroll snap과 44px 조작 버튼을 사용한다.
- 상세 지표·메뉴·고객·사진·메모를 분리하고 mobile 1/2열, tablet 3열 gallery를 적용했다.
- 비교표는 페이지 overflow 없이 내부 스크롤만 허용한다.
- 비교표의 좌·우 화살표는 Chromium과 WebKit에서 같은 거리 계산으로 동작한다.
- `responsive.spec.ts`가 320, 360, 412, 767, 768, 1023, 1024, 1440px과 최대 메뉴 10개,
  일반 사진 10장, 메뉴판 사진 3장, 터치 target, 오류 focus, 고정 요소, reduced motion을 검사한다.
- `responsive-states.spec.ts`가 breakpoint 연속 resize, 빈/로딩/오류/cleanup, 추정 불가·사진 없음,
  관찰 전송 실패, 중복·권한 없는 비교, 키보드 경로와 landscape 세로 사진을 검사한다.
- 1,280px과 1,440px 물리 폭의 200% 확대에 해당하는 640px/720px CSS viewport에서 핵심 화면의
  재배치와 페이지 overflow 부재를 검사한다.

### 결정적 상태 fixture

| 상태                            | 재현 근거                                                         |
| ------------------------------- | ----------------------------------------------------------------- |
| 빈 목록                         | 데이터가 없는 local isolation 계정                                |
| 추정 불가·사진/관찰 없음        | local seed의 `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3`               |
| 최대 메뉴·사진·업로드 부분 실패 | Playwright가 입력/파일과 503 응답을 결정적으로 구성               |
| 로딩·조회 오류                  | 실제 `loading.tsx`/`error.tsx`와 같은 class 구조의 layout fixture |
| 관찰 저장·삭제 실패             | 현재 route의 Server Action POST를 503으로 차단                    |

## 검증과 재현

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

새 strict 구조 검사는 변경된 TS/TSX와 E2E에 ESLint `max-lines-per-function: 50`, `complexity: 10`,
`max-params: 5`를 강제해 통과 여부를 확인한다. Playwright HTML report에는 mobile/tablet/desktop 폼과
로그인 캡처가 첨부된다.

- format/typecheck/lint: 통과
- Vitest: 15개 파일, 95개 테스트 통과
- Next.js production build: 통과
- Chromium Playwright: 32개 통과, 중복 viewport 실행을 막기 위한 28개 건너뜀
- WebKit iPhone 13 에뮬레이션: 반응형·상태 14개 통과
- 데스크톱 visual baseline: 5개 통과, before/after viewport 증적 36쌍 생성
- [GitHub Actions CI 33305830516](https://github.com/soob-forest/cafe-scout/actions/runs/33305830516):
  커밋 `b50bc5d6cb3c3a66467a805fac231f8b2e828e62`에서 성공

## 외부 확인이 필요한 항목

- GitHub CLI가 로그인되지 않아 Issue/PR 생성과 캡처 첨부는 수행할 수 없다.
- 연결 가능한 실제 iPhone/iPad/Android가 없어 Safari/Chrome의 실제 safe area, 가상 키보드,
  사진 선택기는 실기기 확인이 필요하다.
- WebKit iPhone 13 에뮬레이션은 엔진·viewport 호환성 근거이며 실제 iOS 기기의 safe area, 소프트웨어
  키보드와 사진 선택기 검증을 대체하지 않는다.
- 변경 전/후 캡처는 로컬에 생성했지만 GitHub Issue/PR 첨부는 인증 후 수행해야 한다. 200% 확대는
  동등 CSS viewport로 자동 검사했으며 모바일 브라우저의 실제 pinch/가상 키보드 조합은 실기기
  항목에 포함한다.
- 현재 로컬 Node.js는 `v23.11.0`으로 프로젝트 권장 22/24와 다르지만, 원격 CI가 `.nvmrc`의 지원
  버전에서 전체 검증을 통과했다.

외부 확인 결과는 이 문서의 기준과 명령을 그대로 Issue/PR에 옮겨 기록한다. 비밀값이나 로컬 인증
정보는 문서·로그·첨부물에 포함하지 않는다.
