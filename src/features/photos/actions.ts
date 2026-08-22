"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/features/visits/actions";
import type { PhotoWithUrl } from "@/features/visits/types";
import { finalizePhotoSchema, MIME_EXTENSIONS, uploadRequestSchema } from "./validation";

export async function createPhotoUploadAction(
  input: z.input<typeof uploadRequestSchema>,
): Promise<ActionResult<{ path: string; token: string }>> {
  try {
    const parsed = uploadRequestSchema.parse(input);
    const { supabase, user } = await requireUser(`/visits/${parsed.visitId}/edit`);
    const { data: visit } = await supabase
      .from("cafe_visits")
      .select("id")
      .eq("id", parsed.visitId)
      .maybeSingle();
    if (!visit) return { ok: false, error: "사진을 연결할 방문 기록을 찾을 수 없습니다." };
    const { count } = await supabase
      .from("cafe_photos")
      .select("id", { count: "exact", head: true })
      .eq("cafe_visit_id", parsed.visitId)
      .eq("kind", parsed.kind);
    const limit = parsed.kind === "GENERAL" ? 10 : 3;
    if ((count ?? 0) >= limit) return { ok: false, error: `사진은 최대 ${limit}장까지 저장할 수 있습니다.` };
    const extension = MIME_EXTENSIONS[parsed.mimeType];
    const path = `${user.id}/${parsed.visitId}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage
      .from("cafe-photos")
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data) return { ok: false, error: "사진 업로드를 준비하지 못했습니다." };
    return { ok: true, data: { path, token: data.token } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "지원하지 않는 사진입니다." };
  }
}

export async function finalizePhotoUploadAction(
  input: z.input<typeof finalizePhotoSchema>,
): Promise<ActionResult<PhotoWithUrl>> {
  let pathToClean: string | null = null;
  try {
    const parsed = finalizePhotoSchema.parse(input);
    pathToClean = parsed.path;
    const { supabase, user } = await requireUser(`/visits/${parsed.visitId}/edit`);
    const expectedPrefix = `${user.id}/${parsed.visitId}/`;
    if (!parsed.path.startsWith(expectedPrefix))
      return { ok: false, error: "사진 경로가 올바르지 않습니다." };
    const { data, error } = await supabase
      .rpc("finalize_cafe_photo", {
        p_visit_id: parsed.visitId,
        p_kind: parsed.kind,
        p_object_path: parsed.path,
        p_mime_type: parsed.mimeType,
        p_size_bytes: parsed.sizeBytes,
        p_width: parsed.width,
        p_height: parsed.height,
        p_sort_order: parsed.sortOrder,
      })
      .single();
    if (error || !data) {
      await supabase.storage.from("cafe-photos").remove([parsed.path]);
      return { ok: false, error: "사진 정보를 저장하지 못했습니다." };
    }
    const { data: signed } = await supabase.storage.from(data.bucket).createSignedUrl(data.object_path, 300);
    revalidatePath(`/visits/${parsed.visitId}`);
    return { ok: true, data: { ...data, signedUrl: signed?.signedUrl ?? null } };
  } catch (error) {
    unstable_rethrow(error);
    if (pathToClean) {
      try {
        const { supabase } = await requireUser();
        await supabase.storage.from("cafe-photos").remove([pathToClean]);
      } catch (cleanupError) {
        unstable_rethrow(cleanupError);
        /* best-effort cleanup */
      }
    }
    return { ok: false, error: "사진 정보를 저장하지 못했습니다." };
  }
}

export async function discardPhotoUploadAction(visitId: string, path: string): Promise<void> {
  try {
    const parsedVisitId = z.string().uuid().parse(visitId);
    const parsedPath = z.string().min(1).max(500).parse(path);
    const { supabase, user } = await requireUser(`/visits/${parsedVisitId}/edit`);
    if (!parsedPath.startsWith(`${user.id}/${parsedVisitId}/`)) return;
    await supabase.storage.from("cafe-photos").remove([parsedPath]);
  } catch (error) {
    unstable_rethrow(error);
    /* best-effort compensation only */
  }
}

export async function removePhotoAction(
  photoId: string,
  visitId: string,
): Promise<ActionResult<{ cleanupPending: boolean }>> {
  try {
    const parsedPhotoId = z.string().uuid().parse(photoId);
    const parsedVisitId = z.string().uuid().parse(visitId);
    const { supabase } = await requireUser(`/visits/${parsedVisitId}/edit`);
    const { data: photo, error } = await supabase
      .rpc("remove_cafe_photo", { p_photo_id: parsedPhotoId, p_visit_id: parsedVisitId })
      .single();
    if (error || !photo) return { ok: false, error: "사진을 찾을 수 없거나 제거하지 못했습니다." };
    const { error: storageError } = await supabase.storage.from(photo.bucket).remove([photo.object_path]);
    revalidatePath(`/visits/${parsedVisitId}`);
    return { ok: true, data: { cleanupPending: Boolean(storageError) } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "사진을 제거하지 못했습니다." };
  }
}

export async function reorderPhotosAction(
  visitId: string,
  kind: "GENERAL" | "MENU_BOARD",
  photoIds: string[],
): Promise<ActionResult> {
  try {
    const parsedVisitId = z.string().uuid().parse(visitId);
    const parsedKind = z.enum(["GENERAL", "MENU_BOARD"]).parse(kind);
    const limit = parsedKind === "GENERAL" ? 10 : 3;
    const parsedIds = z
      .array(z.string().uuid())
      .max(limit)
      .refine((ids) => new Set(ids).size === ids.length)
      .parse(photoIds);
    const { supabase } = await requireUser(`/visits/${parsedVisitId}/edit`);
    const { error } = await supabase.rpc("reorder_cafe_photos", {
      p_visit_id: parsedVisitId,
      p_kind: parsedKind,
      p_photo_ids: parsedIds,
    });
    if (error) return { ok: false, error: "사진 순서를 저장하지 못했습니다." };
    revalidatePath(`/visits/${parsedVisitId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "사진 순서를 변경할 수 없습니다." };
  }
}
