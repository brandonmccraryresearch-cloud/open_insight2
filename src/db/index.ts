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
      try {
        copyFileSync(bundlePath, tmpPath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // Ignore race where another invocation created the file first
        if (code !== "EEXIST") {
          throw error;
        }
      }
    }
    return tmpPath;
  }
  return bundlePath;
}

const dbPath = resolveDbPath();
const sqlite = new Database(dbPath);
sqlite.pragma(`journal_mode = ${process.env.VERCEL ? "DELETE" : "WAL"}`);
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
