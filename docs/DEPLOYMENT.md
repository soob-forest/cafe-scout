# 배포 절차

## 환경 분리

| 환경       | Vercel            | Supabase           | 목적                   |
| ---------- | ----------------- | ------------------ | ---------------------- |
| Local      | 로컬              | Supabase CLI       | 개발·자동 테스트       |
| Preview    | PR Preview        | 개발 전용 프로젝트 | migration 및 화면 검증 |
| Production | `main` Production | 운영 전용 프로젝트 | 검증 사용자 운영       |

Preview와 Production은 서로 다른 project URL/publishable key를 사용한다. 프로젝트 수 제약으로 개발용 프로젝트를 만들 수 없다면 Preview에서 데이터 기능을 끄고 로컬 검증으로 대체하며, Production 프로젝트를 Preview에 연결하지 않는다.

## 최초 설정

1. Supabase 개발/운영 프로젝트를 각각 생성하고 가능한 한 서울과 가까운 동일 권역을 선택한다.
2. Dashboard의 Authentication 설정에서 공개 가입을 끄고 Email provider 로그인은 유지한다.
3. Authentication > Users에서 운영자 이메일을 사전 생성하고 임시 비밀번호를 안전한 채널로 전달한다. 가입/초대 UI는 만들지 않는다.
4. 개발 프로젝트에 CLI를 연결하고 migration을 적용한다.

```bash
npx supabase login
npx supabase link --project-ref <development-project-ref>
npx supabase db push --dry-run
npx supabase db push
```

5. `npm run db:types` 결과가 migration과 일치하는지 확인하고 전체 검증을 실행한다.
6. Vercel 프로젝트를 Git 저장소에 연결한다. Production Branch는 `main`, PR은 Preview 배포로 둔다.
7. Vercel Environment Variables에 환경별로 아래 두 값만 등록한다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

`service_role`은 Vercel에 등록하지 않는다. Server Action도 로그인 사용자의 쿠키 세션으로 접근한다.

## 리전과 배포

`vercel.json`은 Vercel Function을 서울 `icn1`에 둔다. Supabase 프로젝트도 가능한 한 가까운 Northeast Asia 권역을 선택하고 배포 전 양쪽 Dashboard의 실제 리전을 확인한다.

Production migration은 다음 순서를 지킨다.

1. [RECOVERY.md](./RECOVERY.md)에 따라 DB와 Storage를 수동 백업한다.
   백업 명령의 `SUPABASE_PROJECT_REF`와 현재 CLI link가 Production project ref와 일치하지 않으면 진행하지 않는다.
2. 개발 Supabase에서 `db reset`, 통합/E2E 테스트를 통과한다.
3. 하위 호환 가능한 확장 migration을 운영 DB에 먼저 적용한다.
4. 애플리케이션을 배포하고 읽기/쓰기를 새 구조로 전환한다.
5. 최소 한 번의 안정화 기간 뒤 축소 migration으로 구 구조를 제거한다.

파괴적 변경과 애플리케이션 전환을 한 배포에 묶지 않는다.

`202608190001_review_hardening.sql`은 확장 migration으로서 신규 앱이 보내는 `_createRequestId`를 멱등 키로 사용하지만, 아직 열려 있는 구버전 클라이언트의 키 없는 생성 요청도 임시로 허용한다. 애플리케이션 배포 후 최소 한 번의 안정화 기간과 기존 브라우저 탭의 만료를 확인한 뒤에만 누락 키를 거부하는 별도 축소 migration을 추가한다.

## 릴리즈 확인

- CI의 고정 npm 버전 설치, 생성 DB 타입 변경 검사, DB lint, typecheck, lint, 단위/컴포넌트 테스트, 기존 데이터 migration 업그레이드, Supabase 통합 테스트, build, E2E가 통과했다.
- Preview URL이 개발 Supabase만 사용한다.
- 비로그인 접근과 다른 계정 데이터 접근이 차단된다.
- 새 기록 저장, 사진 직접 업로드, 상세/수정/삭제, 비교가 동작한다.
- Supabase Auth 공개 가입이 꺼져 있고 운영자 계정만 존재한다.
- Vercel/Supabase 로그에 토큰, 환경 변수, signed URL query, 자유 메모가 남지 않는다.
- 상업적 출시나 수익 활동 전 Vercel Pro 또는 다른 호스팅을 검토하고 ADR을 갱신한다.

실제 Preview/Production 프로젝트 연결과 첫 배포는 해당 계정 권한 및 project ref가 있는 운영자가 수행한다.
