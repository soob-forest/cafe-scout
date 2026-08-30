# 모바일·태블릿 반응형 시각 검토

- 검토일: 2026-08-30
- 변경 전 기준: `37bea950ac1beafd3a530e1e3edb1ec61e811919`
- 변경 후 기준: 현재 작업 트리
- 화면: 홈, 로그인, 방문 목록, 새 방문 폼, 상세, 비교
- 뷰포트: 320×720, 360×800, 412×915, 768×1024, 1024×768, 1440×900

## 검토 방법과 결정

두 가지 캡처 방식을 비교했다.

| 방식             | 장점                                                      | 단점                                                         | 결정                              |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| 전체 페이지 캡처 | 긴 폼의 전체 내용을 한 장에서 확인                        | fixed 요소를 긴 문서 좌표에 재배치해 실제 겹침 판정이 부정확 | 보조 검토에만 사용                |
| viewport 캡처    | 사용자가 보는 fixed/sticky 위치와 화면 높이를 그대로 보존 | 긴 페이지는 스크롤 위치별 추가 확인 필요                     | before/after 증적의 기준으로 선택 |

기준 커밋은 임시 detached worktree의 webpack 개발 서버로 재현했다. Turbopack은 worktree 밖의
`node_modules` symlink를 거부하므로 기준선 서버에만 `next dev --webpack`을 사용했다. 현재 서버는
기본 Turbopack을 사용했으며 두 서버 모두 같은 로컬 Supabase seed와 브라우저 엔진을 사용했다.

## 재현 명령

서로 다른 터미널에서 기준 커밋 서버와 현재 서버를 실행한 뒤 다음 명령으로 캡처한다. 기준 worktree에는
현재 프로젝트와 같은 `.env.local` 설정이 필요하며 비밀값은 캡처·매니페스트에 기록하지 않는다.

```bash
node scripts/capture-responsive-evidence.mjs http://127.0.0.1:3002 before
node scripts/capture-responsive-evidence.mjs http://127.0.0.1:3001 after
```

각 실행은 Playwright가 자동 정리하지 않는 ignored `artifacts/responsive-evidence/{before,after}`에 PNG
36장과 `manifest.json`을 만든다.
매니페스트에는 파일명, route, viewport와 문서 `clientWidth`/`scrollWidth`만 저장한다. 두 세트 모두
36장이 생성됐고 허용되지 않은 페이지 overflow는 0건이었다.

1440×900 데스크톱 비교는 기준 커밋에서 golden을 만든 다음 현재 서버를 대상으로 실행한다.

```bash
RESPONSIVE_VISUAL_BASE_URL=http://127.0.0.1:3002 \
  npx playwright test --config=playwright.visual.config.ts --update-snapshots
RESPONSIVE_VISUAL_BASE_URL=http://127.0.0.1:3001 \
  npx playwright test --config=playwright.visual.config.ts
npx playwright test --config=playwright.compat.config.ts
```

## 데스크톱 픽셀 검토

strict 비교는 `RESPONSIVE_VISUAL_STRICT=1`로 실행했다. 공개 화면은 완전히 일치했고 인증 화면의
차이는 계획된 44px 조작 영역과 상세/비교 보조 UI에 한정됐다.

| 화면       | 변경 픽셀 | 판정                                              |
| ---------- | --------: | ------------------------------------------------- |
| 홈         |         0 | 동일                                              |
| 로그인     |         0 | 동일                                              |
| 방문 목록  |       841 | 상단 새 기록·로그아웃 touch target 확대           |
| 새 방문 폼 |     8,094 | segmented/chip/counter/rating 등 44px target 확대 |
| 방문 상세  |     1,323 | 수정·삭제·관찰 action target 확대                 |
| 방문 비교  |       837 | 상단 action target과 비교 스크롤 보조 처리        |

일반 실행은 위에서 검토한 의도된 픽셀 수에 작은 여유만 둔다. 공개 화면은 0픽셀 차이를 계속 강제하며,
인증 화면별 한도를 넘으면 diff PNG와 실제/기대 이미지를 `test-results/visual`에 남긴다.

## 화면별 검토 결과

- 320/360/412px 폼: 1열 입력, compact 저장 bar와 하단 내비게이션을 확인했다.
- 768×1024 폼: 유동 본문과 280~340px 예상 매출 패널이 동시에 보인다.
- 1024×768 폼: desktop 구간 전환 직후에도 입력과 예상 매출이 병렬 유지된다.
- 모바일 비교: 첫 열 고정, 스크롤 안내, 페이지 overflow 부재를 확인했다.
- 모바일 상세: 1/2열 지표, 긴 값 줄바꿈, 관찰 action과 사진 빈 상태를 확인했다.
- 홈·로그인·목록: 각 구간의 1/2/3열 전환과 CTA 접근성을 확인했다.

## 시각·브라우저 검토에서 발견한 결함

현재 구현의 첫 캡처에서 모바일 `.estimate-sidebar`에 데스크톱 sticky의 `top: 96px`이 남아 저장 bar가
제목을 가리는 P0 결함을 발견했다. 모바일 override에 `top: auto`를 추가했고 다음 조건을 E2E에 넣었다.

- 저장 card의 위쪽이 폼 제목 아래에 있어야 한다.
- 저장 card의 아래쪽은 하단 내비게이션보다 최소 4px 위에 있어야 한다.
- 두 고정 요소의 간격은 24px 이하여야 한다.

수정 후 360×800 viewport 캡처와 targeted E2E가 통과했다.

전체 mobile CRUD를 다시 실행하자 포커스된 `.form-section`의 `z-index: 35`가 고정 저장 action의
`z-index: 34`보다 높아 pointer를 가로채는 두 경로가 재현됐다. 포커스 section을 낮추는 방식은
입력 가시성 계약을 약화하므로 저장 action을 36으로 올리고 하단 내비게이션 41 아래에 유지했다.
전용 검사는 입력을 focus한 뒤 저장 버튼 중심의 `elementFromPoint`가 버튼 내부인지 확인한다.

WebKit에서는 overflow 영역의 native `ArrowLeft`/`ArrowRight` 스크롤이 Chromium과 다르게 동작했다.
WebKit만 검사를 완화하는 대신 작은 client wrapper가 영역 폭의 70%를 명시적으로 이동하도록 했고,
iPhone 13 WebKit 에뮬레이션의 반응형·상태 검사 14개가 통과했다. 이는 실제 iPhone의 safe area,
가상 키보드와 사진 선택기 검증을 대체하지 않는다.

## 계획된 PR별 증적과 남은 위험

| 묶음               | before/after 증적                      | 검토 결과                                   | 남은 위험                  |
| ------------------ | -------------------------------------- | ------------------------------------------- | -------------------------- |
| PR 1 기준선        | 36장 before + manifest                 | 기준 화면 재현 완료                         | GitHub Issue 첨부 대기     |
| PR 2 CSS 분리      | 공개 화면 exact, 인증 화면 strict diff | cascade 누락 없음                           | 다른 OS의 폰트 raster 차이 |
| PR 3 컴포넌트 분리 | 폼·상세 pixel diff + unit/E2E          | 공개 API·DOM 흐름 유지                      | 실제 사진 선택기 차이      |
| PR 4 공통 기반     | 모든 viewport shell 캡처               | safe area/token/44px 적용                   | 실제 기기 safe area        |
| PR 5 공개·목록     | 홈·로그인·목록 6폭 pair                | 1/2/3열과 비교 bar 정상                     | iOS 글꼴 확대 설정         |
| PR 6 폼            | 폼 6폭 pair                            | 저장 bar 적층·tablet 병렬 정상              | 실제 가상 키보드           |
| PR 7 상세·비교     | 상세·비교 6폭 pair                     | Chromium/WebKit 키보드 scroll 정상          | 실기기 touch momentum      |
| PR 8 회귀          | manifest + visual/E2E report           | Chromium 32·WebKit 14·visual 5·원격 CI 통과 | 실기기 3종                 |

[원격 CI 33305830516](https://github.com/soob-forest/cafe-scout/actions/runs/33305830516)은 커밋
`b50bc5d6cb3c3a66467a805fac231f8b2e828e62`에서 성공했다. 실제 iPhone/iPad/Android 결과와
GitHub Issue 링크는 외부 환경이 준비되면 이 표에 추가한다.
