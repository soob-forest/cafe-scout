# Cafe Scout

현장에서 관찰한 카페의 좌석, 고객, 체류시간, 객단가와 영업시간을 기록하고 `mvp-v1` 모델로 예상 일·월 매출을 계산하는 비공개 운영 도구입니다.

## 기술 구성

- Next.js 16 App Router, React 19, TypeScript strict
- Supabase Auth, Postgres, private Storage, RLS
- Zod 공유 검증, Vitest, Testing Library, Playwright
- Vercel 배포 (`icn1`)와 환경별 Supabase 분리

## 로컬 실행

Node.js `22.22.2`, npm `11.12.0`, Docker가 필요합니다.

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:types
cp .env.example .env.local
```

`npx supabase status -o env`의 `API_URL`, `PUBLISHABLE_KEY`를 각각 `.env.local`의 두 변수에 넣은 뒤 실행합니다.

```bash
npm run dev
```

로컬 운영자 계정은 `scout@example.com` / `cafe-scout-local`입니다. `isolation@example.com`은 RLS 통합 테스트 전용이며 제품 데이터가 없습니다.

## 검증

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run test:migration-upgrade
npm run test:integration
npm run build
npm run test:e2e
```

업그레이드·통합 테스트와 E2E 전에 로컬 Supabase가 실행 중이어야 합니다. `test:migration-upgrade`는 직전 migration 상태의 기존 데이터에 최신 migration을 적용한 뒤 정상 seed 상태로 복구합니다. `npm run check`는 포맷, typecheck, lint, 단위·컴포넌트·migration 업그레이드·통합 테스트와 production build를 묶어 실행합니다.

## 문서

- [제품/구현 명세](docs/SPEC.md)
- [구현 체크리스트](docs/TODO.md)
- [아키텍처 결정](docs/adr/0001-free-tier-web-architecture.md)
- [P1 관찰 모델 결정](docs/adr/0002-p1-occupancy-observations.md)
- [배포 절차](docs/DEPLOYMENT.md)
- [운영 체크리스트](docs/OPERATIONS.md)
- [백업·복구 runbook](docs/RECOVERY.md)
