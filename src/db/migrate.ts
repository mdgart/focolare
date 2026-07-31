/**
 * Apply the SQL files in drizzle/ in order against DATABASE_URL.
 *
 * Designed to be safely re-runnable, which matters because it is the deploy step:
 * the hand-written add_*.sql files guard themselves (IF NOT EXISTS / DO blocks), and
 * the Drizzle-generated 0000_init.sql does not — so its statements are executed one
 * at a time and "already exists" errors are treated as already-applied.
 *
 * Usage: npm run db:migrate
 */
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./index";

/** Postgres codes that mean "this object is already there". */
const ALREADY_APPLIED = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object (type, constraint, index)
  "42701", // duplicate_column
  "42P06", // duplicate_schema
]);

/** 0000_init first, then the add_* files alphabetically. */
async function migrationFiles(dir: string): Promise<string[]> {
  const all = (await readdir(dir)).filter((f) => f.endsWith(".sql"));
  const init = all.filter((f) => f.startsWith("0000")).sort();
  const rest = all.filter((f) => !f.startsWith("0000")).sort();
  return [...init, ...rest];
}

function statementsIn(sql: string): string[] {
  // Drizzle marks statement boundaries explicitly. Files without the marker
  // (our hand-written ones, which contain DO $$ … $$ blocks) run as a single unit.
  if (!sql.includes("--> statement-breakpoint")) return [sql];
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const dir = path.join(process.cwd(), "drizzle");
  const files = await migrationFiles(dir);
  if (files.length === 0) {
    console.log("No .sql files in drizzle/ — nothing to apply.");
    return;
  }

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    let fileApplied = 0;
    let fileSkipped = 0;

    for (const statement of statementsIn(sql)) {
      try {
        await pool.query(statement);
        fileApplied += 1;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code && ALREADY_APPLIED.has(code)) {
          fileSkipped += 1;
          continue;
        }
        throw new Error(`${file}: ${(e as Error).message}`, { cause: e });
      }
    }

    applied += fileApplied;
    skipped += fileSkipped;
    console.log(
      `  ${file} — ${fileApplied} applied${fileSkipped > 0 ? `, ${fileSkipped} already present` : ""}`,
    );
  }

  console.log(`\nDone: ${applied} statement(s) applied, ${skipped} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
