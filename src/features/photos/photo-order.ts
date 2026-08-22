import type { PhotoKind } from "@/domain/types";

export function availablePhotoSortOrders(
  usedOrders: Iterable<number>,
  limit: number,
  count: number,
): number[] {
  const used = new Set(usedOrders);
  return Array.from({ length: limit }, (_, sortOrder) => sortOrder)
    .filter((sortOrder) => !used.has(sortOrder))
    .slice(0, count);
}

export function swapPendingPhotoOrder<T extends { id: string; kind: PhotoKind; sortOrder: number }>(
  photos: T[],
  id: string,
  kind: PhotoKind,
  direction: -1 | 1,
): T[] {
  const ordered = photos.filter((photo) => photo.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((photo) => photo.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return photos;

  const sourceOrder = ordered[index].sortOrder;
  const targetOrder = ordered[target].sortOrder;
  return photos.map((photo) => {
    if (photo.id === ordered[index].id) return { ...photo, sortOrder: targetOrder };
    if (photo.id === ordered[target].id) return { ...photo, sortOrder: sourceOrder };
    return photo;
  });
}
