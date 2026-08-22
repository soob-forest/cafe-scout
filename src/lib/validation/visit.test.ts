import { describe, expect, it } from "vitest";
import { normalizeVisitInput, visitFieldErrors, visitInputSchema } from "./visit";
import type { VisitInput } from "@/domain/types";

const valid: VisitInput = {
  cafeSelectionMode: "NEW",
  cafeId: null,
  cafeName: " 테스트 카페 ",
  region: " 성수 ",
  visitedAt: "2026-08-17T06:00:00.000Z",
  observationDurationMinutes: 30,
  moodTags: ["감성"],
  customerTypes: ["직장인"],
  visitPurposes: ["작업"],
  spaceRating: 4,
  menuRating: 4,
  locationRating: 5,
  overallRating: 4,
  strengths: "좋은 동선",
  adoptablePoints: null,
  representativeMenus: [
    { name: "아메리카노", category: "COFFEE", price: 5_500, isSignature: false, sortOrder: 0 },
  ],
  priceLevel: "NORMAL",
  tableCount: 10,
  seatCount: 24,
  currentCustomers: 18,
  occupancyRate: 50,
  occupancyInputMode: "CUSTOMERS",
  averageStayPreset: "ONE_HALF_HOUR",
  estimatedAverageSpend: 9_000,
  takeoutLevel: "LOW",
  observedTakeoutOrders: 0,
  openTime: "10:00",
  closeTime: "22:00",
  operatingDaysPerMonth: 30,
};

describe("visit schema", () => {
  it("normalizes conditional fields and derived values", () => {
    const result = normalizeVisitInput(valid);
    expect(result.cafeName).toBe("테스트 카페");
    expect(result.region).toBe("성수");
    expect(result.occupancyRate).toBeNull();
    expect(result.occupancyInputMode).toBe("CUSTOMERS");
    expect(result.averageStayMinutes).toBe(90);
    expect(result.observedTakeoutOrders).toBe(0);
  });

  it("requires an existing cafe id", () => {
    const result = visitInputSchema.safeParse({ ...valid, cafeSelectionMode: "EXISTING", cafeId: null });
    expect(result.success).toBe(false);
  });

  it("rejects invalid hours and out-of-range values", () => {
    expect(visitInputSchema.safeParse({ ...valid, openTime: "06:00", closeTime: "01:00" }).success).toBe(
      false,
    );
    expect(visitInputSchema.safeParse({ ...valid, seatCount: 301 }).success).toBe(false);
    expect(
      visitInputSchema.safeParse({
        ...valid,
        moodTags: ["감성", "대화", "데이트", "작업", "조용함", "오픈형"],
      }).success,
    ).toBe(false);
  });

  it.each([
    [{ openTime: "10:00", closeTime: null }, "closeTime"],
    [{ openTime: null, closeTime: "22:00" }, "openTime"],
  ] as const)("requires open and close times as a pair", (hours, expectedPath) => {
    const result = visitInputSchema.safeParse({ ...valid, ...hours });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual([expectedPath]);
  });

  it("deduplicates tags before enforcing their limits", () => {
    const result = normalizeVisitInput({ ...valid, moodTags: ["감성", "감성", "대화", "대화"] });
    expect(result.moodTags).toEqual(["감성", "대화"]);
  });

  it("normalizes menu order instead of trusting client sort indexes", () => {
    const result = normalizeVisitInput({
      ...valid,
      representativeMenus: [
        { name: "A", category: "COFFEE", price: 0, isSignature: false, sortOrder: 9 },
        { name: "B", category: "ETC", price: 100_000, isSignature: true, sortOrder: 9 },
      ],
    });
    expect(result.representativeMenus.map((menu) => menu.sortOrder)).toEqual([0, 1]);
  });

  it.each([
    ["observationDurationMinutes", 0],
    ["observationDurationMinutes", 181],
    ["tableCount", -1],
    ["tableCount", 101],
    ["currentCustomers", -1],
    ["currentCustomers", 501],
    ["occupancyRate", -1],
    ["occupancyRate", 101],
    ["estimatedAverageSpend", 999],
    ["estimatedAverageSpend", 100_001],
    ["observedTakeoutOrders", 51],
    ["operatingDaysPerMonth", 32],
  ])("rejects %s boundary value %s", (key, value) => {
    expect(visitInputSchema.safeParse({ ...valid, [key]: value }).success).toBe(false);
  });

  it("rejects invalid tag values, too many menus, and overlong text", () => {
    expect(visitInputSchema.safeParse({ ...valid, moodTags: ["알 수 없음"] }).success).toBe(false);
    expect(
      visitInputSchema.safeParse({
        ...valid,
        representativeMenus: Array.from({ length: 11 }, (_, sortOrder) => ({
          name: "메뉴",
          category: "COFFEE",
          price: 1000,
          isSignature: false,
          sortOrder,
        })),
      }).success,
    ).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, strengths: "가".repeat(501) }).success).toBe(false);
    expect(
      visitInputSchema.safeParse({
        ...valid,
        representativeMenus: [
          { name: "", category: "COFFEE", price: 1000, isSignature: false, sortOrder: 0 },
        ],
      }).success,
    ).toBe(false);
  });

  it("maps generic schema failures to field-specific Korean messages", () => {
    const result = visitInputSchema.safeParse({ ...valid, visitedAt: "", seatCount: 301 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(visitFieldErrors(result.error)).toMatchObject({
        visitedAt: ["방문 일시 입력값을 확인해 주세요."],
        seatCount: ["좌석 수 입력값을 확인해 주세요."],
      });
    }
  });
});
