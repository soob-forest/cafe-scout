import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const result = spawnSync("supabase", ["gen", "types", "typescript", "--local"], {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "inherit"],
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  const databaseTypesUrl = new URL("../src/types/database.ts", import.meta.url);
  writeFileSync(databaseTypesUrl, `${result.stdout.trimEnd()}\n`);
}
