#!/usr/bin/env node

import { readFileSync } from "node:fs";

const PROJECT_REF = /^[a-z0-9]{20}$/;

export function extractProjectRef(dbUrl) {
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("The Supabase DB URL is not a valid URL.");
  }

  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname)?.[1];
  const pooler = /^postgres\.([a-z0-9]{20})$/.exec(decodeURIComponent(parsed.username))?.[1];
  const projectRef = direct ?? pooler;
  if (!projectRef) throw new Error("Could not derive a Supabase project ref from the DB URL.");
  return projectRef;
}

export function assertSupabaseTarget({ dbUrl, expectedProjectRef, linkedProjectRef }) {
  if (!PROJECT_REF.test(expectedProjectRef))
    throw new Error("The explicit Supabase project ref must be 20 lowercase letters or digits.");
  if (!PROJECT_REF.test(linkedProjectRef))
    throw new Error("The currently linked Supabase project ref is missing or invalid.");

  const dbProjectRef = extractProjectRef(dbUrl);
  if (dbProjectRef !== expectedProjectRef)
    throw new Error("The DB URL project ref does not match the explicitly confirmed project ref.");
  if (linkedProjectRef !== expectedProjectRef)
    throw new Error("The CLI-linked Storage project does not match the explicitly confirmed project ref.");
  return expectedProjectRef;
}

function runCli() {
  const [dbUrlEnvName, projectRefEnvName] = process.argv.slice(2);
  if (!dbUrlEnvName || !projectRefEnvName)
    throw new Error("Usage: verify-supabase-target.mjs <db-url-env-name> <project-ref-env-name>");

  const dbUrl = process.env[dbUrlEnvName] ?? "";
  const expectedProjectRef = process.env[projectRefEnvName] ?? "";
  const linkedRefFile = process.env.SUPABASE_LINKED_REF_FILE ?? "supabase/.temp/project-ref";
  let linkedProjectRef = "";
  try {
    linkedProjectRef = readFileSync(linkedRefFile, "utf8").trim();
  } catch {
    throw new Error(
      `Could not read the CLI-linked project ref from ${linkedRefFile}. Run supabase link first.`,
    );
  }

  const verified = assertSupabaseTarget({ dbUrl, expectedProjectRef, linkedProjectRef });
  process.stdout.write(`Verified Supabase DB and Storage target: ${verified}\n`);
}

if (process.argv[1]?.endsWith("verify-supabase-target.mjs")) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Supabase target verification failed."}\n`,
    );
    process.exitCode = 1;
  }
}
