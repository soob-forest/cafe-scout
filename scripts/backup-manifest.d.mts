export type BackupManifest = {
  version: 2;
  sourceProjectRef: string;
  createdAt: string;
  storageObjectCount: number;
  databasePhotoCount: number;
  files: Array<{ path: string; sizeBytes: number; sha256: string }>;
};

export function createBackupManifest(
  backupDirectory: string,
  sourceProjectRef: string,
): Promise<BackupManifest>;
export function verifyBackupManifest(backupDirectory: string): Promise<BackupManifest>;
