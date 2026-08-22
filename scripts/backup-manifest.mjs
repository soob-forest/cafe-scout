#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, lstatSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const PROJECT_REF = /^[a-z0-9]{20}$/;
const REQUIRED_SQL = ["roles.sql", "schema.sql", "data.sql"];
const MANIFEST_NAME = "manifest.json";
const PHOTO_INVENTORY_NAME = "photo-paths.json";

function relativeFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (lstatSync(fullPath).isSymbolicLink())
      throw new Error("Backup directories must not contain symbolic links.");
    if (entry.isDirectory()) return relativeFiles(root, fullPath);
    if (!entry.isFile()) throw new Error(`Unsupported backup entry: ${entry.name}`);
    const path = relative(root, fullPath).split(sep).join("/");
    return path === MANIFEST_NAME ? [] : [path];
  });
}

function sha256(path) {
  return new Promise((resolveDigest, rejectDigest) => {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    input.on("error", rejectDigest);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolveDigest(hash.digest("hex")));
  });
}

function assertBackupShape(root) {
  for (const filename of REQUIRED_SQL) {
    const path = join(root, filename);
    if (!statSync(path, { throwIfNoEntry: false })?.isFile() || statSync(path).size === 0) {
      throw new Error(`Required backup file is missing or empty: ${filename}`);
    }
  }
  if (!statSync(join(root, "storage", "cafe-photos"), { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error("Required backup Storage directory is missing: storage/cafe-photos");
  }
  if (!statSync(join(root, PHOTO_INVENTORY_NAME), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Required backup file is missing: ${PHOTO_INVENTORY_NAME}`);
  }
}

function assertStorageObjectTypes(paths) {
  const unsupportedStoragePath = paths.find(
    (path) => path.startsWith("storage/cafe-photos/") && !/\.(?:jpe?g|png|webp)$/i.test(path),
  );
  if (unsupportedStoragePath) {
    throw new Error(`Unsupported backup Storage object type: ${unsupportedStoragePath}`);
  }
}

function assertPhotoInventory(root, paths) {
  let inventory;
  try {
    inventory = JSON.parse(readFileSync(join(root, PHOTO_INVENTORY_NAME), "utf8"));
  } catch {
    throw new Error("Backup photo inventory is missing or invalid.");
  }
  if (
    inventory?.version !== 1 ||
    !Number.isInteger(inventory.objectCount) ||
    inventory.objectCount < 0 ||
    !Array.isArray(inventory.objectPaths) ||
    inventory.objectPaths.some((path) => typeof path !== "string") ||
    new Set(inventory.objectPaths).size !== inventory.objectPaths.length
  ) {
    throw new Error("Backup photo inventory metadata is invalid.");
  }
  const databasePaths = [...inventory.objectPaths].sort();
  const storagePaths = paths
    .filter((path) => path.startsWith("storage/cafe-photos/"))
    .map((path) => path.slice("storage/cafe-photos/".length))
    .sort();
  if (
    inventory.objectCount !== databasePaths.length ||
    JSON.stringify(databasePaths) !== JSON.stringify(storagePaths)
  ) {
    throw new Error("Database photo inventory and backup Storage objects do not match.");
  }
  return inventory;
}

async function describeFiles(root, paths) {
  const files = [];
  for (const path of paths) {
    const fullPath = join(root, path);
    const stats = statSync(fullPath);
    files.push({ path, sizeBytes: stats.size, sha256: await sha256(fullPath) });
  }
  return files;
}

export async function createBackupManifest(backupDirectory, sourceProjectRef) {
  const root = resolve(backupDirectory);
  if (sourceProjectRef !== "local" && !PROJECT_REF.test(sourceProjectRef)) {
    throw new Error("The source project ref must be 'local' or 20 lowercase letters or digits.");
  }
  assertBackupShape(root);
  const paths = relativeFiles(root).sort();
  assertStorageObjectTypes(paths);
  const photoInventory = assertPhotoInventory(root, paths);
  const files = await describeFiles(root, paths);
  const manifest = {
    version: 2,
    sourceProjectRef,
    createdAt: new Date().toISOString(),
    storageObjectCount: files.filter(({ path }) => path.startsWith("storage/cafe-photos/")).length,
    databasePhotoCount: photoInventory.objectCount,
    files,
  };
  writeFileSync(join(root, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return manifest;
}

export async function verifyBackupManifest(backupDirectory) {
  const root = resolve(backupDirectory);
  assertBackupShape(root);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(root, MANIFEST_NAME), "utf8"));
  } catch {
    throw new Error("Backup manifest is missing or invalid.");
  }
  if (
    manifest?.version !== 2 ||
    (manifest.sourceProjectRef !== "local" && !PROJECT_REF.test(manifest.sourceProjectRef ?? "")) ||
    typeof manifest.createdAt !== "string" ||
    !Number.isInteger(manifest.storageObjectCount) ||
    !Number.isInteger(manifest.databasePhotoCount) ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error("Backup manifest metadata is invalid.");
  }
  const expectedPaths = manifest.files.map((file) => file?.path);
  if (
    manifest.files.some(
      (file) =>
        !file ||
        typeof file.path !== "string" ||
        !Number.isInteger(file.sizeBytes) ||
        file.sizeBytes < 0 ||
        !/^[a-f0-9]{64}$/.test(file.sha256 ?? ""),
    ) ||
    new Set(expectedPaths).size !== expectedPaths.length
  ) {
    throw new Error("Backup manifest file list is invalid.");
  }
  const actualPaths = relativeFiles(root).sort();
  if (JSON.stringify([...expectedPaths].sort()) !== JSON.stringify(actualPaths)) {
    throw new Error("Backup files do not match the manifest file list.");
  }
  assertStorageObjectTypes(actualPaths);
  const photoInventory = assertPhotoInventory(root, actualPaths);
  const actualFiles = await describeFiles(root, actualPaths);
  const expectedByPath = new Map(manifest.files.map((file) => [file.path, file]));
  for (const actual of actualFiles) {
    const expected = expectedByPath.get(actual.path);
    if (actual.sizeBytes !== expected.sizeBytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Backup file failed integrity verification: ${actual.path}`);
    }
  }
  const storageObjectCount = actualPaths.filter((path) => path.startsWith("storage/cafe-photos/")).length;
  if (storageObjectCount !== manifest.storageObjectCount) {
    throw new Error("Backup Storage object count does not match the manifest.");
  }
  if (photoInventory.objectCount !== manifest.databasePhotoCount) {
    throw new Error("Backup database photo count does not match the manifest.");
  }
  return manifest;
}

async function runCli() {
  const [command, backupDirectory, sourceProjectRef] = process.argv.slice(2);
  if (command === "create" && backupDirectory && sourceProjectRef) {
    const manifest = await createBackupManifest(backupDirectory, sourceProjectRef);
    process.stdout.write(
      `Created backup manifest for ${manifest.sourceProjectRef} with ${manifest.storageObjectCount} Storage objects.\n`,
    );
    return;
  }
  if (command === "verify" && backupDirectory) {
    const manifest = await verifyBackupManifest(backupDirectory);
    process.stdout.write(
      `Verified backup manifest from ${manifest.sourceProjectRef} with ${manifest.storageObjectCount} Storage objects.\n`,
    );
    return;
  }
  throw new Error("Usage: backup-manifest.mjs <create|verify> <backup-directory> [source-project-ref]");
}

if (process.argv[1]?.endsWith("backup-manifest.mjs")) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Backup manifest operation failed."}\n`);
    process.exitCode = 1;
  });
}
