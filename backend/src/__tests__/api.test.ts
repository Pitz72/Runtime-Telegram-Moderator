import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index.js";

// --- Mocks ---

const { mockBotManager, mockPrisma } = vi.hoisted(() => ({
  mockBotManager: {
    initAllBots: vi.fn().mockResolvedValue(undefined),
    startBot: vi.fn().mockResolvedValue(undefined),
    stopBot: vi.fn().mockResolvedValue(undefined),
  },
  mockPrisma: {
    bot: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../botManager/index.js", () => ({
  botManager: mockBotManager,
  prisma: mockPrisma,
}));

// --- Test Suite ---

describe("API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/bots", () => {
    it("restituisce la lista dei bot con status 200", async () => {
      const fakeBots = [
        { id: 1, name: "Bot Alpha", token: "xxx", isRunning: true, _count: { groupConfigs: 2 } },
      ];
      mockPrisma.bot.findMany.mockResolvedValue(fakeBots);

      const res = await request(app).get("/api/bots");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(fakeBots);
    });

    it("restituisce 500 in caso di errore del database", async () => {
      mockPrisma.bot.findMany.mockRejectedValue(new Error("DB offline"));

      const res = await request(app).get("/api/bots");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("POST /api/bots", () => {
    it("crea un nuovo bot con i dati validi e restituisce 201", async () => {
      const newBot = { id: 1, name: "Bot Beta", token: "yyy", isRunning: false };
      mockPrisma.bot.create.mockResolvedValue(newBot);

      const res = await request(app)
        .post("/api/bots")
        .send({ name: "Bot Beta", token: "yyy" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(newBot);
    });

    it("restituisce 400 se manca il nome", async () => {
      const res = await request(app).post("/api/bots").send({ token: "yyy" });

      expect(res.status).toBe(400);
      expect(mockPrisma.bot.create).not.toHaveBeenCalled();
    });

    it("restituisce 400 se manca il token", async () => {
      const res = await request(app).post("/api/bots").send({ name: "Bot Beta" });

      expect(res.status).toBe(400);
      expect(mockPrisma.bot.create).not.toHaveBeenCalled();
    });

    it("restituisce 500 se il token è duplicato", async () => {
      mockPrisma.bot.create.mockRejectedValue(new Error("Unique constraint failed"));

      const res = await request(app)
        .post("/api/bots")
        .send({ name: "Bot Doppio", token: "duplicato" });

      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/bots/:id/start", () => {
    it("avvia un bot esistente e restituisce 200", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue({ id: 1, token: "xxx" });

      const res = await request(app).post("/api/bots/1/start");

      expect(res.status).toBe(200);
      expect(mockBotManager.startBot).toHaveBeenCalledWith(1, "xxx");
    });

    it("restituisce 404 se il bot non esiste", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue(null);

      const res = await request(app).post("/api/bots/99/start");

      expect(res.status).toBe(404);
      expect(mockBotManager.startBot).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/bots/:id/stop", () => {
    it("ferma un bot e restituisce 200", async () => {
      const res = await request(app).post("/api/bots/1/stop");

      expect(res.status).toBe(200);
      expect(mockBotManager.stopBot).toHaveBeenCalledWith(1);
    });

    it("restituisce 500 se lo stop fallisce", async () => {
      mockBotManager.stopBot.mockRejectedValueOnce(new Error("Errore generico"));

      const res = await request(app).post("/api/bots/1/stop");

      expect(res.status).toBe(500);
    });
  });
});
