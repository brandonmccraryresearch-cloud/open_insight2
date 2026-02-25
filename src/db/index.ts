import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { existsSync, copyFileSync } from "fs";

function resolveDbPath(): string {
  const bundlePath = path.join(process.cwd(), "open-insight.db");
  // Vercel serverless: /var/task is read-only; copy seeded DB to writable /tmp
  if (process.env.VERCEL) {
    const tmpPath = "/tmp/open-insight.db";
    if (!existsSync(tmpPath) && existsSync(bundlePath)) {
      copyFileSync(bundlePath, tmpPath);
    }
    return tmpPath;
  }
  return bundlePath;
}

const dbPath = resolveDbPath();
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
