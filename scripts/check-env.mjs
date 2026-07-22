#!/usr/bin/env node
/**
 * Pre-deploy environment check.  Run:  npm run check-env
 *
 * Reads .env.local when present so it works locally, and otherwise validates
 * whatever is already in the process environment (CI / hosting dashboard).
 */
import { readFileSync, existsSync } from "node:fs";
import { checkEnv } from "../lib/env-check.js";

// Minimal .env parser — avoids pulling in dotenv for a single script.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

const { ok, errors, warnings } = checkEnv();

for (const w of warnings) console.warn(`  ⚠  ${w}`);
for (const e of errors) console.error(`  ✗  ${e}`);

if (ok) {
  console.log(`\n  ✓  Environment looks good${warnings.length ? " (with warnings)" : ""}.\n`);
  process.exit(0);
}

console.error(`\n  ${errors.length} problem(s) must be fixed before this can take real money.\n`);
process.exit(1);
