export const MOOD_TAGS = [
  "감성",
  "대화",
  "데이트",
  "작업",
  "조용함",
  "오픈형",
  "테이크아웃",
  "디저트 강점",
] as const;
export const CUSTOMER_TYPES = ["혼자", "커플", "친구", "가족", "직장인", "학생", "관광객"] as const;
export const VISIT_PURPOSES = ["작업", "대화", "휴식", "사진", "디저트", "테이크아웃"] as const;

export const MENU_CATEGORIES = ["COFFEE", "NON_COFFEE", "DESSERT", "BAKERY", "BRUNCH", "ETC"] as const;
export const PRICE_LEVELS = ["CHEAP", "NORMAL", "HIGH", "VERY_HIGH"] as const;
export const STAY_PRESETS = [
  "UNDER_30M",
  "ONE_HOUR",
  "ONE_HALF_HOUR",
  "TWO_HOURS",
  "OVER_TWO_HOURS",
] as const;
export const TAKEOUT_LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH"] as const;
export const OCCUPANCY_INPUT_MODES = ["CUSTOMERS", "RATE"] as const;
export const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];
export type PriceLevel = (typeof PRICE_LEVELS)[number];
export type StayPreset = (typeof STAY_PRESETS)[number];
export type TakeoutLevel = (typeof TAKEOUT_LEVELS)[number];
export type OccupancyInputMode = (typeof OCCUPANCY_INPUT_MODES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type PhotoKind = "GENERAL" | "MENU_BOARD";

export type RepresentativeMenuInput = {
  id?: string;
  name: string;
  category: MenuCategory;
  price: number;
  isSignature: boolean;
  sortOrder: number;
};

export type BusinessEstimatorInput = {
  seatCount: number | null;
  currentCustomers: number | null;
  occupancyRate: number | null;
  averageStayMinutes: number | null;
  estimatedAverageSpend: number | null;
  openTime: string | null;
  closeTime: string | null;
  operatingDaysPerMonth: number | null;
  takeoutLevel: TakeoutLevel | null;
  observedTakeoutOrders: number | null;
  observationDurationMinutes: number | null;
};

export type SalesScenario = {
  customers: number;
  dailySales: number;
  monthlySales: number;
};

export type EstimationResult = {
  canEstimate: boolean;
  missingFields: string[];
  occupancyRate: number | null;
  isOverCapacity: boolean;
  operatingHours: number | null;
  estimatedSeatTurnsPerHour: number | null;
  estimatedCustomersPerHour: number | null;
  takeoutAdjustmentRate: number;
  scenarios: {
    low: SalesScenario | null;
    base: SalesScenario | null;
    high: SalesScenario | null;
  };
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  estimationModelVersion: "mvp-v1";
};

export type VisitInput = {
  cafeSelectionMode: "EXISTING" | "NEW";
  cafeId: string | null;
  cafeName: string | null;
  region: string | null;
  visitedAt: string;
  observationDurationMinutes: number | null;
  moodTags: string[];
  customerTypes: string[];
  visitPurposes: string[];
  spaceRating: number | null;
  menuRating: number | null;
  locationRating: number | null;
  overallRating: number | null;
  strengths: string | null;
  adoptablePoints: string | null;
  representativeMenus: RepresentativeMenuInput[];
  priceLevel: PriceLevel | null;
  tableCount: number | null;
  seatCount: number | null;
  currentCustomers: number | null;
  occupancyRate: number | null;
  occupancyInputMode: OccupancyInputMode | null;
  averageStayPreset: StayPreset | null;
  estimatedAverageSpend: number | null;
  takeoutLevel: TakeoutLevel | null;
  observedTakeoutOrders: number | null;
  openTime: string | null;
  closeTime: string | null;
  operatingDaysPerMonth: number;
};

export type CafeOption = {
  id: string;
  name: string;
  region: string;
  latestOpenTime: string | null;
  latestCloseTime: string | null;
};
