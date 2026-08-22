#!/usr/bin/env node

import { lstatSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const SUPPORTED_PHOTO = /\.(?:jpe?g|png|webp)$/i;

function assertObjectPath(path) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").includes("..") ||
    !SUPPORTED_PHOTO.test(path)
  ) {
    throw new Error(`Invalid photo object path in database inventory: ${String(path)}`);
  }
}

function normalizedPaths(paths) {
  paths.forEach(assertObjectPath);
  const sorted = [...paths].sort();
  if (new Set(sorted).size !== sorted.length)
    throw new Error("Photo inventory contains duplicate object paths.");
  return sorted;
}

function readLineInventory(path) {
  const body = readFileSync(path, "utf8");
  return normalizedPaths(body.split(/\r?\n/).filter(Boolean));
}

function storageFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (lstatSync(fullPath).isSymbolicLink())
      throw new Error("Storage backup must not contain symbolic links.");
    if (entry.isDirectory()) return storageFiles(root, fullPath);
    if (!entry.isFile()) throw new Error(`Unsupported Storage backup entry: ${entry.name}`);
    return [relative(root, fullPath).split(sep).join("/")];
  });
}

export function normalizeQueryResult(value) {
  if (!value || !Array.isArray(value.rows))
    throw new Error("Database photo inventory query returned invalid JSON.");
  return normalizedPaths(value.rows.map((row) => row?.object_path));
}

export function verifyPhotoInventory(beforePath, afterPath, storageDirectory, outputPath) {
  const before = readLineInventory(resolve(beforePath));
  const after = readLineInventory(resolve(afterPath));
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("Photo metadata changed while the backup was running; discard this backup and retry.");
  }

  const storageRoot = resolve(storageDirectory);
  if (!statSync(storageRoot, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error("Storage backup directory is missing.");
  }
  const stored = normalizedPaths(storageFiles(storageRoot));
  if (JSON.stringify(before) !== JSON.stringify(stored)) {
    throw new Error("Database photo metadata and backed-up Storage objects do not match.");
  }

  const inventory = { version: 1, objectCount: before.length, objectPaths: before };
  writeFileSync(resolve(outputPath), `${JSON.stringify(inventory, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return inventory;
}

async function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "normalize" && args.length === 0) {
    let body = "";
    for await (const chunk of process.stdin) body += chunk;
    const paths = normalizeQueryResult(JSON.parse(body));
    process.stdout.write(paths.length ? `${paths.join("\n")}\n` : "");
    return;
  }
  if (command === "verify" && args.length === 4) {
    const inventory = verifyPhotoInventory(args[0], args[1], args[2], args[3]);
    process.stdout.write(`Verified ${inventory.objectCount} database-backed Storage objects.\n`);
    return;
  }
  throw new Error(
    "Usage: photo-inventory.mjs normalize | verify <before> <after> <storage-directory> <output-json>",
  );
}

if (process.argv[1]?.endsWith("photo-inventory.mjs")) {
  runCli().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Photo inventory verification failed."}\n`,
    );
    process.exitCode = 1;
  });
}
