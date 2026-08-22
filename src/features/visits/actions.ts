"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { VisitInput } from "@/domain/types";
import { normalizeVisitInput, visitFieldErrors } from "@/lib/validation/visit";
import { requireUser } from "@/lib/auth";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const safeMessage = "저장하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.";

export async function saveVisitAction(
  input: VisitInput,
  visitId?: string,
  createRequestId?: string,
): Promise<ActionResult<{ id: string; cafe: { id: string; name: string; region: string } }>> {
  try {
    const normalized = normalizeVisitInput(input);
    const parsedVisitId = visitId ? z.string().uuid().parse(visitId) : undefined;
    const parsedCreateRequestId = parsedVisitId ? undefined : z.string().uuid().parse(createRequestId);
    const payload = parsedCreateRequestId
      ? { ...normalized, _createRequestId: parsedCreateRequestId }
      : normalized;
    const { supabase } = await requireUser(parsedVisitId ? `/visits/${parsedVisitId}/edit` : "/visits/new");
    const { data, error } = await supabase.rpc("save_cafe_visit", {
      p_payload: payload,
      ...(parsedVisitId ? { p_visit_id: parsedVisitId } : {}),
    });
    if (error || !data) return { ok: false, error: safeMessage };
    const { data: savedVisit, error: readError } = await supabase
      .from("cafe_visits")
      .select("cafe:cafes!inner(id,name,region)")
      .eq("id", data)
      .single();
    const cafe = savedVisit?.cafe as unknown as { id: string; name: string; region: string } | null;
    if (readError || !cafe) return { ok: false, error: safeMessage };
    revalidatePath("/visits");
    revalidatePath(`/visits/${data}`);
    return { ok: true, data: { id: data, cafe } };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof z.ZodError)
      return { ok: false, error: "입력값을 확인해 주세요.", fieldErrors: visitFieldErrors(error) };
    return { ok: false, error: safeMessage };
  }
}

export async function deleteVisitAction(visitId: string): Promise<ActionResult<{ cleanupPending: boolean }>> {
  try {
    const { supabase } = await requireUser(`/visits/${visitId}`);
    const { data, error } = await supabase.rpc("delete_cafe_visit", { p_visit_id: visitId });
    if (error) return { ok: false, error: "방문 기록을 삭제하지 못했습니다." };
    const grouped = new Map<string, Array<{ bucket: string; object_path: string }>>();
    (data ?? []).forEach((item) => grouped.set(item.bucket, [...(grouped.get(item.bucket) ?? []), item]));
    let cleanupPending = false;
    for (const [bucket, items] of grouped) {
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove(items.map((item) => item.object_path));
      if (storageError) cleanupPending = true;
    }
    revalidatePath("/visits");
    revalidatePath(`/visits/${visitId}`);
    return { ok: true, data: { cleanupPending } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "방문 기록을 삭제하지 못했습니다." };
  }
}

const observationSchema = z
  .object({
    id: z.string().uuid().optional(),
    cafeVisitId: z.string().uuid(),
    observedAt: z.string().datetime({ offset: true }),
    currentCustomers: z.number().int().min(0).max(500).nullable(),
    occupancyRate: z.number().int().min(0).max(100).nullable(),
  })
  .refine((value) => value.currentCustomers !== null || value.occupancyRate !== null, {
    message: "고객 수 또는 점유율이 필요합니다.",
  });

export async function saveObservationAction(
  input: z.input<typeof observationSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = observationSchema.parse(input);
    const { supabase, user } = await requireUser(`/visits/${parsed.cafeVisitId}`);
    const { data: snapshot } = await supabase
      .from("cafe_business_snapshots")
      .select("seat_count")
      .eq("cafe_visit_id", parsed.cafeVisitId)
      .single();
    if (parsed.currentCustomers !== null && !snapshot?.seat_count) {
      return { ok: false, error: "고객 수로 관찰하려면 먼저 방문 기록에 좌석 수를 입력해 주세요." };
    }
    const rate =
      parsed.currentCustomers !== null
        ? Math.min(100, Math.round((parsed.currentCustomers / snapshot!.seat_count!) * 100))
        : parsed.occupancyRate;
    const record = {
      owner_id: user.id,
      cafe_visit_id: parsed.cafeVisitId,
      observed_at: parsed.observedAt,
      current_customers: parsed.currentCustomers,
      occupancy_rate: rate,
    };
    const query = parsed.id
      ? supabase
          .from("visit_occupancy_observations")
          .update(record)
          .eq("id", parsed.id)
          .eq("cafe_visit_id", parsed.cafeVisitId)
          .select("id")
          .single()
      : supabase.from("visit_occupancy_observations").insert(record).select("id").single();
    const { data, error } = await query;
    if (error || !data) return { ok: false, error: "추가 관찰을 저장하지 못했습니다." };
    revalidatePath(`/visits/${parsed.cafeVisitId}`);
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "추가 관찰 값을 확인해 주세요." };
  }
}

export async function deleteObservationAction(id: string, visitId: string): Promise<ActionResult> {
  const { supabase } = await requireUser(`/visits/${visitId}`);
  const { error } = await supabase
    .from("visit_occupancy_observations")
    .delete()
    .eq("id", id)
    .eq("cafe_visit_id", visitId);
  if (error) return { ok: false, error: "추가 관찰을 삭제하지 못했습니다." };
  revalidatePath(`/visits/${visitId}`);
  return { ok: true, data: undefined };
}
