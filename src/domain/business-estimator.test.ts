import { describe, expect, it } from "vitest";
import {
  calculateConfidence,
  calculateOperatingHours,
  calculateTakeoutAdjustment,
  confidenceLevelForScore,
  estimateBusiness,
} from "./business-estimator";
import type { BusinessEstimatorInput } from "./types";

const baseInput: BusinessEstimatorInput = {
  seatCount: 40,
  currentCustomers: null,
  occupancyRate: 75,
  averageStayMinutes: 90,
  estimatedAverageSpend: 9_000,
  openTime: "10:00",
  closeTime: "22:00",
  operatingDaysPerMonth: 30,
  takeoutLevel: "NONE",
  observedTakeoutOrders: null,
  observationDurationMinutes: 30,
};

describe("business estimator", () => {
  it("reproduces the PRD example", () => {
    const result = estimateBusiness(baseInput);
    expect(result.estimatedSeatTurnsPerHour).toBeCloseTo(0.667, 3);
    expect(result.estimatedCustomersPerHour).toBe(20);
    expect(result.scenarios.low).toEqual({ customers: 100, dailySales: 900_000, monthlySales: 27_000_000 });
    expect(result.scenarios.base).toEqual({
      customers: 140,
      dailySales: 1_260_000,
      monthlySales: 37_800_000,
    });
    expect(result.scenarios.high).toEqual({
      customers: 183,
      dailySales: 1_647_000,
      monthlySales: 49_410_000,
    });
  });

  it("prioritizes customers and caps calculation occupancy at 100%", () => {
    const result = estimateBusiness({ ...baseInput, seatCount: 20, currentCustomers: 24, occupancyRate: 25 });
    expect(result.occupancyRate).toBe(100);
    expect(result.isOverCapacity).toBe(true);
  });

  it("rounds customer-based occupancy and ignores a manual rate", () => {
    const result = estimateBusiness({ ...baseInput, seatCount: 20, currentCustomers: 13, occupancyRate: 12 });
    expect(result.occupancyRate).toBe(65);
    expect(result.isOverCapacity).toBe(false);
  });

  it("keeps fractional intermediates until daily scenarios", () => {
    const result = estimateBusiness({ ...baseInput, seatCount: 33, occupancyRate: 67 });
    expect(result.estimatedCustomersPerHour).toBeCloseTo(14.74, 2);
    expect(result.scenarios.base?.customers).toBe(Math.round(14.74 * 12 * 0.583));
  });

  it("rounds an exact half up without binary floating-point drift", () => {
    const result = estimateBusiness({
      ...baseInput,
      seatCount: 5,
      occupancyRate: 96,
      averageStayMinutes: 30,
      openTime: "10:00",
      closeTime: "20:25",
      observedTakeoutOrders: 10,
    });
    expect(result.scenarios.high?.customers).toBe(96);
  });

  it.each([
    ["10:00", "22:00", 12],
    ["18:00", "02:00", 8],
    ["06:00", "00:00", 18],
    ["10:00", "10:00", null],
    ["06:00", "01:00", null],
  ])("calculates operating hours %s-%s", (open, close, expected) => {
    expect(calculateOperatingHours(open, close)).toBe(expected);
  });

  it.each([
    [0, "HIGH", 0],
    [1, "HIGH", 0],
    [2, "NONE", 0.05],
    [3, "HIGH", 0.05],
    [4, "NONE", 0.1],
    [6, "HIGH", 0.1],
    [7, "NONE", 0.18],
    [9, "HIGH", 0.18],
    [10, "NONE", 0.25],
    [50, "NONE", 0.25],
    [null, "MEDIUM", 0.12],
    [null, null, 0],
  ] as const)("maps takeout orders %s before level %s", (orders, level, expected) => {
    expect(calculateTakeoutAdjustment(orders, level)).toBe(expected);
  });

  it("treats zero inputs as present", () => {
    const result = estimateBusiness({
      ...baseInput,
      currentCustomers: 0,
      occupancyRate: null,
      observedTakeoutOrders: 0,
    });
    expect(result.canEstimate).toBe(true);
    expect(result.occupancyRate).toBe(0);
    expect(result.scenarios.base?.dailySales).toBe(0);
  });

  it("reports missing fields without blocking partial derivations", () => {
    const result = estimateBusiness({ ...baseInput, seatCount: null, estimatedAverageSpend: null });
    expect(result.canEstimate).toBe(false);
    expect(result.missingFields).toContain("좌석 수");
    expect(result.missingFields).toContain("예상 객단가");
    expect(result.scenarios.base).toBeNull();
  });

  it("maps confidence boundaries and cumulative observation points", () => {
    const empty = Object.fromEntries(
      Object.keys(baseInput).map((key) => [key, null]),
    ) as BusinessEstimatorInput;
    expect(calculateConfidence(empty)).toEqual({ score: 0, level: "LOW" });
    expect(calculateConfidence({ ...empty, seatCount: 20, currentCustomers: 0 })).toEqual({
      score: 40,
      level: "MEDIUM",
    });
    expect(
      calculateConfidence({ ...baseInput, takeoutLevel: null, observationDurationMinutes: 9 }).score,
    ).toBe(85);
    expect(calculateConfidence(baseInput)).toEqual({ score: 100, level: "HIGH" });
    expect([39, 40, 69, 70].map(confidenceLevelForScore)).toEqual(["LOW", "MEDIUM", "MEDIUM", "HIGH"]);
  });
});
