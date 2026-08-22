# ADR-0003: 브라우저 미리보기와 DB snapshot의 버전화된 계산 계약

- 상태: 승인됨
- 결정일: 2026-08-18
- 대체 범위: ADR-0001의 “저장 시 서버가 같은 TypeScript 함수로 다시 계산” 문구

## 배경

방문 저장은 Cafe, Visit, 메뉴와 snapshot을 하나의 Postgres transaction으로 처리해야 한다. 브라우저는 입력 중 즉시 계산해야 하므로 순수 TypeScript 계산기도 필요하다. TypeScript 함수를 Postgres transaction 안에서 직접 실행할 수 없기 때문에 기존 구현은 TypeScript 계산 호출, 저장 RPC 계산, snapshot trigger 계산을 중복으로 보유했다. 이 구조는 모델 변경 시 구현이 서로 달라질 수 있고, 실제로 DB 컬럼 정밀도가 중간 계산에 반영되는 차이를 만들었다.

## 결정

- 영속 snapshot 계산의 유일한 구현은 `recompute_business_snapshot` DB trigger로 둔다.
- `save_cafe_visit` RPC는 정규화된 원시 입력만 저장하고 파생값을 직접 계산하지 않는다.
- 브라우저 미리보기는 Supabase에 의존하지 않는 순수 TypeScript `estimateBusiness`를 유지한다.
- 두 런타임은 `docs/SPEC.md`의 수식, 계수와 `estimation_model_version`을 하나의 버전화된 모델 계약으로 사용한다.
- PRD 기준값, 0과 경계값, 자정 넘김, 정원 초과, 테이크아웃 전 구간, 계산 불가 조합을 실제 DB와 TypeScript에 함께 입력하는 parity integration test를 필수로 둔다.
- parity가 달라지는 변경은 새 모델 버전, migration, fixture 갱신과 ADR 검토 없이는 병합하지 않는다.
- 저장 컬럼의 scale은 영속 형식일 뿐이다. 일 방문객을 반올림하기 전까지 DB 계산은 로컬 numeric 변수로 중간 정밀도를 유지한다.
- 영업시간은 정수 분, 시나리오 계수는 1,000분율, 테이크아웃 배수는 100분율 정수로 표현한다. 일 방문객은 이 값들의 정확한 유리수 곱에서 한 번만 반올림해 JavaScript 이진 부동소수점과 PostgreSQL `numeric`의 `.5` 경계 차이를 제거한다.

## 결과

저장 transaction과 RLS를 유지하면서 DB 저장 계산의 중복을 제거한다. 브라우저와 DB는 서로 다른 런타임 구현을 가지지만 자동 parity 검사가 모델 계약의 동일성을 강제한다. 네트워크 요청 없이 실시간 미리보기를 제공할 수 있고, DB 직접 호출에서도 파생값을 조작할 수 없다.
