import type { VisitInput } from "@/domain/types";
import type { VisitRecord } from "./types";

export function defaultVisitInput(): VisitInput {
  return {
    cafeSelectionMode: "NEW",
    cafeId: null,
    cafeName: "",
    region: "",
    visitedAt: new Date().toISOString(),
    observationDurationMinutes: null,
    moodTags: [],
    customerTypes: [],
    visitPurposes: [],
    spaceRating: null,
    menuRating: null,
    locationRating: null,
    overallRating: null,
    strengths: "",
    adoptablePoints: "",
    representativeMenus: [],
    priceLevel: null,
    tableCount: null,
    seatCount: null,
    currentCustomers: null,
    occupancyRate: null,
    occupancyInputMode: "CUSTOMERS",
    averageStayPreset: null,
    estimatedAverageSpend: null,
    takeoutLevel: null,
    observedTakeoutOrders: null,
    openTime: null,
    closeTime: null,
    operatingDaysPerMonth: 30,
  };
}

export function visitRecordToInput(visit: VisitRecord): VisitInput {
  const snapshot = visit.snapshot;
  const stayPreset =
    snapshot?.average_stay_minutes === 30
      ? "UNDER_30M"
      : snapshot?.average_stay_minutes === 60
        ? "ONE_HOUR"
        : snapshot?.average_stay_minutes === 90
          ? "ONE_HALF_HOUR"
          : snapshot?.average_stay_minutes === 120
            ? "TWO_HOURS"
            : snapshot?.average_stay_minutes === 150
              ? "OVER_TWO_HOURS"
              : null;
  return {
    cafeSelectionMode: "EXISTING",
    cafeId: visit.cafe_id,
    cafeName: null,
    region: null,
    visitedAt: visit.visited_at,
    observationDurationMinutes: visit.observation_duration_minutes,
    moodTags: visit.mood_tags,
    customerTypes: visit.customer_types,
    visitPurposes: visit.visit_purposes,
    spaceRating: visit.space_rating,
    menuRating: visit.menu_rating,
    locationRating: visit.location_rating,
    overallRating: visit.overall_rating,
    strengths: visit.strengths,
    adoptablePoints: visit.adoptable_points,
    representativeMenus: visit.menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      category: menu.category,
      price: menu.price,
      isSignature: menu.is_signature,
      sortOrder: menu.sort_order,
    })),
    priceLevel: snapshot?.price_level ?? null,
    tableCount: snapshot?.table_count ?? null,
    seatCount: snapshot?.seat_count ?? null,
    currentCustomers: snapshot?.current_customers ?? null,
    occupancyRate: snapshot?.occupancy_rate ?? null,
    occupancyInputMode: snapshot?.occupancy_input_mode ?? null,
    averageStayPreset: stayPreset,
    estimatedAverageSpend: snapshot?.estimated_average_spend ?? null,
    takeoutLevel: snapshot?.takeout_level ?? null,
    observedTakeoutOrders: snapshot?.observed_takeout_orders ?? null,
    openTime: snapshot?.open_time ?? null,
    closeTime: snapshot?.close_time ?? null,
    operatingDaysPerMonth: snapshot?.operating_days_per_month ?? 30,
  };
}
