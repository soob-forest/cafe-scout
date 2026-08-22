import { describe, expect, it } from "vitest";
import { seoulLocalDateTimeToIso, toSeoulLocalDateTime } from "./seoul-datetime";

describe("Seoul datetime conversion", () => {
  it("round-trips minute-precision Seoul local time", () => {
    const iso = seoulLocalDateTimeToIso("2026-08-18T12:34");
    expect(iso).toBe("2026-08-18T03:34:00.000Z");
    expect(toSeoulLocalDateTime(iso!)).toBe("2026-08-18T12:34");
  });

  it("returns an empty result instead of throwing for cleared or invalid input", () => {
    expect(seoulLocalDateTimeToIso("")).toBeNull();
    expect(seoulLocalDateTimeToIso("not-a-date")).toBeNull();
    expect(toSeoulLocalDateTime("")).toBe("");
    expect(toSeoulLocalDateTime("not-a-date")).toBe("");
  });
});
