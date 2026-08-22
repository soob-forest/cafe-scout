// @vitest-environment node

import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createBackupManifest, verifyBackupManifest } from "../../scripts/backup-manifest.mjs";
import { normalizeQueryResult, verifyPhotoInventory } from "../../scripts/photo-inventory.mjs";
import { assertSupabaseTarget, extractProjectRef } from "../../scripts/verify-supabase-target.mjs";

const sourceRef = "abcdefghijklmnopqrst";
const targetRef = "1234567890abcdefghij";

function writePhotoInventory(backupDir: string, objectPaths: string[]) {
  writeFileSync(
    join(backupDir, "photo-paths.json"),
    `${JSON.stringify({ version: 1, objectCount: objectPaths.length, objectPaths }, null, 2)}\n`,
  );
}

describe("Supabase backup and restore target guard", () => {
  it("extracts project refs from direct and pooler DB URLs", () => {
    expect(extractProjectRef(`postgresql://postgres:secret@db.${sourceRef}.supabase.co:5432/postgres`)).toBe(
      sourceRef,
    );
    expect(
      extractProjectRef(
        `postgresql://postgres.${sourceRef}:secret@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`,
      ),
    ).toBe(sourceRef);
  });

  it("requires the DB URL, explicit ref, and linked Storage ref to match", () => {
    expect(() =>
      assertSupabaseTarget({
        dbUrl: `postgresql://postgres:secret@db.${sourceRef}.supabase.co:5432/postgres`,
        expectedProjectRef: sourceRef,
        linkedProjectRef: targetRef,
      }),
    ).toThrow(/linked Storage project/i);
  });

  it("stops a mismatched hosted backup before creating output", () => {
    const temp = mkdtempSync(join(tmpdir(), "cafe-scout-target-"));
    const linkedFile = join(temp, "project-ref");
    const backupDir = join(temp, "backup");
    writeFileSync(linkedFile, `${targetRef}\n`);

    const result = spawnSync("bash", [resolve("scripts/backup.sh"), backupDir], {
      cwd: resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        SUPABASE_DB_URL: `postgresql://postgres:secret@db.${sourceRef}.supabase.co:5432/postgres`,
        SUPABASE_PROJECT_REF: sourceRef,
        SUPABASE_LINKED_REF_FILE: linkedFile,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/linked Storage project/i);
    expect(existsSync(backupDir)).toBe(false);
  });

  it("rejects a non-empty backup directory", () => {
    const temp = mkdtempSync(join(tmpdir(), "cafe-scout-backup-"));
    mkdirSync(join(temp, "backup"));
    writeFileSync(join(temp, "backup", "stale.sql"), "stale");
    const result = spawnSync("bash", [resolve("scripts/backup.sh"), join(temp, "backup")], {
      cwd: resolve("."),
      encoding: "utf8",
      env: { ...process.env, SUPABASE_TARGET: "local" },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/must not exist or must be empty/i);
  });

  it("creates and verifies a complete backup manifest and detects tampering", async () => {
    const temp = mkdtempSync(join(tmpdir(), "cafe-scout-manifest-"));
    const backupDir = join(temp, "backup");
    mkdirSync(join(backupDir, "storage", "cafe-photos"), { recursive: true });
    for (const filename of ["roles.sql", "schema.sql", "data.sql"])
      writeFileSync(join(backupDir, filename), `-- ${filename}\n`);
    writeFileSync(join(backupDir, "storage", "cafe-photos", "photo.webp"), "webp");
    writePhotoInventory(backupDir, ["photo.webp"]);

    const created = await createBackupManifest(backupDir, sourceRef);
    expect(created.storageObjectCount).toBe(1);
    expect(created.databasePhotoCount).toBe(1);
    await expect(verifyBackupManifest(backupDir)).resolves.toMatchObject({ sourceProjectRef: sourceRef });

    writeFileSync(join(backupDir, "data.sql"), "tampered");
    await expect(verifyBackupManifest(backupDir)).rejects.toThrow(/integrity verification/i);
  });

  it("stops an incomplete restore before invoking database or Storage tools", () => {
    const temp = mkdtempSync(join(tmpdir(), "cafe-scout-incomplete-"));
    const backupDir = join(temp, "backup");
    mkdirSync(join(backupDir, "storage", "cafe-photos"), { recursive: true });
    for (const filename of ["roles.sql", "schema.sql", "data.sql"])
      writeFileSync(join(backupDir, filename), `-- ${filename}\n`);

    const result = spawnSync("bash", [resolve("scripts/restore.sh"), backupDir], {
      cwd: resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        SUPABASE_TARGET: "local",
        CONFIRM_RESTORE: "yes",
        RESTORE_DATA_ONLY: "yes",
        SUPABASE_DB_CONTAINER: "must-not-be-invoked",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/manifest|photo-paths/i);
  });

  it("stops a mismatched restore before invoking database or Storage tools", async () => {
    const temp = mkdtempSync(join(tmpdir(), "cafe-scout-restore-"));
    const linkedFile = join(temp, "project-ref");
    const backupDir = join(temp, "backup");
    mkdirSync(join(backupDir, "storage", "cafe-photos"), { recursive: true });
    for (const filename of ["roles.sql", "schema.sql", "data.sql"])
      writeFileSync(join(backupDir, filename), `-- ${filename}\n`);
    writePhotoInventory(backupDir, []);
    await createBackupManifest(backupDir, sourceRef);
    writeFileSync(linkedFile, `${sourceRef}\n`);

    const result = spawnSync("bash", [resolve("scripts/restore.sh"), backupDir], {
      cwd: resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        CONFIRM_RESTORE: "yes",
        CONFIRM_RESTORE_PROJECT_REF: targetRef,
        TARGET_SUPABASE_DB_URL: `postgresql://postgres:secret@db.${targetRef}.supabase.co:5432/postgres`,
        TARGET_SUPABASE_PROJECT_REF: targetRef,
        SUPABASE_LINKED_REF_FILE: linkedFile,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/linked Storage project/i);
  });

  it("normalizes database photo query output and verifies a stable DB/Storage inventory", () => {
    const temp = mkdtempSync(join(tmpdir(), "cafe-scout-photo-inventory-"));
    const before = join(temp, "before.txt");
    const after = join(temp, "after.txt");
    const storage = join(temp, "storage");
    const output = join(temp, "photo-paths.json");
    const objectPath = "owner/visit/photo.webp";
    mkdirSync(join(storage, "owner", "visit"), { recursive: true });
    writeFileSync(join(storage, objectPath), "webp");
    writeFileSync(before, `${objectPath}\n`);
    writeFileSync(after, `${objectPath}\n`);

    expect(normalizeQueryResult({ rows: [{ object_path: objectPath }] })).toEqual([objectPath]);
    expect(verifyPhotoInventory(before, after, storage, output)).toMatchObject({
      objectCount: 1,
      objectPaths: [objectPath],
    });
    expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({ objectCount: 1 });
  });

  it("rejects photo changes during backup and DB/Storage divergence", () => {
    const temp = mkdtempSync(join(tmpdir(), "cafe-scout-photo-drift-"));
    const before = join(temp, "before.txt");
    const after = join(temp, "after.txt");
    const storage = join(temp, "storage");
    mkdirSync(storage);
    writeFileSync(before, "owner/visit/before.webp\n");
    writeFileSync(after, "owner/visit/after.webp\n");

    expect(() => verifyPhotoInventory(before, after, storage, join(temp, "changed.json"))).toThrow(
      /changed while the backup was running/i,
    );

    writeFileSync(after, "owner/visit/before.webp\n");
    expect(() => verifyPhotoInventory(before, after, storage, join(temp, "missing.json"))).toThrow(
      /do not match/i,
    );
  });
});
