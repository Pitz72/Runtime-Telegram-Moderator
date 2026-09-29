import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

const rawDbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
export const dbPath = rawDbUrl.replace(/^file:/, "");

// Applica le impostazioni di concorrenza avanzata SQLite (WAL Mode & Timeout)
try {
  const initDb = new Database(dbPath, { timeout: 5000 });
  initDb.pragma("journal_mode = WAL");
  initDb.pragma("busy_timeout = 5000");
  initDb.pragma("synchronous = NORMAL");
  initDb.close();
} catch (e) {
  console.warn("[Database] Impossibile applicare PRAGMA SQLite preliminari:", (e as Error).message);
}

const adapter = new PrismaBetterSqlite3({ url: dbPath, timeout: 5000 });
export const prisma = new PrismaClient({ adapter });
