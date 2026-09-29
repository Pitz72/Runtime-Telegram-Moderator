-- AlterTable
ALTER TABLE "Bot" ADD COLUMN "username" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "botId" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nightModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nightModeStart" TEXT,
    "nightModeEnd" TEXT,
    "bannedWords" TEXT,
    CONSTRAINT "GroupConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GroupConfig" ("bannedWords", "botId", "captchaEnabled", "groupId", "groupName", "id", "nightModeEnabled", "nightModeEnd", "nightModeStart") SELECT "bannedWords", "botId", "captchaEnabled", "groupId", "groupName", "id", "nightModeEnabled", "nightModeEnd", "nightModeStart" FROM "GroupConfig";
DROP TABLE "GroupConfig";
ALTER TABLE "new_GroupConfig" RENAME TO "GroupConfig";
CREATE INDEX "GroupConfig_botId_idx" ON "GroupConfig"("botId");
CREATE UNIQUE INDEX "GroupConfig_botId_groupId_key" ON "GroupConfig"("botId", "groupId");
CREATE TABLE "new_Log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "botId" INTEGER NOT NULL,
    "groupId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Log" ("botId", "groupId", "id", "level", "message", "timestamp") SELECT "botId", "groupId", "id", "level", "message", "timestamp" FROM "Log";
DROP TABLE "Log";
ALTER TABLE "new_Log" RENAME TO "Log";
CREATE INDEX "Log_botId_idx" ON "Log"("botId");
CREATE INDEX "Log_timestamp_idx" ON "Log"("timestamp");
CREATE INDEX "Log_level_idx" ON "Log"("level");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
