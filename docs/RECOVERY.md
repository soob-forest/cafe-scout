# 백업·복구 Runbook

Supabase DB backup은 Storage의 실제 object 바이너리를 포함하지 않는다. DB와 `cafe-photos`를 같은 복구 시점에 각각 보관한다.

## 백업

파괴적 migration 전과 중요한 사용자 검증 전 실행한다. Session pooler 연결 문자열을 `SUPABASE_DB_URL`로 사용하고, 저장소는 대상 프로젝트에 `supabase link`된 상태여야 한다. 스크립트는 DB URL, 명시한 project ref와 CLI-linked Storage project ref가 모두 일치할 때만 실행된다. 기존 파일 혼입을 막기 위해 백업 디렉터리는 존재하지 않거나 비어 있어야 한다. 가능하면 쓰기가 적은 시간대에 실행한다.

```bash
SUPABASE_DB_URL='<session-pooler-connection-string>' \
SUPABASE_PROJECT_REF='<source-project-ref>' \
scripts/backup.sh backups/2026-08-18-before-migration
```

결과에는 `roles.sql`, `schema.sql`, `data.sql`, `photo-paths.json`, `storage/cafe-photos/`, `manifest.json`이 있어야 한다. 스크립트는 DB data dump 전·Storage 복사 후의 사진 metadata object path를 비교하고, 해당 목록이 실제 Storage 백업 파일과 정확히 일치할 때만 `photo-paths.json`과 manifest v2를 만든다. 백업 중 사진이 변경되거나 누락/고아 object가 있으면 실패하므로 결과를 폐기하고 조용한 시간에 다시 실행한다. manifest에는 원본 project ref, DB 사진/Storage object 수와 모든 파일의 크기·SHA-256이 기록된다. 결과를 디렉터리 전체 단위로 암호화해 프로젝트와 다른 위치에 복사하고, 보관 시각·대상 project ref·실행자를 기록한다. 백업 디렉터리는 Git에 커밋하지 않는다.

복원 스크립트는 어떤 DB/Storage 변경보다 먼저 manifest와 DB 사진 목록, 실제 파일 목록·크기·해시를 검증한다. 누락 파일, 빈 SQL, 추가 파일, 변조된 파일, DB/Storage 사진 목록 불일치 또는 Storage 디렉터리 누락이 있으면 중단한다. `photo-paths.json`이 없거나 manifest v2가 아닌 이전 백업은 자동 복원하지 않는다. 꼭 필요한 경우 별도 격리 환경에서 내용과 DB/Storage 정합성을 검증한 뒤 현재 형식으로 새 백업을 만들어 사용한다.

로컬 복구 훈련에서는 같은 스크립트를 로컬 대상으로 실행할 수 있다.

```bash
SUPABASE_TARGET=local scripts/backup.sh /tmp/cafe-scout-recovery-drill
```

로컬 DB를 seed 없이 migration으로 재구축한 뒤, 명시한 로컬 DB 컨테이너에 데이터와 Storage를 복원한다. `db reset`은 로컬 데이터를 지우므로 복구 훈련 외에는 실행하지 않는다.

```bash
npm run db:reset -- --no-seed
SUPABASE_TARGET=local \
RESTORE_DATA_ONLY=yes \
SUPABASE_DB_CONTAINER=supabase_db_cafe-scout \
CONFIRM_RESTORE=yes \
scripts/restore.sh /tmp/cafe-scout-recovery-drill
```

## 빈 프로젝트 복구

1. 새 Supabase 프로젝트를 만들고 기존과 같은 주요 설정/확장을 확인한다.
2. 대상이 비어 있고 Production 트래픽을 받지 않는지 두 번 확인한다.
3. 대상 project ref에 CLI를 연결한다.
4. `TARGET_SUPABASE_DB_URL`을 새 프로젝트의 Session pooler URL로 설정하고 `TARGET_SUPABASE_PROJECT_REF`와 현재 CLI link가 같은지 확인한다.
5. PostgreSQL `psql`을 설치하고 명시적 확인값과 함께 복구한다.

```bash
TARGET_SUPABASE_DB_URL='<new-session-pooler-connection-string>' \
TARGET_SUPABASE_PROJECT_REF='<target-project-ref>' \
CONFIRM_RESTORE_PROJECT_REF='<target-project-ref>' \
CONFIRM_RESTORE=yes \
scripts/restore.sh backups/2026-08-18-before-migration
```

6. Dashboard에서 Email login을 유지하고 공개 가입을 비활성화한다. URL/API key와 Auth 설정은 backup에 의존하지 않고 새 프로젝트 기준으로 재설정한다.
7. Vercel의 대상 환경 변수 두 개만 새 프로젝트 값으로 바꾼다.

## 복구 검증

- 운영자 로그인과 로그아웃이 된다.
- Cafe, CafeVisit, 메뉴, snapshot, 추가 관찰 건수가 backup 시점과 같다.
- 복원 전에 출력된 원본 project ref와 DB 사진/Storage object 수가 `photo-paths.json`, manifest 및 백업 기록과 일치한다.
- 일반 사진/메뉴판 사진이 private 상태로 열리고 signed URL 만료 후 재발급된다.
- 새 기록 생성/수정/삭제와 사진 직접 업로드가 된다.
- 익명 및 격리 테스트 계정으로 다른 소유자 데이터가 보이지 않는다.
- `npm run test:integration`에 해당하는 RLS/Storage 검증을 대상 환경에 맞게 수행한다.
- 복구 검증이 끝나기 전 Production DNS/환경 변수를 전환하지 않는다.

대상 검증은 `supabase/.temp/project-ref`를 읽는다. 다른 작업 디렉터리에서 자동 검증할 때만 `SUPABASE_LINKED_REF_FILE`로 동일한 CLI link 파일의 경로를 명시한다. DB URL이나 link를 확인할 수 없으면 안전을 위해 백업/복구가 중단된다.

## 로컬 복구 훈련 기록

2026-08-18에 다음을 실행했다.

- migration 두 개와 seed만으로 로컬 Postgres/Auth/Storage schema를 반복 재구축했다.
- `scripts/backup.sh`로 roles/schema 및 Auth/public 데이터를 export하고 private Storage의 유효한 1×1 WebP를 내려받았다.
- seed 없이 migration만 적용한 빈 로컬 데이터 상태(`auth.users`, Cafe, Storage object 모두 0건)를 확인했다.
- `scripts/restore.sh`의 로컬 훈련 모드로 DB 데이터를 import하고 Storage object를 원래 경로와 `image/webp` MIME으로 재업로드했다.
- 운영자 로그인, Cafe 3건, CafeVisit 3건, 추가 관찰 2건, WebP 46 bytes를 확인했다.
- 익명 Storage 읽기 거부와 RLS/Storage 통합 테스트 6건 통과를 확인했다.

2026-08-18 구현 적합성 보완 후 복구 훈련을 다시 실행했다.

- 새 무결성 migration까지 seed 없이 재구축한 뒤 Auth/public 데이터를 복원했다.
- 실제 WebP object를 백업하고 `storage/cafe-photos/{owner}/{path}` 구조가 같은 object path로 복원되는지 확인했다.
- DB URL·명시 project ref·CLI-linked Storage ref 불일치와 비어 있지 않은 백업 디렉터리가 작업 전에 거부되는 자동 테스트를 추가했다.
- 복원 후 운영자 로그인과 RLS/Storage 및 계산 parity를 포함한 통합 테스트 8건 통과를 확인했다.

2026-08-19 잠재 이슈 보완 후 manifest 기반 복구 훈련을 실행했다.

- migration 네 개를 seed 없이 재구축하고, `roles.sql`, `schema.sql`, `data.sql`과 `image/webp` 메타데이터의 Storage object 1개를 백업했다.
- `manifest.json`이 원본 `local` ref, Storage object 1개, 전체 파일 크기와 SHA-256을 기록하고 변조·누락을 거부하는지 확인했다.
- Storage CLI의 대상 디렉터리 규칙을 실제 파일로 검증해 `storage/cafe-photos/{owner}/{path}`가 중첩 없이 보존되도록 수정했다.
- manifest 검증 뒤 단일 transaction으로 데이터를 복원하고 운영자 2명, CafeVisit 3건, 원래 object path의 Storage 파일 1개를 확인했다.
- 복구 훈련 뒤 로컬 환경을 최신 migration과 정상 seed 상태로 다시 초기화하고 통합 테스트 12건과 DB lint를 통과시켰다.

2026-08-19 전체 변경사항 재검토 보완 후 manifest v2 복구 훈련을 실행했다.

- DB data dump 전·Storage 복사 후의 `cafe_photos.object_path` 목록과 실제 Storage object 1개가 일치해야만 `photo-paths.json`과 manifest v2가 생성되는지 확인했다.
- seed 없는 최신 schema에 DB data와 51-byte WebP를 복원하고 metadata 1행, 원래 object path와 다운로드한 바이너리 크기를 확인했다.
- 직전 migration에 오류가 있는 기존 snapshot/관찰 행을 만든 뒤 최신 migration이 이를 재계산하는 업그레이드 테스트를 통과시켰다.
- 복구 훈련 뒤 최신 migration과 정상 seed로 초기화하고 단위/컴포넌트 93건, 통합 12건, E2E 18건, build와 DB lint를 통과시켰다.

실제 hosted 복구 훈련은 개발 프로젝트 자격 증명이 준비되면 동일 절차로 수행하고 이 기록에 project ref가 아닌 실행 일자와 결과만 남긴다.
