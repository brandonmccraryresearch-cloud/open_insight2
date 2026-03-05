import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { existsSync, copyFileSync } from "fs";

const isVercel = !!process.env.VERCEL;
const buildDbPath = path.join(process.cwd(), "open-insight.db");

// KNOWN LIMITATION: On Vercel, SQLite is ephemeral. Each serverless function
// invocation copies the build-time DB snapshot to /tmp. Writes (new debates,
// threads, messages) are visible only within the same function instance.
// Cross-invocation writes are NOT shared. For full persistence, migrate to a
// hosted database (e.g., Turso, Neon, PlanetScale).

// On Vercel the task root is read-only at runtime.
// Copy the bundled DB to /tmp (writable) on cold start.
let dbPath = buildDbPath;
if (isVercel) {
  const tmpPath = "/tmp/open-insight.db";
  if (!existsSync(tmpPath)) {
    try {
      copyFileSync(buildDbPath, tmpPath);
    } catch {
      // Another cold-start instance may have already written it — safe to ignore.
    }
  }
  dbPath = tmpPath;
}

const sqlite = new Database(dbPath);
// WAL requires a persistent directory; DELETE is safe in ephemeral /tmp.
sqlite.pragma(isVercel ? "journal_mode = DELETE" : "journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
