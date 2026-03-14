import { defineConfig } from "@prisma/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrate: {
    async adapter(env) {
      const dbUrl = env.DATABASE_URL ?? "file:./dev.db";
      const dbPath = dbUrl.replace("file:", "");
      return new PrismaBetterSqlite3({ url: dbPath });
    },
  },
});
