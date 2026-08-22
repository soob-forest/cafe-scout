import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "\\evil.example", "visits"])(
    "rejects external or non-root-relative destination %s",
    (value) => expect(safeReturnTo(value)).toBe("/visits"),
  );

  it("preserves a local path, query, and fragment", () => {
    expect(safeReturnTo("/visits/abc?tab=photos#menu")).toBe("/visits/abc?tab=photos#menu");
  });
});
