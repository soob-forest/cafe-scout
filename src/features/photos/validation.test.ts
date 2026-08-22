import { describe, expect, it } from "vitest";
import { finalizePhotoSchema, uploadRequestSchema } from "./validation";

const valid = {
  visitId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  kind: "GENERAL" as const,
  mimeType: "image/webp" as const,
  sizeBytes: 3 * 1024 * 1024,
};

describe("photo validation", () => {
  it("accepts the exact 3MB boundary and supported MIME types", () => {
    expect(uploadRequestSchema.safeParse(valid).success).toBe(true);
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"] as const) {
      expect(uploadRequestSchema.safeParse({ ...valid, mimeType }).success).toBe(true);
    }
  });

  it("rejects oversized, empty, and unsupported files", () => {
    expect(uploadRequestSchema.safeParse({ ...valid, sizeBytes: 3 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...valid, sizeBytes: 0 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...valid, mimeType: "image/gif" }).success).toBe(false);
  });

  it("validates processed dimensions and sort order", () => {
    expect(
      finalizePhotoSchema.safeParse({
        ...valid,
        path: "owner/visit/photo.webp",
        width: 1600,
        height: 1200,
        sortOrder: 9,
      }).success,
    ).toBe(true);
    expect(
      finalizePhotoSchema.safeParse({
        ...valid,
        path: "owner/visit/photo.webp",
        width: 1601,
        height: 1200,
        sortOrder: 9,
      }).success,
    ).toBe(false);
    expect(
      finalizePhotoSchema.safeParse({
        ...valid,
        path: "owner/visit/photo.webp",
        width: 1200,
        height: 800,
        sortOrder: 10,
      }).success,
    ).toBe(false);
  });
});
