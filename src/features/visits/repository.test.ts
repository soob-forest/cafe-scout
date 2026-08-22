import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { listCafeOptions, listVisits, RepositoryError } from "./repository";

vi.mock("server-only", () => ({}));

type Client = SupabaseClient<Database>;

function photo(id: string, path: string, kind: "GENERAL" | "MENU_BOARD", sortOrder: number) {
  return {
    id,
    owner_id: "11111111-1111-4111-8111-111111111111",
    cafe_visit_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    kind,
    bucket: "cafe-photos",
    object_path: path,
    mime_type: "image/webp",
    size_bytes: 10,
    width: 1,
    height: 1,
    sort_order: sortOrder,
    created_at: "2026-08-19T00:00:00.000Z",
  } as const;
}

function listClient({
  rows,
  queryError = null,
  signingError = null,
}: {
  rows: unknown[];
  queryError?: { message: string } | null;
  signingError?: { message: string } | null;
}) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: queryError });
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    limit,
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const createSignedUrls = vi.fn().mockImplementation(async (paths: string[]) => ({
    data: signingError ? null : paths.map((path) => ({ path, signedUrl: `signed:${path}` })),
    error: signingError,
  }));
  const client = {
    from: vi.fn(() => query),
    storage: { from: vi.fn(() => ({ createSignedUrls })) },
  } as unknown as Client;
  return { client, query, limit, createSignedUrls };
}

describe("visit repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("limits each visit to its ordered representative photo before signing", async () => {
    const representative = photo("photo-1", "owner/visit/general.webp", "GENERAL", 0);
    const { client, query, limit, createSignedUrls } = listClient({
      rows: [
        {
          id: "visit-1",
          cafe: { id: "cafe-1", name: "카페", region: "서울" },
          snapshot: null,
          photos: [representative],
        },
      ],
    });

    const visits = await listVisits(client);

    expect(query.order).toHaveBeenNthCalledWith(2, "kind", {
      referencedTable: "cafe_photos",
      ascending: true,
    });
    expect(query.order).toHaveBeenNthCalledWith(3, "sort_order", {
      referencedTable: "cafe_photos",
      ascending: true,
    });
    expect(limit).toHaveBeenCalledWith(1, { referencedTable: "cafe_photos" });
    expect(createSignedUrls).toHaveBeenCalledWith([representative.object_path], 300);
    expect(visits[0]?.photos).toEqual([
      { ...representative, signedUrl: `signed:${representative.object_path}` },
    ]);
  });

  it("turns a signed URL failure into a retryable repository error", async () => {
    const { client } = listClient({
      rows: [
        {
          id: "visit-1",
          cafe: { id: "cafe-1", name: "카페", region: "서울" },
          snapshot: null,
          photos: [photo("photo-1", "owner/visit/general.webp", "GENERAL", 0)],
        },
      ],
      signingError: { message: "storage unavailable" },
    });

    await expect(listVisits(client)).rejects.toEqual(expect.any(RepositoryError));
  });

  it("does not silently discard a recent-visit query failure", async () => {
    const cafesQuery = { select: vi.fn(), order: vi.fn() };
    cafesQuery.select.mockReturnValue(cafesQuery);
    cafesQuery.order.mockResolvedValue({
      data: [{ id: "cafe-1", name: "카페", region: "서울" }],
      error: null,
    });
    const recentQuery = { select: vi.fn(), order: vi.fn() };
    recentQuery.select.mockReturnValue(recentQuery);
    recentQuery.order.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    const client = {
      from: vi.fn().mockReturnValueOnce(cafesQuery).mockReturnValueOnce(recentQuery),
    } as unknown as Client;

    await expect(listCafeOptions(client)).rejects.toEqual(expect.any(RepositoryError));
  });
});
