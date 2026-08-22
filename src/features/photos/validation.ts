import { z } from "zod";

export const MIME_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export const uploadRequestSchema = z.object({
  visitId: z.string().uuid(),
  kind: z.enum(["GENERAL", "MENU_BOARD"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(3 * 1024 * 1024),
});

export const finalizePhotoSchema = uploadRequestSchema.extend({
  path: z.string().min(1).max(500),
  width: z.number().int().min(1).max(1600),
  height: z.number().int().min(1).max(1600),
  sortOrder: z.number().int().min(0).max(9),
});
