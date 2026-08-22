export type PhotoInventory = {
  version: 1;
  objectCount: number;
  objectPaths: string[];
};

export function normalizeQueryResult(value: unknown): string[];
export function verifyPhotoInventory(
  beforePath: string,
  afterPath: string,
  storageDirectory: string,
  outputPath: string,
): PhotoInventory;
