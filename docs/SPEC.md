# Cafe Scout MVP Spec

## 1. 문서 목적

이 문서는 [cafe_scout_mvp_prd.md](./cafe_scout_mvp_prd.md)를 실제 구현 단위로 내린 명세서다.

목표는 다음 두 가지다.

1. 사용자가 3~5분 안에 카페 현장 관찰을 기록할 수 있게 한다.
2. 입력한 가격, 좌석, 점유, 체류시간, 운영시간을 바탕으로 예상 일/월 매출을 즉시 보여준다.

이 문서는 화면 요구사항, 데이터 모델, 계산 규칙, 검증 규칙, MVP 범위를 확정한다.

## 2. 제품 정의

### 2.1 핵심 사용자

- 카페 창업 준비자
- 경쟁 매장을 벤치마킹하는 기존 카페 운영자
- 외부 미팅이나 현장 답사 중 빠르게 기록해야 하는 사용자

### 2.2 핵심 가치

- 예쁜 카페 기록이 아니라 "잘되는 카페의 구조를 숫자로 기록"한다.
- 직접 본 관찰값, 사용자가 판단한 추정값, 시스템 계산값을 명확히 구분한다.
- 계산은 단순하지만 일관되어야 하며, 사용자가 이해할 수 있어야 한다.

### 2.3 제품 단위

MVP의 핵심 단위는 `CafeVisit`이다.

- `Cafe`: 실제 매장
- `CafeVisit`: 특정 시각에 해당 매장을 관찰한 1회 기록
- 동일 카페에 여러 번 방문할 수 있다.
- 상세/비교 화면은 기본적으로 "방문 기록" 단위로 동작한다.
- 새 방문은 기존 `Cafe`를 명시적으로 선택하거나 새 `Cafe`를 생성해 연결한다.
- 이름/지역 문자열만으로 기존 `Cafe`를 자동 병합하지 않는다.

### 2.4 기본 가정

- MVP는 단일 사용자 기준으로 동작한다.
- 권한/팀 협업 기능은 없다.
- 통화는 KRW만 지원한다.
- 시간대는 `Asia/Seoul` 기준으로 표시한다.
- 메뉴판 OCR, 지도 연동, 카드매출 연동은 하지 않는다.
- 매출 계산은 실제 재무가 아니라 현장 관찰 기반 추정 모델이다.

## 3. 릴리즈 범위

### 3.1 P0

- 카페 방문 기록 생성/수정/삭제/조회
- 메뉴판 사진 저장
- 대표 메뉴와 가격 입력
- 예상 객단가 입력
- 좌석/고객/점유율/체류시간 입력
- 운영시간, 월 영업일, 테이크아웃 관찰 입력
- 즉시 매출 추정 계산
- 상세 화면의 사업성 스냅샷
- 비교 화면에서 최대 3개 방문 기록 비교

### 3.2 P1

- 같은 방문 기록 안에서 시간대별 추가 관찰값 저장
- 시간대 구간별 평균 점유율 집계

### 3.3 이번 MVP 제외

- OCR 기반 메뉴 추출
- 네이버 지도/지도 SDK 연동
- 실제 카드매출/유동인구/임대료/원가 연동
- 손익분기점 계산
- AI 요약/추천
- 공개 회원 가입, 초대 관리, 프로필, 역할 관리

공개 배포의 익명 접근을 막기 위한 사전 생성 운영자 계정의 로그인/로그아웃은 보안 기반 기능으로 P0에 포함한다.

## 4. 정보 구조

MVP 화면은 아래 4개로 구성한다.

1. 방문 기록 리스트
2. 방문 기록 작성/수정
3. 방문 기록 상세
4. 방문 기록 비교

위 4개는 제품 화면 기준이다. 공개 배포 보안을 위한 최소 로그인 화면은 별도 기반 화면으로 제공한다.

## 5. 사용자 플로우

1. 사용자는 방문 기록 리스트에서 `새 기록`을 누른다.
2. 작성 화면에서 기본 정보, 메뉴/가격, 좌석/고객, 운영 정보, 평가를 한 화면에서 입력한다.
3. 계산에 필요한 최소 입력값이 채워지면 예상 점유율/매출이 즉시 갱신된다.
4. 저장 후 상세 화면에서 사업성 스냅샷과 관찰 메모를 본다.
5. 리스트에서 여러 기록을 선택해 비교 화면으로 이동한다.

## 6. 화면별 기능 명세

### 6.1 방문 기록 리스트

목적: 저장된 기록을 빠르게 훑고 비교 대상을 고른다.

필수 요소:

- `새 기록` CTA
- 방문 기록 카드 리스트
- 카드 표시 항목
  - 카페명
  - 지역
  - 방문 일시
  - 대표 사진 썸네일 1장
  - 기준 예상 일매출
  - 신뢰도
  - 주요 평점 요약: 전체 평점을 우선 표시하고, 없으면 공간/메뉴 평점을 표시
- 다중 선택 체크박스
- `비교하기` CTA

동작 규칙:

- 기본 정렬은 `visitedAt desc`
- 비교는 2~3개 선택 시 활성화한다.
- 같은 카페의 다른 방문 기록도 동시에 비교할 수 있다.

### 6.2 방문 기록 작성/수정

목적: 3~5분 내 입력 완료가 가능한 단일 스크롤 폼을 제공한다.

섹션 구성:

1. 기본 정보
2. 메뉴 / 가격
3. 좌석 / 고객
4. 운영 / 테이크아웃
5. 분위기 / 평가 / 메모
6. 예상 매출 요약

#### 6.2.1 기본 정보

| 필드                       | 타입     | 필수        | 규칙                         |
| -------------------------- | -------- | ----------- | ---------------------------- |
| cafeSelectionMode          | enum     | Y           | `EXISTING`, `NEW`            |
| cafeId                     | uuid     | Conditional | 기존 Cafe 선택 시 필수       |
| cafeName                   | string   | Conditional | 새 Cafe 생성 시 필수, 1~60자 |
| region                     | string   | Conditional | 새 Cafe 생성 시 필수, 1~60자 |
| visitedAt                  | datetime | Y           | 기본값 현재 시각             |
| observationDurationMinutes | integer  | N           | 1~180, 신뢰도 계산에만 사용  |
| generalPhotos              | image[]  | N           | 최대 10장                    |
| moodTags                   | string[] | N           | 최대 5개                     |
| customerTypes              | string[] | N           | 최대 3개                     |
| visitPurposes              | string[] | N           | 최대 3개                     |

초기 태그 세트:

- 분위기: `감성`, `대화`, `데이트`, `작업`, `조용함`, `오픈형`, `테이크아웃`, `디저트 강점`
- 고객 유형: `혼자`, `커플`, `친구`, `가족`, `직장인`, `학생`, `관광객`
- 방문 목적: `작업`, `대화`, `휴식`, `사진`, `디저트`, `테이크아웃`

Cafe 연결 규칙:

- `EXISTING`이면 `cafeId`만 신뢰하고 카페명/지역은 서버에서 조회한다.
- `NEW`이면 `cafeName`과 `region`으로 새 Cafe를 생성한다.
- 두 모드의 입력을 동시에 받지 않는다.
- 기존 Cafe 선택 시 최근 방문의 영업시간을 기본값으로 채우되 사용자가 이번 방문 값으로 수정할 수 있다.

#### 6.2.2 메뉴 / 가격

| 필드                              | 타입     | 필수                 | 규칙                                                         |
| --------------------------------- | -------- | -------------------- | ------------------------------------------------------------ |
| menuBoardPhotos                   | image[]  | N                    | 최대 3장                                                     |
| representativeMenus               | object[] | N                    | 0~10개                                                       |
| representativeMenus[].name        | string   | Y when item exists   | 1~40자                                                       |
| representativeMenus[].category    | enum     | Y when item exists   | `COFFEE`, `NON_COFFEE`, `DESSERT`, `BAKERY`, `BRUNCH`, `ETC` |
| representativeMenus[].price       | integer  | Y when item exists   | 0~100000                                                     |
| representativeMenus[].isSignature | boolean  | N                    | 기본 `false`                                                 |
| priceLevel                        | enum     | N                    | `CHEAP`, `NORMAL`, `HIGH`, `VERY_HIGH`                       |
| estimatedAverageSpend             | integer  | Y for sales estimate | 1000~100000                                                  |

입력 규칙:

- 메뉴판 사진과 대표 메뉴 입력은 둘 다 허용한다.
- 대표 메뉴는 3~5개 입력을 권장하지만 저장 상한은 10개로 둔다.
- `estimatedAverageSpend`는 대표 메뉴 가격과 별개로 별도 입력한다.
- 메뉴 섹션이 비어 있어도 저장은 가능하지만, `estimatedAverageSpend`가 없으면 매출 계산은 비활성화한다.

#### 6.2.3 좌석 / 고객

| 필드               | 타입            | 필수                 | 규칙                                                                    |
| ------------------ | --------------- | -------------------- | ----------------------------------------------------------------------- |
| tableCount         | integer         | N                    | 0~100                                                                   |
| seatCount          | integer         | Y for sales estimate | 1~300                                                                   |
| currentCustomers   | integer         | Conditional          | 0~500                                                                   |
| occupancyRate      | integer percent | Conditional          | 0~100                                                                   |
| occupancyInputMode | enum            | Y when value exists  | `CUSTOMERS`, `RATE`                                                     |
| averageStayPreset  | enum            | Y for sales estimate | `UNDER_30M`, `ONE_HOUR`, `ONE_HALF_HOUR`, `TWO_HOURS`, `OVER_TWO_HOURS` |
| averageStayMinutes | integer         | derived              | preset에 따라 계산                                                      |

입력 규칙:

- `currentCustomers` 또는 `occupancyRate` 둘 중 하나는 있어야 매출 계산이 가능하다.
- `currentCustomers`와 `seatCount`가 있으면 `occupancyRate`는 자동 계산한다.
- 둘 다 입력되면 `currentCustomers` 기반 계산값을 우선하고, 수동 `occupancyRate`는 덮어쓴다.
- 고객 수로 계산한 점유율은 `min(100, round(currentCustomers / seatCount * 100))`으로 저장한다.
- `currentCustomers > seatCount`이면 고객 수는 원본대로 보존하고 UI에는 점유율 `100%+`로 표시하되 매출 계산에는 100%를 사용한다.
- 체류시간은 아래 값으로 매핑한다.
  - `UNDER_30M` = 30
  - `ONE_HOUR` = 60
  - `ONE_HALF_HOUR` = 90
  - `TWO_HOURS` = 120
  - `OVER_TWO_HOURS` = 150

#### 6.2.4 운영 / 테이크아웃

| 필드                  | 타입    | 필수                 | 규칙                            |
| --------------------- | ------- | -------------------- | ------------------------------- |
| openTime              | time    | Y for sales estimate | `HH:mm`                         |
| closeTime             | time    | Y for sales estimate | `HH:mm`                         |
| operatingHours        | decimal | derived              | open/close로 계산               |
| operatingDaysPerMonth | integer | Y                    | 기본값 30, 범위 1~31            |
| takeoutLevel          | enum    | N                    | `NONE`, `LOW`, `MEDIUM`, `HIGH` |
| observedTakeoutOrders | integer | N                    | 15분 기준 0~50                  |

입력 규칙:

- `closeTime < openTime`이면 자정을 넘긴 영업으로 간주한다.
- `openTime`과 `closeTime`은 둘 다 비우거나 둘 다 입력해야 한다.
- `openTime === closeTime`은 24시간 영업이 아니라 유효하지 않은 입력으로 처리한다.
- `operatingHours`는 0보다 커야 하며 18시간을 넘기면 오류 처리한다.
- `observedTakeoutOrders`가 있으면 `takeoutLevel`보다 우선한다.
- 영업시간은 매출 재현을 위해 방문 snapshot마다 저장한다. 기존 Cafe의 최근 값을 기본으로 제안하되 과거 방문 값은 변경하지 않는다.

#### 6.2.5 분위기 / 평가 / 메모

| 필드            | 타입    | 필수 | 규칙    |
| --------------- | ------- | ---- | ------- |
| spaceRating     | integer | N    | 1~5     |
| menuRating      | integer | N    | 1~5     |
| locationRating  | integer | N    | 1~5     |
| overallRating   | integer | N    | 1~5     |
| strengths       | text    | N    | 0~500자 |
| adoptablePoints | text    | N    | 0~500자 |

#### 6.2.6 예상 매출 요약 패널

작성 화면 하단에 실시간 계산 패널을 고정 표시한다.

표시 항목:

- 좌석 점유율
- 시간당 좌석 회전율
- 시간당 예상 고객
- 예상 일 방문객: 보수 / 기준 / 활황
- 예상 일매출: 보수 / 기준 / 활황
- 예상 월매출: 보수 / 기준 / 활황
- 신뢰도

계산 불가 시 동작:

- 누락 필드를 나열한다.
- 저장은 가능하되 `추정 불가` 상태를 표시한다.

### 6.3 방문 기록 상세

상단에 `BUSINESS SNAPSHOT` 블록을 둔다.

표시 항목:

- 좌석 수
- 예상 객단가
- 점유율(관찰 기반)
- 평균 체류시간
- 예상 일매출 범위
- 기준 예상 일매출
- 예상 월매출
- 신뢰도

그 아래에 아래 블록을 순서대로 노출한다.

1. 공간
2. 메뉴
3. 고객
4. 사진
5. 잘한 점
6. 가져오고 싶은 점

배지 규칙:

- 현장에서 직접 확인해 입력한 값은 `관찰`
- 사용자가 관찰을 바탕으로 판단한 값은 `사용자 추정`
- 수식으로 파생한 값은 `시스템 계산`
- 점유율 직접 입력은 `관찰`, 고객 수에서 계산한 점유율은 `시스템 계산`으로 표시한다.

### 6.4 방문 기록 비교

비교 대상은 최대 3개다.

표시 행:

- 좌석
- 객단가
- 점유율
- 체류시간
- 일매출 추정
- 월매출 추정
- 공간 평점
- 메뉴 평점

동작 규칙:

- 각 열은 하나의 `CafeVisit`
- 수치 없는 칸은 `-`로 표시
- 일매출/월매출은 기준값을 우선 표시하고 hover/secondary text로 범위를 보여줄 수 있다.

## 7. 매출 추정 규칙

### 7.1 값의 출처 구분

관찰값:

- 좌석 수
- 현재 고객 수
- 점유율 직접 입력값
- 대표 메뉴 가격
- 영업시간
- 테이크아웃 주문 관찰값

사용자 추정값:

- 예상 객단가
- 체류시간 선택값
- 가격 수준
- 테이크아웃 수준

시스템 계산값:

- 고객 수에서 계산한 점유율
- 영업시간에서 계산한 운영시간
- 시간당 예상 고객 수
- 예상 일 방문객
- 예상 일매출
- 예상 월매출
- 신뢰도

### 7.2 계산 최소 조건

아래 값이 있어야 매출 계산을 실행한다.

- `seatCount`
- `currentCustomers` 또는 `occupancyRate`
- `averageStayMinutes`
- `estimatedAverageSpend`
- `openTime`
- `closeTime`
- `operatingDaysPerMonth`

입력 존재 여부는 `null`/`undefined`로 판정한다. `currentCustomers = 0`, `occupancyRate = 0`, `observedTakeoutOrders = 0`, `takeoutLevel = NONE`은 모두 유효한 명시적 입력이다.

### 7.3 파생 값 계산

```text
occupancyRate =
  if currentCustomers exists:
    min(100, round(currentCustomers / seatCount * 100))
  else:
    user-input occupancyRate

operatingHours =
  difference between openTime and closeTime in hours

estimatedSeatTurnsPerHour =
  60 / averageStayMinutes

estimatedCustomersPerHour =
  seatCount * (occupancyRate / 100) * estimatedSeatTurnsPerHour
```

- `estimatedSeatTurnsPerHour`, `estimatedCustomersPerHour`, `potentialDailySeatedCustomers`는 중간 계산에서 반올림하지 않는다.
- 시간당 고객 UI는 소수점 한 자리까지 표시할 수 있다.
- 정수 반올림은 시나리오별 `dailyCustomersScenario`에서만 수행한다.
- 시나리오 계수와 테이크아웃 계수는 각각 1,000분율과 100분율 정수로 환산하고, 영업시간은 분 단위 정수로 계산한다. 최종 고객 수는 이 정수들의 유리수 곱을 한 번만 반올림하여 JavaScript와 PostgreSQL의 정확한 `.5` 경계 결과를 일치시킨다.

### 7.4 일 방문객 추정

현재 관찰 점유율이 하루 종일 유지된다고 가정하지 않기 위해 고정 보정 계수를 둔다.

```text
potentialDailySeatedCustomers =
  estimatedCustomersPerHour * operatingHours

scenarioCorrectionFactor:
  LOW  = 0.417
  BASE = 0.583
  HIGH = 0.764
```

이 값은 PRD의 예시 입력에서 `약 90만 / 126만 / 165만` 범위가 재현되도록 고정한다.

### 7.5 테이크아웃 보정

테이크아웃은 좌석 기반 매출 왜곡을 줄이기 위한 가산 계수로 반영한다.

우선순위:

1. `observedTakeoutOrders`가 있으면 주문 수 기반 매핑 사용
2. 없으면 `takeoutLevel` 매핑 사용
3. 둘 다 없으면 0으로 처리

매핑:

| 입력                      | 가산 계수 |
| ------------------------- | --------- |
| observedTakeoutOrders 0~1 | 0.00      |
| observedTakeoutOrders 2~3 | 0.05      |
| observedTakeoutOrders 4~6 | 0.10      |
| observedTakeoutOrders 7~9 | 0.18      |
| observedTakeoutOrders 10+ | 0.25      |
| takeoutLevel NONE         | 0.00      |
| takeoutLevel LOW          | 0.05      |
| takeoutLevel MEDIUM       | 0.12      |
| takeoutLevel HIGH         | 0.20      |

### 7.6 최종 일/월 매출 계산

```text
dailyCustomersScenario =
  round(potentialDailySeatedCustomers
    * scenarioCorrectionFactor
    * (1 + takeoutAdjustmentRate))

dailySalesScenario =
  dailyCustomersScenario * estimatedAverageSpend

monthlySalesScenario =
  dailySalesScenario * operatingDaysPerMonth
```

저장 규칙:

- 원본 값은 정수 KRW로 저장한다.
- UI 표시는 만원 단위 반올림을 허용한다.
- `estimationModelVersion = "mvp-v1"`를 함께 저장한다.

### 7.7 PRD 예시 검증값

입력:

- 좌석 40
- 점유율 75%
- 체류시간 90분
- 영업시간 12시간
- 객단가 9000원
- 테이크아웃 보정 없음

기대값:

```text
estimatedCustomersPerHour = 20
dailyCustomersLow  ~= 100
dailyCustomersBase ~= 140
dailyCustomersHigh ~= 183

dailySalesLow  ~= 900000
dailySalesBase ~= 1260000
dailySalesHigh ~= 1647000
```

## 8. 신뢰도 계산

신뢰도는 자동 계산만 가능하며 수동 수정하지 않는다.

점수 규칙:

| 조건                                         | 점수 |
| -------------------------------------------- | ---- |
| seatCount 입력                               | 20   |
| currentCustomers 또는 occupancyRate 입력     | 20   |
| estimatedAverageSpend 입력                   | 20   |
| averageStayMinutes 입력                      | 15   |
| openTime/closeTime 입력                      | 10   |
| takeoutLevel 또는 observedTakeoutOrders 입력 | 5    |
| observationDurationMinutes 10분 이상         | 5    |
| observationDurationMinutes 30분 이상         | 5    |

관찰 시간이 30분 이상이면 10분 이상 점수와 30분 이상 점수를 누적해 10점을 부여한다. `NONE`과 관찰 주문 0도 명시적으로 입력한 값이므로 테이크아웃 입력 점수를 부여한다.

레벨 매핑:

- `LOW`: 0~39
- `MEDIUM`: 40~69
- `HIGH`: 70~100

표시 규칙:

- `LOW` = `●○○`
- `MEDIUM` = `●●○`
- `HIGH` = `●●●`

## 9. 데이터 모델

ADR-0001에 따라 Supabase Postgres에 아래 논리 모델을 구현한다.

### 9.1 Cafe

| 필드      | 타입     | 설명                     |
| --------- | -------- | ------------------------ |
| id        | uuid     | PK                       |
| ownerId   | uuid     | 소유자, FK -> auth.users |
| name      | string   | 카페명                   |
| region    | string   | 지역                     |
| createdAt | datetime | 생성 시각                |
| updatedAt | datetime | 수정 시각                |

### 9.2 CafeVisit

| 필드                       | 타입             | 설명                     |
| -------------------------- | ---------------- | ------------------------ |
| id                         | uuid             | PK                       |
| ownerId                    | uuid             | 소유자, FK -> auth.users |
| cafeId                     | uuid             | FK -> Cafe               |
| visitedAt                  | datetime         | 방문/관찰 시각           |
| observationDurationMinutes | integer nullable | 관찰 시간                |
| moodTags                   | string[]         | 분위기 태그              |
| customerTypes              | string[]         | 고객 유형 태그           |
| visitPurposes              | string[]         | 방문 목적 태그           |
| spaceRating                | integer nullable | 1~5                      |
| menuRating                 | integer nullable | 1~5                      |
| locationRating             | integer nullable | 1~5                      |
| overallRating              | integer nullable | 1~5                      |
| strengths                  | text nullable    | 잘한 점                  |
| adoptablePoints            | text nullable    | 가져오고 싶은 점         |
| createdAt                  | datetime         | 생성 시각                |
| updatedAt                  | datetime         | 수정 시각                |

### 9.3 CafePhoto

| 필드        | 타입             | 설명                           |
| ----------- | ---------------- | ------------------------------ |
| id          | uuid             | PK                             |
| ownerId     | uuid             | 소유자, FK -> auth.users       |
| cafeVisitId | uuid             | FK -> CafeVisit                |
| kind        | enum             | `GENERAL`, `MENU_BOARD`        |
| bucket      | string           | private Storage bucket         |
| objectPath  | string           | Storage object 경로            |
| mimeType    | string           | 검증된 MIME type               |
| sizeBytes   | integer          | 업로드된 파일 크기             |
| width       | integer nullable | 클라이언트 처리 후 이미지 너비 |
| height      | integer nullable | 클라이언트 처리 후 이미지 높이 |
| sortOrder   | integer          | 정렬 순서                      |
| createdAt   | datetime         | 생성 시각                      |

### 9.4 CafeMenu

| 필드        | 타입    | 설명                     |
| ----------- | ------- | ------------------------ |
| id          | uuid    | PK                       |
| ownerId     | uuid    | 소유자, FK -> auth.users |
| cafeVisitId | uuid    | FK -> CafeVisit          |
| name        | string  | 메뉴명                   |
| category    | enum    | 메뉴 카테고리            |
| price       | integer | KRW                      |
| isSignature | boolean | 시그니처 여부            |
| sortOrder   | integer | 입력 순서                |

### 9.5 CafeBusinessSnapshot

| 필드                        | 타입             | 설명                                    |
| --------------------------- | ---------------- | --------------------------------------- |
| id                          | uuid             | PK                                      |
| ownerId                     | uuid             | 소유자, FK -> auth.users                |
| cafeVisitId                 | uuid             | FK -> CafeVisit                         |
| priceLevel                  | enum nullable    | 가격 수준                               |
| tableCount                  | integer nullable | 테이블 수                               |
| seatCount                   | integer nullable | 좌석 수                                 |
| currentCustomers            | integer nullable | 현재 고객 수                            |
| occupancyRate               | integer nullable | 매출 계산에 사용하는 유효 점유율(0~100) |
| occupancyInputMode          | enum nullable    | `CUSTOMERS`, `RATE`                     |
| averageStayMinutes          | integer nullable | 평균 체류시간                           |
| estimatedAverageSpend       | integer nullable | 예상 객단가                             |
| takeoutLevel                | enum nullable    | 테이크아웃 수준                         |
| observedTakeoutOrders       | integer nullable | 15분 기준 관찰 주문                     |
| takeoutAdjustmentRate       | decimal nullable | 계산에 사용된 가산 계수                 |
| openTime                    | string nullable  | `HH:mm`                                 |
| closeTime                   | string nullable  | `HH:mm`                                 |
| operatingHours              | decimal nullable | 일 영업시간                             |
| operatingDaysPerMonth       | integer          | 월 영업일                               |
| estimatedSeatTurnsPerHour   | decimal nullable | 반올림하지 않은 시간당 좌석 회전율      |
| estimatedCustomersPerHour   | decimal nullable | 반올림하지 않은 시간당 예상 고객        |
| estimatedDailyCustomersLow  | integer nullable | 보수 시나리오                           |
| estimatedDailyCustomersBase | integer nullable | 기준 시나리오                           |
| estimatedDailyCustomersHigh | integer nullable | 활황 시나리오                           |
| estimatedDailySalesLow      | integer nullable | 보수 시나리오                           |
| estimatedDailySalesBase     | integer nullable | 기준 시나리오                           |
| estimatedDailySalesHigh     | integer nullable | 활황 시나리오                           |
| estimatedMonthlySalesLow    | integer nullable | 보수 시나리오                           |
| estimatedMonthlySalesBase   | integer nullable | 기준 시나리오                           |
| estimatedMonthlySalesHigh   | integer nullable | 활황 시나리오                           |
| confidenceScore             | integer nullable | 0~100                                   |
| confidenceLevel             | enum nullable    | `LOW`, `MEDIUM`, `HIGH`                 |
| estimationModelVersion      | string           | 기본값 `mvp-v1`                         |
| createdAt                   | datetime         | 생성 시각                               |
| updatedAt                   | datetime         | 수정 시각                               |

### 9.6 VisitOccupancyObservation

P1 모델이며 시간대 구간과 기존 매출 모델과의 관계는 [ADR-0002](./adr/0002-p1-occupancy-observations.md)를 따른다.

| 필드             | 타입             | 설명                                      |
| ---------------- | ---------------- | ----------------------------------------- |
| id               | uuid             | PK                                        |
| ownerId          | uuid             | 소유자, FK -> auth.users                  |
| cafeVisitId      | uuid             | FK -> CafeVisit                           |
| observedAt       | datetime         | 추가 관찰 시각                            |
| currentCustomers | integer nullable | 관찰 고객 수                              |
| occupancyRate    | integer nullable | 직접 입력하거나 고객 수에서 계산한 점유율 |

`currentCustomers`와 `occupancyRate` 중 하나 이상은 있어야 한다.

### 9.7 관계와 소유권 불변식

- 모든 사용자 데이터는 `ownerId`가 필수이며 생성 후 변경할 수 없다.
- `CafeVisit(cafeId, ownerId)`는 동일 소유자의 `Cafe(id, ownerId)`만 참조한다.
- 사진, 메뉴, snapshot, 추가 관찰의 `(cafeVisitId, ownerId)`는 동일 소유자의 방문만 참조한다.
- 위 규칙은 `(id, ownerId)` unique key와 복합 FK 또는 동등한 DB 제약으로 강제한다.
- 방문당 `CafeBusinessSnapshot`은 최대 하나다.
- Cafe 이름/지역에는 자동 병합용 unique 제약을 두지 않는다.
- 목록의 대표 사진은 가장 낮은 `sortOrder`의 `GENERAL` 사진이며, 없으면 첫 `MENU_BOARD` 사진을 사용한다.

## 10. 서비스/모듈 경계

구현은 프론트엔드/백엔드 스택과 무관하게 아래 책임 분리를 유지한다.

1. `visit-form`
   - 입력값 상태 관리
   - 검증
   - 실시간 계산 트리거
2. `business-estimator`
   - 점유율, 시간당 좌석 회전율/고객, 일/월 매출, 신뢰도 계산
   - 순수 함수로 작성
   - 저장 시 서버에서 한 번 더 재계산
3. `visit-repository`
   - 카페/방문/메뉴/사진/스냅샷 CRUD
4. `compare-query`
   - 선택된 방문 기록의 비교용 정규화 데이터 반환

## 11. 검증 규칙과 UX 디테일

- 저장은 명시적 `저장` CTA로만 수행한다.
- 저장 전 폼 이탈 시 브라우저 수준의 unsaved warning을 둔다.
- 숫자 입력은 모두 천 단위 구분 없이 저장하고, UI에서만 포맷팅한다.
- 사진 업로드는 최소 `jpg`, `png`, `webp`를 지원한다.
- 신규 저장은 서버가 먼저 Cafe/Visit/메뉴/snapshot을 transaction으로 저장한 뒤 확정된 방문 ID로 사진 업로드 URL을 발급하는 2단계 흐름으로 처리한다.
- 사진 업로드가 실패해도 방문 기록 저장은 유지하고 `기록 저장됨 · 사진 업로드 미완료` 상태에서 재시도할 수 있게 한다.
- Storage 업로드 후 사진 metadata 저장이 실패하면 해당 object를 보상 삭제한다.
- 수정에서 사진을 제거할 때 object path를 확보한 뒤 DB metadata를 삭제하고 Storage object 삭제를 시도한다. Storage 삭제 실패는 고아 object 정리 절차에서 재시도한다.
- 상세 화면에 방문 삭제 CTA를 제공한다. 명시적 확인 뒤 DB 레코드를 삭제하고 Storage object 삭제를 시도하며, 실패한 object는 고아 파일 정리 절차에서 재시도한다.
- 방문 삭제 후 연결된 방문이 하나도 없는 Cafe는 같은 DB transaction에서 삭제한다. 다른 방문이 남아 있으면 Cafe를 유지한다.
- 사용자별 비공개 페이지와 조회는 동적으로 처리하며 정적 생성 또는 공유 캐시에 저장하지 않는다.
- 생성/수정/삭제 후 관련 리스트·상세·비교 데이터를 무효화한다.
- 비교 화면은 모바일에서도 가로 스크롤 가능해야 한다.
- 작성 화면은 태블릿 폭에서 한 화면 내 주요 입력과 예상 매출 패널이 함께 보여야 한다.

## 12. 테스트 요구사항

### 12.1 단위 테스트

- `business-estimator`는 PRD 예시 입력을 기준으로 기대값 범위를 재현해야 한다.
- `currentCustomers` 입력 시 점유율 자동 계산이 맞아야 한다.
- `currentCustomers > seatCount`이면 원본 고객 수를 보존하고 계산 점유율을 100%로 제한해야 한다.
- 소수인 시간당 예상 고객은 일 방문객 계산 전까지 반올림하지 않아야 한다.
- 자정 넘김 영업시간 계산이 맞아야 한다.
- 테이크아웃 관찰값이 `takeoutLevel`보다 우선해야 한다.

### 12.2 통합 테스트

- 방문 기록 저장 후 상세 화면에 동일 값이 반영되어야 한다.
- 비교 화면에서 선택한 2~3개 방문 기록이 같은 순서로 렌더링되어야 한다.
- 계산 최소 조건이 충족되지 않으면 `추정 불가` 상태가 보여야 한다.
- 부모/자식의 `ownerId`가 다르면 DB 제약과 RLS가 저장을 거부해야 한다.
- 신규 기록의 사진 업로드 실패 후 저장된 기록을 유지한 채 재시도할 수 있어야 한다.

## 13. 구현 순서 권장안

1. 데이터 모델과 `business-estimator` 순수 함수 구현
2. 방문 기록 작성/수정 화면 구현
3. 상세 화면의 사업성 스냅샷 구현
4. 리스트/비교 화면 구현
5. P1 시간대 관찰 모델 추가

## 14. 확정된 구현 결정

1. 리스트, 상세, 비교의 기본 단위는 `CafeVisit`이다.
2. 사진은 Supabase Storage private bucket에 저장하고 DB에는 bucket/object path만 저장한다.
3. 기존 Cafe 연결과 새 Cafe 생성을 명시적으로 구분하며 이름/지역으로 자동 병합하지 않는다.
4. 영업시간은 기존 Cafe의 최근 방문값을 기본으로 제안하되 계산 재현을 위해 방문 snapshot마다 저장한다.
5. P0는 방문 기록 삭제와 관련 사진 정리를 포함한다.
6. P1 시간대별 추가 관찰은 P0 출시 조건에 포함하지 않는다.

위 결정까지 포함하면 본 문서는 P0 구현을 시작하기 위한 기준 문서다.
