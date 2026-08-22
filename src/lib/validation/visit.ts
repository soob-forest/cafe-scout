import { z } from "zod";
import {
  CUSTOMER_TYPES,
  MENU_CATEGORIES,
  MOOD_TAGS,
  OCCUPANCY_INPUT_MODES,
  PRICE_LEVELS,
  STAY_PRESETS,
  TAKEOUT_LEVELS,
  VISIT_PURPOSES,
  type VisitInput,
} from "@/domain/types";
import { calculateOperatingHours, STAY_MINUTES } from "@/domain/business-estimator";

const nullableInteger = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const nullableRating = nullableInteger(1, 5);
const nullableText = (max: number) => z.string().trim().max(max).nullable();
const uniqueEnumArray = <T extends readonly [string, ...string[]]>(values: T, max: number) =>
  z.preprocess(
    (input) => (Array.isArray(input) ? [...new Set(input)] : input),
    z.array(z.enum(values)).max(max),
  );

export const VISIT_FIELD_LABELS: Record<string, string> = {
  cafeId: "카페 선택",
  cafeName: "카페명",
  region: "지역",
  visitedAt: "방문 일시",
  observationDurationMinutes: "관찰 시간",
  moodTags: "분위기",
  customerTypes: "고객 유형",
  visitPurposes: "방문 목적",
  spaceRating: "공간 평가",
  menuRating: "메뉴 평가",
  locationRating: "입지 평가",
  overallRating: "전체 평가",
  strengths: "잘한 점",
  adoptablePoints: "가져오고 싶은 점",
  representativeMenus: "대표 메뉴",
  priceLevel: "가격 수준",
  tableCount: "테이블 수",
  seatCount: "좌석 수",
  currentCustomers: "현재 고객",
  occupancyRate: "현재 점유율",
  occupancyInputMode: "점유 입력 방식",
  averageStayPreset: "평균 체류시간",
  estimatedAverageSpend: "예상 객단가",
  takeoutLevel: "테이크아웃 수준",
  observedTakeoutOrders: "15분간 테이크아웃 주문",
  openTime: "오픈 시간",
  closeTime: "마감 시간",
  operatingDaysPerMonth: "월 영업일",
};

export function visitFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    const label = VISIT_FIELD_LABELS[key] ?? "입력값";
    const message = issue.code === "custom" ? issue.message : `${label} 입력값을 확인해 주세요.`;
    result[key] = [...(result[key] ?? []), message];
  }
  return result;
}

export const representativeMenuSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(40),
  category: z.enum(MENU_CATEGORIES),
  price: z.number().int().min(0).max(100_000),
  isSignature: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9),
});

export const visitInputSchema = z
  .object({
    cafeSelectionMode: z.enum(["EXISTING", "NEW"]),
    cafeId: z.string().uuid().nullable(),
    cafeName: nullableText(60),
    region: nullableText(60),
    visitedAt: z.string().datetime({ offset: true }),
    observationDurationMinutes: nullableInteger(1, 180),
    moodTags: uniqueEnumArray(MOOD_TAGS, 5),
    customerTypes: uniqueEnumArray(CUSTOMER_TYPES, 3),
    visitPurposes: uniqueEnumArray(VISIT_PURPOSES, 3),
    spaceRating: nullableRating,
    menuRating: nullableRating,
    locationRating: nullableRating,
    overallRating: nullableRating,
    strengths: nullableText(500),
    adoptablePoints: nullableText(500),
    representativeMenus: z.array(representativeMenuSchema).max(10),
    priceLevel: z.enum(PRICE_LEVELS).nullable(),
    tableCount: nullableInteger(0, 100),
    seatCount: nullableInteger(1, 300),
    currentCustomers: nullableInteger(0, 500),
    occupancyRate: nullableInteger(0, 100),
    occupancyInputMode: z.enum(OCCUPANCY_INPUT_MODES).nullable(),
    averageStayPreset: z.enum(STAY_PRESETS).nullable(),
    estimatedAverageSpend: nullableInteger(1_000, 100_000),
    takeoutLevel: z.enum(TAKEOUT_LEVELS).nullable(),
    observedTakeoutOrders: nullableInteger(0, 50),
    openTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    operatingDaysPerMonth: z.number().int().min(1).max(31),
  })
  .superRefine((input, context) => {
    if (input.cafeSelectionMode === "EXISTING" && !input.cafeId) {
      context.addIssue({ code: "custom", path: ["cafeId"], message: "기존 카페를 선택해 주세요." });
    }
    if (input.cafeSelectionMode === "NEW") {
      if (!input.cafeName)
        context.addIssue({ code: "custom", path: ["cafeName"], message: "카페명을 입력해 주세요." });
      if (!input.region)
        context.addIssue({ code: "custom", path: ["region"], message: "지역을 입력해 주세요." });
    }
    const hasOccupancy = input.currentCustomers !== null || input.occupancyRate !== null;
    if (hasOccupancy && !input.occupancyInputMode) {
      context.addIssue({
        code: "custom",
        path: ["occupancyInputMode"],
        message: "점유 입력 방식을 선택해 주세요.",
      });
    }
    if (Boolean(input.openTime) !== Boolean(input.closeTime)) {
      context.addIssue({
        code: "custom",
        path: [input.openTime ? "closeTime" : "openTime"],
        message: input.openTime ? "마감 시간도 입력해 주세요." : "오픈 시간도 입력해 주세요.",
      });
    }
    if (
      input.openTime &&
      input.closeTime &&
      calculateOperatingHours(input.openTime, input.closeTime) === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["closeTime"],
        message: "영업시간은 0시간 초과 18시간 이하여야 합니다.",
      });
    }
  });

export function normalizeVisitInput(input: VisitInput) {
  const parsed = visitInputSchema.parse(input);
  return {
    ...parsed,
    representativeMenus: parsed.representativeMenus.map((menu, sortOrder) => ({ ...menu, sortOrder })),
    cafeId: parsed.cafeSelectionMode === "EXISTING" ? parsed.cafeId : null,
    cafeName: parsed.cafeSelectionMode === "NEW" ? parsed.cafeName : null,
    region: parsed.cafeSelectionMode === "NEW" ? parsed.region : null,
    occupancyRate: parsed.currentCustomers !== null ? null : parsed.occupancyRate,
    occupancyInputMode:
      parsed.currentCustomers !== null
        ? ("CUSTOMERS" as const)
        : parsed.occupancyRate !== null
          ? ("RATE" as const)
          : null,
    averageStayMinutes: parsed.averageStayPreset ? STAY_MINUTES[parsed.averageStayPreset] : null,
  };
}
