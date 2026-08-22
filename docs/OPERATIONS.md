# 운영 체크리스트

## 월 1회

- Vercel Usage에서 Function 실행, 대역폭, build 사용량과 경고를 확인한다.
- Supabase Usage에서 DB, Storage, egress, Auth 사용량을 확인한다.
- 무료 한도 70% 이상이 2개월 지속되면 유료 전환 또는 구조 변경 ADR을 작성한다.
- Supabase 프로젝트가 일시정지되었는지 확인하고, 인위적인 keep-alive 요청은 사용하지 않는다.
- `cafe-photos`가 private이고 3MB 및 JPEG/PNG/WebP 제한을 유지하는지 확인한다.
- Auth 공개 가입이 꺼져 있고 불필요한 운영자 계정이 없는지 확인한다.
- Security Advisor에서 RLS 경고를 확인한다.
- 최근 backup의 DB SQL 3종, `photo-paths.json`, Storage 파일, manifest v2를 서로 다른 저장 위치에서 열 수 있는지 확인하고 `node scripts/backup-manifest.mjs verify <backup-directory>`가 통과하는지 확인한다. 기록된 project ref가 DB와 Storage에 동일하고 DB 사진 수와 Storage object 수가 같은지도 확인한다.
- 고아 사진을 dry-run으로 점검한다.

```bash
SUPABASE_URL=<project-url> \
SUPABASE_SERVICE_ROLE_KEY=<operator-only-secret> \
npm run storage:audit
```

정리 후보는 업로드 시작 후 최소 1시간 지난 object만 포함한다. 경로와 DB를 확인한 뒤에만 삭제한다.

```bash
SUPABASE_URL=<project-url> \
SUPABASE_SERVICE_ROLE_KEY=<operator-only-secret> \
CONFIRM_DELETE_ORPHAN_PHOTOS=yes \
npm run storage:audit -- --delete
```

이 service key는 작업자 로컬 셸에서만 사용하고 `.env*`, Vercel, 로그, CI artifact에 저장하지 않는다.

## 장애 안내

| 상황                            | 사용자 화면                                 | 운영 대응                                   |
| ------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Supabase 일시정지/네트워크 장애 | 재시도 가능한 연결 오류 화면                | Dashboard에서 재개, 상태 확인 후 재시도     |
| 무료 한도 도달                  | 저장/조회 오류 안내, 입력은 브라우저에 유지 | Usage 확인, 다음 기간 대기 또는 플랜 전환   |
| signed URL 만료                 | 새 페이지 요청으로 URL 재발급               | 영구 URL을 만들지 말고 상세/리스트 새로고침 |
| 사진만 업로드 실패              | 기록 저장됨·사진 업로드 미완료              | 폼의 저장으로 재시도, 이후 orphan audit     |
| DB 삭제 후 Storage 정리 실패    | 목록에 정리 지연 안내                       | orphan audit dry-run 후 명시적 삭제         |

## 로깅 규칙

- 인증 토큰, 쿠키, publishable/service key 값을 기록하지 않는다.
- signed URL 전체를 기록하지 않는다. 필요하면 query를 제거한 object path만 사용한다.
- `strengths`, `adoptablePoints` 등 자유 입력 내용을 기록하지 않는다.
- 사용자 오류는 일반화된 한국어 메시지로 반환하고, 서버에는 오류 종류와 안전한 request context만 기록한다.
