import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CafeOption } from "@/domain/types";
import type { PhotoWithUrl, VisitListItem, VisitRecord } from "./types";

type Client = SupabaseClient<Database>;
type RawPhoto = Database["public"]["Tables"]["cafe_photos"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["cafe_business_snapshots"]["Row"];

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export class RepositoryError extends Error {
  constructor(message = "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.") {
    super(message);
    this.name = "RepositoryError";
  }
}

async function signPhotos(client: Client, photos: RawPhoto[]): Promise<PhotoWithUrl[]> {
  if (photos.length === 0) return [];
  const byBucket = new Map<string, RawPhoto[]>();
  photos.forEach((photo) => byBucket.set(photo.bucket, [...(byBucket.get(photo.bucket) ?? []), photo]));
  const signedByPath = new Map<string, string>();
  for (const [bucket, bucketPhotos] of byBucket) {
    const paths = bucketPhotos.map((photo) => photo.object_path);
    const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, 300);
    if (error || !data) throw new RepositoryError("사진을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    data?.forEach((item) => {
      if (item.signedUrl) signedByPath.set(item.path ?? "", item.signedUrl);
    });
  }
  return photos.map((photo) => ({ ...photo, signedUrl: signedByPath.get(photo.object_path) ?? null }));
}

export async function listCafeOptions(client: Client): Promise<CafeOption[]> {
  const { data, error } = await client.from("cafes").select("id,name,region").order("name");
  if (error) throw new RepositoryError();
  const cafes = data as Array<{ id: string; name: string; region: string }>;
  const { data: recentData, error: recentError } = await client
    .from("cafe_visits")
    .select("cafe_id,visited_at,snapshot:cafe_business_snapshots(open_time,close_time)")
    .order("visited_at", { ascending: false });
  if (recentError) throw new RepositoryError();
  const recent = recentData as unknown as Array<{
    cafe_id: string;
    snapshot:
      | { open_time: string | null; close_time: string | null }
      | Array<{ open_time: string | null; close_time: string | null }>
      | null;
  }> | null;
  const latestByCafe = new Map<string, { open_time: string | null; close_time: string | null }>();
  recent?.forEach((visit) => {
    const snapshot = one(visit.snapshot);
    if (!latestByCafe.has(visit.cafe_id) && snapshot) latestByCafe.set(visit.cafe_id, snapshot);
  });
  return cafes.map((cafe) => ({
    id: cafe.id,
    name: cafe.name,
    region: cafe.region,
    latestOpenTime: latestByCafe.get(cafe.id)?.open_time ?? null,
    latestCloseTime: latestByCafe.get(cafe.id)?.close_time ?? null,
  }));
}

export async function listVisits(client: Client): Promise<VisitListItem[]> {
  const { data, error } = await client
    .from("cafe_visits")
    .select("*,cafe:cafes!inner(*),snapshot:cafe_business_snapshots(*),photos:cafe_photos(*)")
    .order("visited_at", { ascending: false })
    .order("kind", { referencedTable: "cafe_photos", ascending: true })
    .order("sort_order", { referencedTable: "cafe_photos", ascending: true })
    .limit(1, { referencedTable: "cafe_photos" });
  if (error) throw new RepositoryError();
  const rows = data as unknown as Array<
    Omit<VisitListItem, "photos" | "snapshot"> & {
      photos: RawPhoto[];
      snapshot: SnapshotRow | SnapshotRow[] | null;
    }
  >;
  const allPhotos = await signPhotos(
    client,
    rows.flatMap((row) => row.photos),
  );
  const signed = new Map(allPhotos.map((photo) => [photo.id, photo]));
  return rows.map((row) => ({
    ...row,
    snapshot: one(row.snapshot),
    photos: row.photos.map((photo) => signed.get(photo.id) ?? { ...photo, signedUrl: null }),
  }));
}

export async function getVisit(client: Client, id: string): Promise<VisitRecord | null> {
  const { data, error } = await client
    .from("cafe_visits")
    .select(
      "*,cafe:cafes!inner(*),snapshot:cafe_business_snapshots(*),photos:cafe_photos(*),menus:cafe_menus(*),observations:visit_occupancy_observations(*)",
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "cafe_photos", ascending: true })
    .order("sort_order", { referencedTable: "cafe_menus", ascending: true })
    .order("observed_at", { referencedTable: "visit_occupancy_observations", ascending: true })
    .maybeSingle();
  if (error) throw new RepositoryError();
  if (!data) return null;
  const row = data as unknown as Omit<VisitRecord, "photos" | "snapshot"> & {
    photos: RawPhoto[];
    snapshot: SnapshotRow | SnapshotRow[] | null;
  };
  return { ...row, snapshot: one(row.snapshot), photos: await signPhotos(client, row.photos) };
}

export async function getCompareVisits(client: Client, ids: string[]): Promise<VisitRecord[]> {
  if (ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length)
    throw new RepositoryError("비교할 방문 기록을 2~3개 선택해 주세요.");
  const visits = await Promise.all(ids.map((id) => getVisit(client, id)));
  if (visits.some((visit) => !visit))
    throw new RepositoryError("비교할 수 없는 방문 기록이 포함되어 있습니다.");
  return visits as VisitRecord[];
}
