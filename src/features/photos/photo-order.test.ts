import { describe, expect, it } from "vitest";
import { availablePhotoSortOrders, swapPendingPhotoOrder } from "./photo-order";

describe("photo ordering", () => {
  it("allocates stable free slots and fills gaps without exceeding the limit", () => {
    expect(availablePhotoSortOrders([0, 2], 3, 2)).toEqual([1]);
    expect(availablePhotoSortOrders([1], 3, 2)).toEqual([0, 2]);
  });

  it("swaps only the selected kind while preserving stable sort slots", () => {
    const photos = [
      { id: "a", kind: "GENERAL" as const, sortOrder: 2 },
      { id: "menu", kind: "MENU_BOARD" as const, sortOrder: 0 },
      { id: "b", kind: "GENERAL" as const, sortOrder: 4 },
    ];

    expect(swapPendingPhotoOrder(photos, "b", "GENERAL", -1)).toEqual([
      { id: "a", kind: "GENERAL", sortOrder: 4 },
      { id: "menu", kind: "MENU_BOARD", sortOrder: 0 },
      { id: "b", kind: "GENERAL", sortOrder: 2 },
    ]);
  });
});
