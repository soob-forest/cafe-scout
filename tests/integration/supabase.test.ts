import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../src/types/database";
import { estimateBusiness } from "../../src/domain/business-estimator";
import type { BusinessEstimatorInput } from "../../src/domain/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required for local integration tests.");

type Client = SupabaseClient<Database>;
const anon = createClient<Database>(url, key, { auth: { persistSession: false } });
const owner = createClient<Database>(url, key, { auth: { persistSession: false } });
const other = createClient<Database>(url, key, { auth: { persistSession: false } });
const createdByOwner: string[] = [];
const createdByOther: string[] = [];
const ownerStoragePaths: string[] = [];
const ownerId = "11111111-1111-4111-8111-111111111111";
const validWebp = new Uint8Array(
  Buffer.from("UklGRiYAAABXRUJQVlA4IBoAAAAwAQCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA", "base64"),
);

function payload(name: string, overrides: Record<string, Json | undefined> = {}) {
  return {
    _createRequestId: crypto.randomUUID(),
    cafeSelectionMode: "NEW",
    cafeId: null,
    cafeName: name,
    region: "테스트 지역",
    visitedAt: "2026-08-18T03:00:00.000Z",
    observationDurationMinutes: 30,
    moodTags: ["작업"],
    customerTypes: ["혼자"],
    visitPurposes: ["작업"],
    spaceRating: 4,
    menuRating: 4,
    locationRating: 4,
    overallRating: 4,
    strengths: null,
    adoptablePoints: null,
    representativeMenus: [
      { name: "첫 메뉴", category: "COFFEE", price: 5_000, isSignature: false, sortOrder: 0 },
      { name: "둘째 메뉴", category: "DESSERT", price: 7_000, isSignature: true, sortOrder: 1 },
    ],
    priceLevel: "NORMAL",
    tableCount: 5,
    seatCount: 20,
    currentCustomers: 13,
    occupancyRate: 5,
    occupancyInputMode: "CUSTOMERS",
    averageStayPreset: "ONE_HOUR",
    averageStayMinutes: 60,
    estimatedAverageSpend: 8_000,
    takeoutLevel: "NONE",
    observedTakeoutOrders: 0,
    openTime: "10:00",
    closeTime: "22:00",
    operatingDaysPerMonth: 30,
    estimatedDailySalesBase: 999_999_999,
    ...overrides,
  } satisfies Record<string, Json | undefined>;
}

async function login(client: Client, email: string) {
  const { error } = await client.auth.signInWithPassword({ email, password: "cafe-scout-local" });
  if (error) throw error;
}

async function removeVisits(client: Client, ids: string[]) {
  for (const id of ids) await client.rpc("delete_cafe_visit", { p_visit_id: id });
}

beforeAll(async () => {
  await Promise.all([login(owner, "scout@example.com"), login(other, "isolation@example.com")]);
});

afterAll(async () => {
  await removeVisits(owner, createdByOwner);
  await removeVisits(other, createdByOther);
  if (ownerStoragePaths.length) await owner.storage.from("cafe-photos").remove(ownerStoragePaths);
  await Promise.all([owner.auth.signOut(), other.auth.signOut()]);
});

describe("Supabase transaction and isolation", () => {
  it("recalculates snapshots, preserves child order, and never auto-merges new cafes", async () => {
    const first = await owner.rpc("save_cafe_visit", { p_payload: payload("같은 이름") });
    const second = await owner.rpc("save_cafe_visit", { p_payload: payload("같은 이름") });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    createdByOwner.push(first.data!, second.data!);

    const { data, error } = await owner
      .from("cafe_visits")
      .select(
        "id,cafe_id,menus:cafe_menus(name,sort_order),snapshot:cafe_business_snapshots(occupancy_rate,estimated_daily_sales_base)",
      )
      .in("id", [first.data!, second.data!]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(new Set(data!.map((row) => row.cafe_id)).size).toBe(2);
    const snapshot = Array.isArray(data![0].snapshot) ? data![0].snapshot[0] : data![0].snapshot;
    expect(snapshot?.occupancy_rate).toBe(65);
    expect(snapshot?.estimated_daily_sales_base).toBe(728_000);
    expect(snapshot?.estimated_daily_sales_base).not.toBe(999_999_999);
    expect(data![0].menus.map((menu) => menu.name)).toEqual(["첫 메뉴", "둘째 메뉴"]);
  });

  it("links a revisit only when an existing cafe is explicitly selected", async () => {
    const first = await owner.rpc("save_cafe_visit", { p_payload: payload("재방문 카페") });
    expect(first.error).toBeNull();
    createdByOwner.push(first.data!);
    const { data: firstRow } = await owner
      .from("cafe_visits")
      .select("cafe_id")
      .eq("id", first.data!)
      .single();
    const revisitPayload = payload("무시되는 이름", {
      cafeSelectionMode: "EXISTING",
      cafeId: firstRow!.cafe_id,
      cafeName: null,
      region: null,
    });
    const revisit = await owner.rpc("save_cafe_visit", { p_payload: revisitPayload });
    expect(revisit.error).toBeNull();
    createdByOwner.push(revisit.data!);
    const { data: rows } = await owner
      .from("cafe_visits")
      .select("cafe_id")
      .in("id", [first.data!, revisit.data!])
      .order("created_at");
    expect(rows?.map((row) => row.cafe_id)).toEqual([firstRow!.cafe_id, firstRow!.cafe_id]);
  });

  it("replays a create request idempotently after an ambiguous response", async () => {
    const requestId = crypto.randomUUID();
    const first = await owner.rpc("save_cafe_visit", {
      p_payload: payload("멱등 생성", { _createRequestId: requestId }),
    });
    const replay = await owner.rpc("save_cafe_visit", {
      p_payload: payload("멱등 생성 수정", {
        _createRequestId: requestId,
        strengths: "재시도에 포함된 최신 값",
      }),
    });
    expect(first.error).toBeNull();
    expect(replay.error).toBeNull();
    expect(first.data).toBe(requestId);
    expect(replay.data).toBe(requestId);
    createdByOwner.push(requestId);

    const { data, count, error } = await owner
      .from("cafe_visits")
      .select("id,strengths,cafe:cafes!inner(name)", { count: "exact" })
      .eq("id", requestId);
    expect(error).toBeNull();
    expect(count).toBe(1);
    expect(data?.[0]?.strengths).toBe("재시도에 포함된 최신 값");
    expect((data?.[0]?.cafe as unknown as { name: string }).name).toBe("멱등 생성 수정");
  });

  it("serializes simultaneous replays of the same create request", async () => {
    const requestId = crypto.randomUUID();
    const [first, second] = await Promise.all([
      owner.rpc("save_cafe_visit", {
        p_payload: payload("동시 멱등 A", { _createRequestId: requestId }),
      }),
      owner.rpc("save_cafe_visit", {
        p_payload: payload("동시 멱등 B", { _createRequestId: requestId }),
      }),
    ]);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).toBe(requestId);
    expect(second.data).toBe(requestId);
    createdByOwner.push(requestId);

    const { count: visitCount } = await owner
      .from("cafe_visits")
      .select("id", { count: "exact", head: true })
      .eq("id", requestId);
    const { data: cafes } = await owner
      .from("cafes")
      .select("id,name")
      .in("name", ["동시 멱등 A", "동시 멱등 B"]);
    expect(visitCount).toBe(1);
    expect(cafes).toHaveLength(1);
  });

  it("keeps customer observations derived when visit seat counts change", async () => {
    const saved = await owner.rpc("save_cafe_visit", { p_payload: payload("관찰 재계산") });
    expect(saved.error).toBeNull();
    createdByOwner.push(saved.data!);

    const inserted = await owner
      .from("visit_occupancy_observations")
      .insert({
        owner_id: ownerId,
        cafe_visit_id: saved.data!,
        observed_at: "2026-08-18T04:00:00.000Z",
        current_customers: 10,
        occupancy_rate: 1,
      })
      .select("id,occupancy_rate")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.occupancy_rate).toBe(50);

    const fortySeats = await owner
      .from("cafe_business_snapshots")
      .update({ seat_count: 40 })
      .eq("cafe_visit_id", saved.data!);
    expect(fortySeats.error).toBeNull();
    const recalculated = await owner
      .from("visit_occupancy_observations")
      .select("occupancy_rate")
      .eq("id", inserted.data!.id)
      .single();
    expect(recalculated.data?.occupancy_rate).toBe(25);

    const noSeats = await owner
      .from("cafe_business_snapshots")
      .update({ seat_count: null })
      .eq("cafe_visit_id", saved.data!);
    expect(noSeats.error).toBeNull();
    const unavailable = await owner
      .from("visit_occupancy_observations")
      .select("occupancy_rate")
      .eq("id", inserted.data!.id)
      .single();
    expect(unavailable.data?.occupancy_rate).toBeNull();
  });

  it("serializes concurrent edits and delete races without orphaning cafes", async () => {
    const saved = await owner.rpc("save_cafe_visit", { p_payload: payload("동시성 원본") });
    expect(saved.error).toBeNull();
    createdByOwner.push(saved.data!);

    const [editA, editB] = await Promise.all([
      owner.rpc("save_cafe_visit", {
        p_visit_id: saved.data!,
        p_payload: payload("동시 수정 A"),
      }),
      owner.rpc("save_cafe_visit", {
        p_visit_id: saved.data!,
        p_payload: payload("동시 수정 B"),
      }),
    ]);
    expect(editA.error).toBeNull();
    expect(editB.error).toBeNull();
    const { data: editCafes } = await owner
      .from("cafes")
      .select("id,name")
      .in("name", ["동시성 원본", "동시 수정 A", "동시 수정 B"]);
    expect(editCafes).toHaveLength(1);

    const [editRace, deleteRace] = await Promise.all([
      owner.rpc("save_cafe_visit", {
        p_visit_id: saved.data!,
        p_payload: payload("삭제 경합 수정"),
      }),
      owner.rpc("delete_cafe_visit", { p_visit_id: saved.data! }),
    ]);
    expect([editRace.error, deleteRace.error].filter(Boolean).length).toBeLessThanOrEqual(1);
    const { count: visitCount } = await owner
      .from("cafe_visits")
      .select("id", { count: "exact", head: true })
      .eq("id", saved.data!);
    const { count: cafeCount } = await owner
      .from("cafes")
      .select("id", { count: "exact", head: true })
      .in("name", ["동시성 원본", "동시 수정 A", "동시 수정 B", "삭제 경합 수정"]);
    expect(visitCount).toBe(0);
    expect(cafeCount).toBe(0);
  });

  it("denies anonymous and cross-user row access and ownership changes", async () => {
    const { count: anonymousCount, error: anonymousError } = await anon
      .from("cafe_visits")
      .select("id", { count: "exact", head: true });
    const { count: otherCount } = await other
      .from("cafe_visits")
      .select("id", { count: "exact", head: true });
    expect(anonymousCount).toBeNull();
    expect(anonymousError).not.toBeNull();
    expect(otherCount).toBe(0);

    const crossLink = await other.rpc("save_cafe_visit", {
      p_payload: payload("교차 연결", {
        cafeSelectionMode: "EXISTING",
        cafeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        cafeName: null,
        region: null,
      }),
    });
    expect(crossLink.error).not.toBeNull();

    const own = await other.rpc("save_cafe_visit", { p_payload: payload("격리 계정 카페") });
    expect(own.error).toBeNull();
    createdByOther.push(own.data!);
    const collidingCreate = await owner.rpc("save_cafe_visit", {
      p_payload: payload("다른 사용자 ID 충돌", { _createRequestId: own.data! }),
    });
    expect(collidingCreate.error).not.toBeNull();
    const { data: untouched } = await other
      .from("cafe_visits")
      .select("cafe:cafes!inner(name)")
      .eq("id", own.data!)
      .single();
    expect((untouched?.cafe as unknown as { name: string }).name).toBe("격리 계정 카페");
    const { data: ownRow } = await other.from("cafe_visits").select("cafe_id").eq("id", own.data!).single();
    const changed = await other
      .from("cafes")
      .update({ owner_id: "11111111-1111-4111-8111-111111111111" })
      .eq("id", ownRow!.cafe_id);
    expect(changed.error).not.toBeNull();
  });

  it("enforces private user-prefixed storage paths", async () => {
    const ownPath = `33333333-3333-4333-8333-333333333333/integration/${crypto.randomUUID()}.webp`;
    const bytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
    const uploaded = await other.storage
      .from("cafe-photos")
      .upload(ownPath, bytes, { contentType: "image/webp" });
    expect(uploaded.error).toBeNull();
    const ownerRead = await owner.storage.from("cafe-photos").download(ownPath);
    expect(ownerRead.error).not.toBeNull();
    const crossUpload = await owner.storage
      .from("cafe-photos")
      .upload(`33333333-3333-4333-8333-333333333333/integration/${crypto.randomUUID()}.webp`, bytes, {
        contentType: "image/webp",
      });
    expect(crossUpload.error).not.toBeNull();
    const removed = await other.storage.from("cafe-photos").remove([ownPath]);
    expect(removed.error).toBeNull();

    const boundaryPath = `33333333-3333-4333-8333-333333333333/integration/${crypto.randomUUID()}.webp`;
    const boundaryUpload = await other.storage
      .from("cafe-photos")
      .upload(boundaryPath, new Uint8Array(3 * 1024 * 1024), { contentType: "image/webp" });
    expect(boundaryUpload.error).toBeNull();
    const tooLarge = await other.storage
      .from("cafe-photos")
      .upload(
        `33333333-3333-4333-8333-333333333333/integration/${crypto.randomUUID()}.webp`,
        new Uint8Array(3 * 1024 * 1024 + 1),
        { contentType: "image/webp" },
      );
    expect(tooLarge.error).not.toBeNull();
    const boundaryRemoved = await other.storage.from("cafe-photos").remove([boundaryPath]);
    expect(boundaryRemoved.error).toBeNull();
  });

  it("rejects inconsistent derived values, invalid hours, and disallowed tags at the database boundary", async () => {
    const saved = await owner.rpc("save_cafe_visit", { p_payload: payload("DB 제약 검증") });
    expect(saved.error).toBeNull();
    createdByOwner.push(saved.data!);

    const manipulatedSnapshot = await owner
      .from("cafe_business_snapshots")
      .update({ occupancy_rate: 1, estimated_daily_sales_base: 1, estimation_model_version: "tampered" })
      .eq("cafe_visit_id", saved.data!)
      .select("occupancy_rate,estimated_daily_sales_base,estimation_model_version")
      .single();
    expect(manipulatedSnapshot.error).toBeNull();
    expect(manipulatedSnapshot.data).toEqual({
      occupancy_rate: 65,
      estimated_daily_sales_base: 728_000,
      estimation_model_version: "mvp-v1",
    });

    const invalidTag = await owner
      .from("cafe_visits")
      .update({ mood_tags: ["허용되지 않은 태그"] })
      .eq("id", saved.data!);
    expect(invalidTag.error).not.toBeNull();

    const invalidHours = await owner.rpc("save_cafe_visit", {
      p_payload: payload("19시간 영업", { openTime: "10:00", closeTime: "05:00" }),
    });
    expect(invalidHours.error).not.toBeNull();
    const partialHours = await owner.rpc("save_cafe_visit", {
      p_payload: payload("부분 영업시간", { openTime: "10:00", closeTime: null }),
    });
    expect(partialHours.error).not.toBeNull();

    // The expand migration must continue to accept an already-open legacy client.
    // Current clients always provide the request id; enforcement belongs in a later
    // contract migration after the application rollout has stabilized.
    const missingRequestId: Record<string, Json | undefined> = payload("구버전 클라이언트 생성");
    delete missingRequestId._createRequestId;
    const missingId = await owner.rpc("save_cafe_visit", { p_payload: missingRequestId });
    expect(missingId.error).toBeNull();
    expect(missingId.data).toMatch(/^[0-9a-f-]{36}$/);
    createdByOwner.push(missingId.data!);
  });

  it("keeps the TypeScript preview and persisted snapshot on the same mvp-v1 contract", async () => {
    const fixtures: Array<{ name: string; input: BusinessEstimatorInput }> = [
      {
        name: "기본",
        input: {
          seatCount: 20,
          currentCustomers: 13,
          occupancyRate: null,
          averageStayMinutes: 60,
          estimatedAverageSpend: 8_000,
          openTime: "10:00",
          closeTime: "22:00",
          operatingDaysPerMonth: 30,
          takeoutLevel: "NONE",
          observedTakeoutOrders: 0,
          observationDurationMinutes: 30,
        },
      },
      {
        name: "0값",
        input: {
          seatCount: 40,
          currentCustomers: 0,
          occupancyRate: null,
          averageStayMinutes: 30,
          estimatedAverageSpend: 1_000,
          openTime: "06:00",
          closeTime: "00:00",
          operatingDaysPerMonth: 1,
          takeoutLevel: "HIGH",
          observedTakeoutOrders: 0,
          observationDurationMinutes: 1,
        },
      },
      {
        name: "정원초과와 자정경계",
        input: {
          seatCount: 20,
          currentCustomers: 24,
          occupancyRate: null,
          averageStayMinutes: 90,
          estimatedAverageSpend: 100_000,
          openTime: "18:00",
          closeTime: "12:00",
          operatingDaysPerMonth: 31,
          takeoutLevel: "LOW",
          observedTakeoutOrders: 10,
          observationDurationMinutes: 10,
        },
      },
      {
        name: "수동점유율",
        input: {
          seatCount: 33,
          currentCustomers: null,
          occupancyRate: 67,
          averageStayMinutes: 150,
          estimatedAverageSpend: 12_000,
          openTime: "10:15",
          closeTime: "18:45",
          operatingDaysPerMonth: 27,
          takeoutLevel: "MEDIUM",
          observedTakeoutOrders: null,
          observationDurationMinutes: 29,
        },
      },
      {
        name: "분단위정밀도",
        input: {
          seatCount: 17,
          currentCustomers: null,
          occupancyRate: 53,
          averageStayMinutes: 90,
          estimatedAverageSpend: 7_700,
          openTime: "10:01",
          closeTime: "21:59",
          operatingDaysPerMonth: 26,
          takeoutLevel: "LOW",
          observedTakeoutOrders: 1,
          observationDurationMinutes: 30,
        },
      },
      {
        name: "정확한 0.5 반올림",
        input: {
          seatCount: 5,
          currentCustomers: null,
          occupancyRate: 96,
          averageStayMinutes: 30,
          estimatedAverageSpend: 10_000,
          openTime: "10:00",
          closeTime: "20:25",
          operatingDaysPerMonth: 30,
          takeoutLevel: null,
          observedTakeoutOrders: 10,
          observationDurationMinutes: 30,
        },
      },
      {
        name: "추정불가",
        input: {
          seatCount: null,
          currentCustomers: null,
          occupancyRate: 25,
          averageStayMinutes: null,
          estimatedAverageSpend: null,
          openTime: null,
          closeTime: null,
          operatingDaysPerMonth: 30,
          takeoutLevel: null,
          observedTakeoutOrders: null,
          observationDurationMinutes: null,
        },
      },
      ...[2, 4, 7].map((observedTakeoutOrders) => ({
        name: `테이크아웃-${observedTakeoutOrders}`,
        input: {
          seatCount: 20,
          currentCustomers: 10,
          occupancyRate: null,
          averageStayMinutes: 60,
          estimatedAverageSpend: 8_000,
          openTime: "10:00",
          closeTime: "22:00",
          operatingDaysPerMonth: 30,
          takeoutLevel: "HIGH" as const,
          observedTakeoutOrders,
          observationDurationMinutes: 30,
        },
      })),
    ];

    for (const fixture of fixtures) {
      const expected = estimateBusiness(fixture.input);
      const saved = await owner.rpc("save_cafe_visit", {
        p_payload: payload(`계약 ${fixture.name}`, {
          seatCount: fixture.input.seatCount,
          currentCustomers: fixture.input.currentCustomers,
          occupancyRate: fixture.input.occupancyRate,
          averageStayMinutes: fixture.input.averageStayMinutes,
          estimatedAverageSpend: fixture.input.estimatedAverageSpend,
          openTime: fixture.input.openTime,
          closeTime: fixture.input.closeTime,
          operatingDaysPerMonth: fixture.input.operatingDaysPerMonth,
          takeoutLevel: fixture.input.takeoutLevel,
          observedTakeoutOrders: fixture.input.observedTakeoutOrders,
          observationDurationMinutes: fixture.input.observationDurationMinutes,
        }),
      });
      expect(saved.error).toBeNull();
      createdByOwner.push(saved.data!);

      const { data: snapshot, error } = await owner
        .from("cafe_business_snapshots")
        .select(
          "occupancy_rate,operating_hours,estimated_seat_turns_per_hour,estimated_customers_per_hour,takeout_adjustment_rate,estimated_daily_customers_low,estimated_daily_customers_base,estimated_daily_customers_high,estimated_daily_sales_low,estimated_daily_sales_base,estimated_daily_sales_high,estimated_monthly_sales_low,estimated_monthly_sales_base,estimated_monthly_sales_high,confidence_score,confidence_level,estimation_model_version",
        )
        .eq("cafe_visit_id", saved.data!)
        .single();
      expect(error).toBeNull();
      expect(snapshot!.occupancy_rate).toBe(expected.occupancyRate);
      if (expected.operatingHours === null) expect(snapshot!.operating_hours).toBeNull();
      else expect(snapshot!.operating_hours).toBeCloseTo(expected.operatingHours, 3);
      if (expected.estimatedSeatTurnsPerHour === null)
        expect(snapshot!.estimated_seat_turns_per_hour).toBeNull();
      else expect(snapshot!.estimated_seat_turns_per_hour).toBeCloseTo(expected.estimatedSeatTurnsPerHour, 5);
      if (expected.estimatedCustomersPerHour === null)
        expect(snapshot!.estimated_customers_per_hour).toBeNull();
      else expect(snapshot!.estimated_customers_per_hour).toBeCloseTo(expected.estimatedCustomersPerHour, 5);
      expect(snapshot!.takeout_adjustment_rate).toBe(expected.takeoutAdjustmentRate);
      expect(snapshot!.estimated_daily_customers_low).toBe(expected.scenarios.low?.customers ?? null);
      expect(snapshot!.estimated_daily_customers_base).toBe(expected.scenarios.base?.customers ?? null);
      expect(snapshot!.estimated_daily_customers_high).toBe(expected.scenarios.high?.customers ?? null);
      expect(snapshot!.estimated_daily_sales_low).toBe(expected.scenarios.low?.dailySales ?? null);
      expect(snapshot!.estimated_daily_sales_base).toBe(expected.scenarios.base?.dailySales ?? null);
      expect(snapshot!.estimated_daily_sales_high).toBe(expected.scenarios.high?.dailySales ?? null);
      expect(snapshot!.estimated_monthly_sales_low).toBe(expected.scenarios.low?.monthlySales ?? null);
      expect(snapshot!.estimated_monthly_sales_base).toBe(expected.scenarios.base?.monthlySales ?? null);
      expect(snapshot!.estimated_monthly_sales_high).toBe(expected.scenarios.high?.monthlySales ?? null);
      expect(snapshot!.confidence_score).toBe(expected.confidenceScore);
      expect(snapshot!.confidence_level).toBe(expected.confidenceLevel);
      expect(snapshot!.estimation_model_version).toBe(expected.estimationModelVersion);
    }
  });

  it("serializes photo finalization and exposes only validated photo mutation RPCs", async () => {
    const saved = await owner.rpc("save_cafe_visit", { p_payload: payload("사진 경계") });
    expect(saved.error).toBeNull();
    createdByOwner.push(saved.data!);

    const paths = Array.from({ length: 4 }, () => `${ownerId}/${saved.data!}/${crypto.randomUUID()}.webp`);
    ownerStoragePaths.push(...paths);
    for (const path of paths) {
      const uploaded = await owner.storage.from("cafe-photos").upload(path, validWebp, {
        contentType: "image/webp",
      });
      expect(uploaded.error).toBeNull();
    }

    const finalize = (path: string, sortOrder: number) =>
      owner.rpc("finalize_cafe_photo", {
        p_visit_id: saved.data!,
        p_kind: "MENU_BOARD",
        p_object_path: path,
        p_mime_type: "image/webp",
        p_size_bytes: validWebp.byteLength,
        p_width: 1,
        p_height: 1,
        p_sort_order: sortOrder,
      });

    const forgedMime = await owner.rpc("finalize_cafe_photo", {
      p_visit_id: saved.data!,
      p_kind: "MENU_BOARD",
      p_object_path: paths[0],
      p_mime_type: "image/png",
      p_size_bytes: validWebp.byteLength,
      p_width: 1,
      p_height: 1,
      p_sort_order: 0,
    });
    const forgedSize = await owner.rpc("finalize_cafe_photo", {
      p_visit_id: saved.data!,
      p_kind: "MENU_BOARD",
      p_object_path: paths[0],
      p_mime_type: "image/webp",
      p_size_bytes: validWebp.byteLength + 1,
      p_width: 1,
      p_height: 1,
      p_sort_order: 0,
    });
    const wrongVisitPath = await owner.rpc("finalize_cafe_photo", {
      p_visit_id: saved.data!,
      p_kind: "MENU_BOARD",
      p_object_path: `${ownerId}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/wrong.webp`,
      p_mime_type: "image/webp",
      p_size_bytes: validWebp.byteLength,
      p_width: 1,
      p_height: 1,
      p_sort_order: 0,
    });
    expect(forgedMime.error).not.toBeNull();
    expect(forgedSize.error).not.toBeNull();
    expect(wrongVisitPath.error).not.toBeNull();

    const first = await finalize(paths[0], 0);
    const second = await finalize(paths[1], 1);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const concurrent = await Promise.all([finalize(paths[2], 2), finalize(paths[3], 2)]);
    expect(concurrent.filter((result) => result.error === null)).toHaveLength(1);
    expect(concurrent.filter((result) => result.error !== null)).toHaveLength(1);

    const directInsert = await owner.from("cafe_photos").insert({
      owner_id: ownerId,
      cafe_visit_id: saved.data!,
      kind: "GENERAL",
      object_path: `${ownerId}/${saved.data!}/missing.webp`,
      mime_type: "image/webp",
      size_bytes: 1,
      width: 1,
      height: 1,
      sort_order: 0,
    });
    expect(directInsert.error).not.toBeNull();

    const missingObject = await finalize(`${ownerId}/${saved.data!}/${crypto.randomUUID()}.webp`, 0);
    expect(missingObject.error).not.toBeNull();

    const { data: photos } = await owner
      .from("cafe_photos")
      .select("id,sort_order")
      .eq("cafe_visit_id", saved.data!)
      .eq("kind", "MENU_BOARD")
      .order("sort_order");
    expect(photos).toHaveLength(3);

    const incompleteReorder = await owner.rpc("reorder_cafe_photos", {
      p_visit_id: saved.data!,
      p_kind: "MENU_BOARD",
      p_photo_ids: photos!.slice(0, 2).map((photo) => photo.id),
    });
    expect(incompleteReorder.error).not.toBeNull();

    const reversed = photos!.map((photo) => photo.id).reverse();
    const reordered = await owner.rpc("reorder_cafe_photos", {
      p_visit_id: saved.data!,
      p_kind: "MENU_BOARD",
      p_photo_ids: reversed,
    });
    expect(reordered.error).toBeNull();
    const { data: afterReorder } = await owner
      .from("cafe_photos")
      .select("id")
      .eq("cafe_visit_id", saved.data!)
      .eq("kind", "MENU_BOARD")
      .order("sort_order");
    expect(afterReorder?.map((photo) => photo.id)).toEqual(reversed);

    const representativeQuery = await owner
      .from("cafe_visits")
      .select("id,photos:cafe_photos(id,kind,sort_order)")
      .eq("id", saved.data!)
      .order("kind", { referencedTable: "cafe_photos", ascending: true })
      .order("sort_order", { referencedTable: "cafe_photos", ascending: true })
      .limit(1, { referencedTable: "cafe_photos" })
      .single();
    expect(representativeQuery.error).toBeNull();
    expect(representativeQuery.data?.photos).toEqual([
      { id: reversed[0], kind: "MENU_BOARD", sort_order: 0 },
    ]);

    const directUpdate = await owner.from("cafe_photos").update({ sort_order: 2 }).eq("id", reversed[0]);
    const directDelete = await owner.from("cafe_photos").delete().eq("id", reversed[0]);
    expect(directUpdate.error).not.toBeNull();
    expect(directDelete.error).not.toBeNull();

    const removed = await owner
      .rpc("remove_cafe_photo", { p_photo_id: reversed[0], p_visit_id: saved.data! })
      .single();
    expect(removed.error).toBeNull();
    expect(removed.data?.object_path).toMatch(new RegExp(`^${ownerId}/${saved.data!}/`));
  });

  it("isolates P1 occupancy observations by visit owner", async () => {
    const ownerVisit = await owner.rpc("save_cafe_visit", { p_payload: payload("관찰 소유자") });
    const otherVisit = await other.rpc("save_cafe_visit", { p_payload: payload("관찰 격리 계정") });
    expect(ownerVisit.error).toBeNull();
    expect(otherVisit.error).toBeNull();
    createdByOwner.push(ownerVisit.data!);
    createdByOther.push(otherVisit.data!);

    const ownObservation = await owner.from("visit_occupancy_observations").insert({
      owner_id: "11111111-1111-4111-8111-111111111111",
      cafe_visit_id: ownerVisit.data!,
      observed_at: "2026-08-18T06:00:00.000Z",
      current_customers: 10,
      occupancy_rate: 50,
    });
    expect(ownObservation.error).toBeNull();

    const crossObservation = await owner.from("visit_occupancy_observations").insert({
      owner_id: "11111111-1111-4111-8111-111111111111",
      cafe_visit_id: otherVisit.data!,
      observed_at: "2026-08-18T06:00:00.000Z",
      current_customers: 10,
      occupancy_rate: 50,
    });
    expect(crossObservation.error).not.toBeNull();

    const { count } = await other
      .from("visit_occupancy_observations")
      .select("id", { count: "exact", head: true })
      .eq("cafe_visit_id", ownerVisit.data!);
    expect(count).toBe(0);
  });
});
