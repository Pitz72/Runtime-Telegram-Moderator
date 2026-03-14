import { describe, it, expect, vi, beforeEach } from "vitest";
import { BotManager } from "../botManager/index.js";

// --- Mocks ---

const { mockBotInstance, mockPrisma } = vi.hoisted(() => ({
  mockBotInstance: {
    catch: vi.fn(),
    command: vi.fn(),
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
  },
  mockPrisma: {
    bot: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    log: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("grammy", () => ({
  Bot: vi.fn().mockImplementation(() => mockBotInstance),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
}));

vi.mock("@prisma/adapter-better-sqlite3", () => ({
  PrismaBetterSqlite3: vi.fn().mockImplementation(() => ({})),
}));

// --- Test Suite ---

describe("BotManager", () => {
  let manager: BotManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BotManager();
  });

  describe("startBot", () => {
    it("avvia un nuovo bot e aggiorna il database", async () => {
      await manager.startBot(1, "test-token");

      expect(mockBotInstance.start).toHaveBeenCalledOnce();
      expect(mockPrisma.bot.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRunning: true },
      });
    });

    it("è idempotente se il bot è già attivo", async () => {
      await manager.startBot(1, "test-token");
      await manager.startBot(1, "test-token");

      expect(mockBotInstance.start).toHaveBeenCalledOnce();
      expect(mockPrisma.bot.update).toHaveBeenCalledOnce();
    });

    it("registra un log CRITICAL se l'avvio fallisce e non propaga l'errore", async () => {
      mockPrisma.bot.update.mockRejectedValueOnce(new Error("DB offline"));

      await expect(manager.startBot(1, "test-token")).resolves.not.toThrow();
      expect(mockPrisma.log.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ level: "CRITICAL" }) })
      );
    });
  });

  describe("stopBot", () => {
    it("ferma un bot in esecuzione e aggiorna il database", async () => {
      await manager.startBot(1, "test-token");
      await manager.stopBot(1);

      expect(mockBotInstance.stop).toHaveBeenCalledOnce();
      expect(mockPrisma.bot.update).toHaveBeenLastCalledWith({
        where: { id: 1 },
        data: { isRunning: false },
      });
    });

    it("non fa nulla se il bot non è in esecuzione", async () => {
      await manager.stopBot(99);

      expect(mockBotInstance.stop).not.toHaveBeenCalled();
      expect(mockPrisma.bot.update).not.toHaveBeenCalled();
    });
  });

  describe("initAllBots", () => {
    it("avvia tutti i bot con isRunning=true nel database", async () => {
      mockPrisma.bot.findMany.mockResolvedValue([
        { id: 1, token: "token-1" },
        { id: 2, token: "token-2" },
      ]);

      await manager.initAllBots();

      expect(mockBotInstance.start).toHaveBeenCalledTimes(2);
      expect(mockPrisma.bot.update).toHaveBeenCalledTimes(2);
    });

    it("non avvia nessun bot se il database è vuoto", async () => {
      mockPrisma.bot.findMany.mockResolvedValue([]);

      await manager.initAllBots();

      expect(mockBotInstance.start).not.toHaveBeenCalled();
    });

    it("continua l'inizializzazione anche se un bot fallisce", async () => {
      mockPrisma.bot.findMany.mockResolvedValue([
        { id: 1, token: "token-bad" },
        { id: 2, token: "token-good" },
      ]);
      mockPrisma.bot.update
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValue({});

      await expect(manager.initAllBots()).resolves.not.toThrow();
      expect(mockBotInstance.start).toHaveBeenCalledTimes(2);
    });
  });
});
