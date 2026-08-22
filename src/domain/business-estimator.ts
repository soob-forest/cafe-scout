import type {
  BusinessEstimatorInput,
  ConfidenceLevel,
  EstimationResult,
  StayPreset,
  TakeoutLevel,
} from "./types";

export const ESTIMATION_MODEL_VERSION = "mvp-v1" as const;

export const STAY_MINUTES: Record<StayPreset, number> = {
  UNDER_30M: 30,
  ONE_HOUR: 60,
  ONE_HALF_HOUR: 90,
  TWO_HOURS: 120,
  OVER_TWO_HOURS: 150,
};

export const SCENARIO_FACTORS = {
  low: 0.417,
  base: 0.583,
  high: 0.764,
} as const;

const SCENARIO_FACTOR_THOUSANDTHS = {
  low: 417,
  base: 583,
  high: 764,
} as const;

const TAKEOUT_LEVEL_ADJUSTMENT: Record<TakeoutLevel, number> = {
  NONE: 0,
  LOW: 0.05,
  MEDIUM: 0.12,
  HIGH: 0.2,
};

const isPresent = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

function calculateOperatingMinutes(openTime: string | null, closeTime: string | null): number | null {
  if (!openTime || !closeTime || openTime === closeTime) return null;
  const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const open = pattern.exec(openTime);
  const close = pattern.exec(closeTime);
  if (!open || !close) return null;
  const openMinutes = Number(open[1]) * 60 + Number(open[2]);
  const closeMinutes = Number(close[1]) * 60 + Number(close[2]);
  const durationMinutes =
    closeMinutes > openMinutes ? closeMinutes - openMinutes : 24 * 60 - openMinutes + closeMinutes;
  return durationMinutes > 0 && durationMinutes <= 18 * 60 ? durationMinutes : null;
}

export function calculateOperatingHours(openTime: string | null, closeTime: string | null): number | null {
  const minutes = calculateOperatingMinutes(openTime, closeTime);
  return minutes === null ? null : minutes / 60;
}

export function calculateOccupancyRate(
  seatCount: number | null,
  currentCustomers: number | null,
  manualRate: number | null,
): { rate: number | null; isOverCapacity: boolean } {
  if (isPresent(currentCustomers) && isPresent(seatCount) && seatCount > 0) {
    return {
      rate: Math.min(100, Math.round((currentCustomers / seatCount) * 100)),
      isOverCapacity: currentCustomers > seatCount,
    };
  }
  return { rate: isPresent(manualRate) ? manualRate : null, isOverCapacity: false };
}

export function calculateTakeoutAdjustment(
  observedOrders: number | null,
  level: TakeoutLevel | null,
): number {
  if (isPresent(observedOrders)) {
    if (observedOrders <= 1) return 0;
    if (observedOrders <= 3) return 0.05;
    if (observedOrders <= 6) return 0.1;
    if (observedOrders <= 9) return 0.18;
    return 0.25;
  }
  return level ? TAKEOUT_LEVEL_ADJUSTMENT[level] : 0;
}

export function confidenceLevelForScore(score: number): ConfidenceLevel {
  return score < 40 ? "LOW" : score < 70 ? "MEDIUM" : "HIGH";
}

export function calculateConfidence(input: BusinessEstimatorInput): {
  score: number;
  level: ConfidenceLevel;
} {
  let score = 0;
  if (isPresent(input.seatCount)) score += 20;
  if (isPresent(input.currentCustomers) || isPresent(input.occupancyRate)) score += 20;
  if (isPresent(input.estimatedAverageSpend)) score += 20;
  if (isPresent(input.averageStayMinutes)) score += 15;
  if (input.openTime && input.closeTime) score += 10;
  if (input.takeoutLevel || isPresent(input.observedTakeoutOrders)) score += 5;
  if (isPresent(input.observationDurationMinutes) && input.observationDurationMinutes >= 10) score += 5;
  if (isPresent(input.observationDurationMinutes) && input.observationDurationMinutes >= 30) score += 5;
  const level = confidenceLevelForScore(score);
  return { score, level };
}

function roundScenarioCustomers(
  input: BusinessEstimatorInput,
  occupancyRate: number,
  operatingMinutes: number,
  factorThousandths: number,
  takeoutAdjustmentRate: number,
): number {
  const integerInputs = [
    input.seatCount,
    occupancyRate,
    input.averageStayMinutes,
    operatingMinutes,
    factorThousandths,
  ];
  if (integerInputs.some((value) => value === null || !Number.isInteger(value))) {
    const potential =
      input.seatCount! * (occupancyRate / 100) * (60 / input.averageStayMinutes!) * (operatingMinutes / 60);
    return Math.round(potential * (factorThousandths / 1000) * (1 + takeoutAdjustmentRate));
  }

  // All valid model inputs are bounded non-negative integers. Keep the final
  // rounding operand as an exact rational so JavaScript and Postgres agree at
  // x.5 boundaries instead of depending on binary floating-point drift.
  const adjustmentMultiplierHundred = Math.round((1 + takeoutAdjustmentRate) * 100);
  const numerator =
    BigInt(input.seatCount!) *
    BigInt(occupancyRate) *
    BigInt(operatingMinutes) *
    BigInt(factorThousandths) *
    BigInt(adjustmentMultiplierHundred);
  const denominator = BigInt(100 * input.averageStayMinutes! * 1000 * 100);
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

export function estimateBusiness(input: BusinessEstimatorInput): EstimationResult {
  const occupancy = calculateOccupancyRate(input.seatCount, input.currentCustomers, input.occupancyRate);
  const operatingMinutes = calculateOperatingMinutes(input.openTime, input.closeTime);
  const operatingHours = operatingMinutes === null ? null : operatingMinutes / 60;
  const takeoutAdjustmentRate = calculateTakeoutAdjustment(input.observedTakeoutOrders, input.takeoutLevel);
  const confidence = calculateConfidence(input);
  const missingFields: string[] = [];

  if (!isPresent(input.seatCount)) missingFields.push("좌석 수");
  if (!isPresent(input.currentCustomers) && !isPresent(input.occupancyRate))
    missingFields.push("현재 고객 수 또는 점유율");
  if (!isPresent(input.averageStayMinutes)) missingFields.push("평균 체류시간");
  if (!isPresent(input.estimatedAverageSpend)) missingFields.push("예상 객단가");
  if (!input.openTime) missingFields.push("오픈 시간");
  if (!input.closeTime) missingFields.push("마감 시간");
  if (input.openTime && input.closeTime && operatingHours === null) missingFields.push("유효한 영업시간");
  if (!isPresent(input.operatingDaysPerMonth)) missingFields.push("월 영업일");

  const canEstimate = missingFields.length === 0 && occupancy.rate !== null;
  const turns =
    isPresent(input.averageStayMinutes) && input.averageStayMinutes > 0
      ? 60 / input.averageStayMinutes
      : null;
  const customersPerHour =
    canEstimate && turns !== null && input.seatCount !== null
      ? input.seatCount * (occupancy.rate! / 100) * turns
      : null;

  const emptyScenarios = { low: null, base: null, high: null };
  if (
    !canEstimate ||
    customersPerHour === null ||
    operatingHours === null ||
    input.estimatedAverageSpend === null ||
    input.operatingDaysPerMonth === null
  ) {
    return {
      canEstimate,
      missingFields,
      occupancyRate: occupancy.rate,
      isOverCapacity: occupancy.isOverCapacity,
      operatingHours,
      estimatedSeatTurnsPerHour: turns,
      estimatedCustomersPerHour: customersPerHour,
      takeoutAdjustmentRate,
      scenarios: emptyScenarios,
      confidenceScore: confidence.score,
      confidenceLevel: confidence.level,
      estimationModelVersion: ESTIMATION_MODEL_VERSION,
    };
  }

  const makeScenario = (factorThousandths: number) => {
    const customers = roundScenarioCustomers(
      input,
      occupancy.rate!,
      operatingMinutes!,
      factorThousandths,
      takeoutAdjustmentRate,
    );
    const dailySales = customers * input.estimatedAverageSpend!;
    return { customers, dailySales, monthlySales: dailySales * input.operatingDaysPerMonth! };
  };

  return {
    canEstimate: true,
    missingFields,
    occupancyRate: occupancy.rate,
    isOverCapacity: occupancy.isOverCapacity,
    operatingHours,
    estimatedSeatTurnsPerHour: turns,
    estimatedCustomersPerHour: customersPerHour,
    takeoutAdjustmentRate,
    scenarios: {
      low: makeScenario(SCENARIO_FACTOR_THOUSANDTHS.low),
      base: makeScenario(SCENARIO_FACTOR_THOUSANDTHS.base),
      high: makeScenario(SCENARIO_FACTOR_THOUSANDTHS.high),
    },
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    estimationModelVersion: ESTIMATION_MODEL_VERSION,
  };
}
