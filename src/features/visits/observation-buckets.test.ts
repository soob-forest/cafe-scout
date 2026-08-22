import { describe, expect, it } from "vitest";
import { getSeoulHour, groupOccupancyObservations } from "./observation-buckets";

describe("occupancy observation buckets", () => {
  it.each([
    ["2026-08-16T17:00:00.000Z", 2],
    ["2026-08-17T01:59:59.000Z", 10],
    ["2026-08-17T02:00:00.000Z", 11],
    ["2026-08-17T05:00:00.000Z", 14],
    ["2026-08-17T08:00:00.000Z", 17],
    ["2026-08-17T11:00:00.000Z", 20],
  ])("converts %s to Seoul hour %i", (iso, hour) => {
    expect(getSeoulHour(iso)).toBe(hour);
  });

  it("averages multiple observations and omits empty/null buckets", () => {
    const result = groupOccupancyObservations([
      { observed_at: "2026-08-17T02:00:00.000Z", occupancy_rate: 40 },
      { observed_at: "2026-08-17T04:59:00.000Z", occupancy_rate: 61 },
      { observed_at: "2026-08-17T05:00:00.000Z", occupancy_rate: 75 },
      { observed_at: "2026-08-17T08:00:00.000Z", occupancy_rate: null },
    ]);
    expect(result).toEqual([
      { key: "11-14", label: "11~14시", averageOccupancyRate: 51, count: 2 },
      { key: "14-17", label: "14~17시", averageOccupancyRate: 75, count: 1 },
    ]);
  });

  it("groups observations on both sides of midnight in Seoul", () => {
    expect(
      groupOccupancyObservations([
        { observed_at: "2026-08-17T14:59:00.000Z", occupancy_rate: 30 },
        { observed_at: "2026-08-17T15:00:00.000Z", occupancy_rate: 50 },
      ]),
    ).toEqual([
      { key: "00-06", label: "00~06시", averageOccupancyRate: 50, count: 1 },
      { key: "20-24", label: "20~24시", averageOccupancyRate: 30, count: 1 },
    ]);
  });
});
