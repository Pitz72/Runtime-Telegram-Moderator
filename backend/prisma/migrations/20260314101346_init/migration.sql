-- CreateTable
CREATE TABLE "Bot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GroupConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "botId" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nightModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nightModeStart" TEXT,
    "nightModeEnd" TEXT,
    "bannedWords" TEXT,
    CONSTRAINT "GroupConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "botId" INTEGER NOT NULL,
    "groupId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Bot_token_key" ON "Bot"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GroupConfig_botId_groupId_key" ON "GroupConfig"("botId", "groupId");
