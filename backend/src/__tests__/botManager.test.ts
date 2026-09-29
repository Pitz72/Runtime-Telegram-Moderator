import { describe, it, expect, vi, beforeEach } from "vitest";
import { BotManager } from "../botManager/index.js";

// --- Mocks ---

const { mockBotInstance, mockRunner, mockPrisma } = vi.hoisted(() => {
  const runner = {
    isRunning: vi.fn().mockReturnValue(true),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const botInstance = {
    catch: vi.fn(),
    command: vi.fn(),
    api: {
      getMe: vi.fn().mockResolvedValue({
        id: 12345,
        username: "test_bot",
        first_name: "Test Bot",
      }),
    },
  };

  const prismaMock = {
    bot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    log: {
      create: vi.fn().mockResolvedValue({}),
    },
  };

  return {
    mockBotInstance: botInstance,
    mockRunner: runner,
    mockPrisma: prismaMock,
  };
});

vi.mock("grammy", () => ({
  Bot: vi.fn().mockImplementation(() => mockBotInstance),
}));

vi.mock("@grammyjs/runner", () => ({
  run: vi.fn().mockImplementation(() => mockRunner),
}));

vi.mock("../db/prisma.js", () => ({
  prisma: mockPrisma,
}));

// --- Test Suite ---

describe("BotManager", () => {
  let manager: BotManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunner.isRunning.mockReturnValue(true);
    mockBotInstance.api.getMe.mockResolvedValue({
      id: 12345,
      username: "test_bot",
      first_name: "Test Bot",
    });
    manager = new BotManager();
  });

  describe("startBot", () => {
    it("avvia un nuovo bot dopo handshake getMe e aggiorna il database", async () => {
      const result = await manager.startBot(1, "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12345");

      expect(result.success).toBe(true);
      expect(mockBotInstance.api.getMe).toHaveBeenCalledOnce();
      expect(mockPrisma.bot.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRunning: true, username: "test_bot" },
      });
      expect(manager.isBotRunning(1)).toBe(true);
    });

    it("è idempotente se il bot è già attivo", async () => {
      await manager.startBot(1, "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12345");
      const secondCall = await manager.startBot(1, "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12345");

      expect(secondCall.success).toBe(true);
      expect(mockBotInstance.api.getMe).toHaveBeenCalledOnce();
      expect(mockPrisma.bot.update).toHaveBeenCalledOnce();
    });

    it("cattura l'errore se getMe fallisce, registra log CRITICAL e reimposta isRunning: false", async () => {
      mockBotInstance.api.getMe.mockRejectedValueOnce(new Error("401: Unauthorized"));

      const result = await manager.startBot(1, "invalid-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("401: Unauthorized");
      expect(mockPrisma.log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: "CRITICAL" }),
        })
      );
      expect(mockPrisma.bot.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRunning: false },
      });
      expect(manager.isBotRunning(1)).toBe(false);
    });
  });

  describe("stopBot", () => {
    it("ferma un bot in esecuzione e aggiorna il database", async () => {
      await manager.startBot(1, "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12345");
      await manager.stopBot(1);

      expect(mockRunner.stop).toHaveBeenCalledOnce();
      expect(mockPrisma.bot.update).toHaveBeenLastCalledWith({
        where: { id: 1 },
        data: { isRunning: false },
      });
      expect(manager.isBotRunning(1)).toBe(false);
    });

    it("aggiorna comunque il DB anche se il bot non era presente in memoria", async () => {
      await manager.stopBot(99);

      expect(mockRunner.stop).not.toHaveBeenCalled();
      expect(mockPrisma.bot.update).toHaveBeenCalledWith({
        where: { id: 99 },
        data: { isRunning: false },
      });
    });
  });

  describe("initAllBots", () => {
    it("avvia tutti i bot con isRunning=true nel database", async () => {
      mockPrisma.bot.findMany.mockResolvedValue([
        { id: 1, token: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12341" },
        { id: 2, token: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12342" },
      ]);

      await manager.initAllBots();

      expect(mockBotInstance.api.getMe).toHaveBeenCalledTimes(2);
      expect(mockPrisma.bot.update).toHaveBeenCalledTimes(2);
      expect(manager.getActiveBotsCount()).toBe(2);
    });

    it("non avvia nessun bot se il database è vuoto", async () => {
      mockPrisma.bot.findMany.mockResolvedValue([]);

      await manager.initAllBots();

      expect(mockBotInstance.api.getMe).not.toHaveBeenCalled();
      expect(manager.getActiveBotsCount()).toBe(0);
    });

    it("continua l'inizializzazione anche se un bot fallisce", async () => {
      mockPrisma.bot.findMany.mockResolvedValue([
        { id: 1, token: "bad-token" },
        { id: 2, token: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12342" },
      ]);
      mockBotInstance.api.getMe
        .mockRejectedValueOnce(new Error("Telegram offline"))
        .mockResolvedValueOnce({ id: 2, username: "good_bot", first_name: "Good Bot" });

      await expect(manager.initAllBots()).resolves.not.toThrow();
      expect(manager.getActiveBotsCount()).toBe(1);
    });
  });
});
