import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index.js";

// --- Mocks ---

const { mockBotManager, mockPrisma } = vi.hoisted(() => ({
  mockBotManager: {
    initAllBots: vi.fn().mockResolvedValue(undefined),
    startBot: vi.fn().mockResolvedValue({ success: true, message: "Bot 1 avviato" }),
    stopBot: vi.fn().mockResolvedValue(undefined),
    isBotRunning: vi.fn().mockReturnValue(false),
  },
  mockPrisma: {
    bot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    log: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    groupConfig: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../botManager/index.js", () => ({
  botManager: mockBotManager,
  prisma: mockPrisma,
}));

// --- Test Suite ---

describe("API Routes", () => {
  const VALID_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ12345";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/bots", () => {
    it("restituisce la lista dei bot con token mascherato e status 200", async () => {
      const fakeBots = [
        {
          id: 1,
          name: "Bot Alpha",
          username: "bot_alpha",
          token: VALID_TOKEN,
          isRunning: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { groupConfigs: 2 },
        },
      ];
      mockPrisma.bot.findMany.mockResolvedValue(fakeBots);

      const res = await request(app).get("/api/bots");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty("tokenMasked");
      expect(res.body[0].tokenMasked).toContain("••••");
      expect(res.body[0]).not.toHaveProperty("token");
    });

    it("restituisce 500 in caso di errore del database", async () => {
      mockPrisma.bot.findMany.mockRejectedValue(new Error("DB offline"));

      const res = await request(app).get("/api/bots");

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/bots/:id", () => {
    it("restituisce i dettagli del bot specificato", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue({
        id: 1,
        name: "Bot Alpha",
        username: "bot_alpha",
        token: VALID_TOKEN,
        isRunning: false,
        groupConfigs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { logs: 5 },
      });

      const res = await request(app).get("/api/bots/1");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.tokenMasked).toBeDefined();
      expect(res.body.logCount).toBe(5);
    });

    it("restituisce 404 se il bot non esiste", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/api/bots/99");

      expect(res.status).toBe(404);
    });

    it("restituisce 400 se l'id non è un numero valido", async () => {
      const res = await request(app).get("/api/bots/invalid-id");

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/bots", () => {
    it("crea un nuovo bot con dati validi e token BotFather corretto", async () => {
      const newBot = {
        id: 1,
        name: "Bot Beta",
        token: "encrypted:token:string",
        isRunning: false,
        createdAt: new Date(),
      };
      mockPrisma.bot.create.mockResolvedValue(newBot);

      const res = await request(app)
        .post("/api/bots")
        .send({ name: "Bot Beta", token: VALID_TOKEN });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Bot Beta");
      expect(res.body).toHaveProperty("tokenMasked");
    });

    it("restituisce 400 se manca il nome", async () => {
      const res = await request(app).post("/api/bots").send({ token: VALID_TOKEN });

      expect(res.status).toBe(400);
      expect(mockPrisma.bot.create).not.toHaveBeenCalled();
    });

    it("restituisce 400 se il formato del token Telegram non è valido", async () => {
      const res = await request(app).post("/api/bots").send({ name: "Bot Beta", token: "invalid-token" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Formato Token non valido");
      expect(mockPrisma.bot.create).not.toHaveBeenCalled();
    });

    it("restituisce 409 se il token è duplicato", async () => {
      const p2002Error: any = new Error("Unique constraint failed");
      p2002Error.code = "P2002";
      mockPrisma.bot.create.mockRejectedValue(p2002Error);

      const res = await request(app)
        .post("/api/bots")
        .send({ name: "Bot Doppio", token: VALID_TOKEN });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Esiste già");
    });
  });

  describe("DELETE /api/bots/:id", () => {
    it("ferma ed elimina un bot esistente", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.bot.delete.mockResolvedValue({});

      const res = await request(app).delete("/api/bots/1");

      expect(res.status).toBe(200);
      expect(mockBotManager.stopBot).toHaveBeenCalledWith(1);
      expect(mockPrisma.bot.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("restituisce 404 se il bot da eliminare non esiste", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue(null);

      const res = await request(app).delete("/api/bots/99");

      expect(res.status).toBe(404);
      expect(mockPrisma.bot.delete).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/bots/:id/start", () => {
    it("avvia un bot esistente e restituisce 200", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue({ id: 1, token: VALID_TOKEN });
      mockBotManager.startBot.mockResolvedValue({ success: true, message: "Bot 1 avviato" });

      const res = await request(app).post("/api/bots/1/start");

      expect(res.status).toBe(200);
      expect(mockBotManager.startBot).toHaveBeenCalledWith(1, VALID_TOKEN);
    });

    it("restituisce 400 se l'avvio del bot fallisce", async () => {
      mockPrisma.bot.findUnique.mockResolvedValue({ id: 1, token: VALID_TOKEN });
      mockBotManager.startBot.mockResolvedValue({
        success: false,
        error: "401: Unauthorized",
      });

      const res = await request(app).post("/api/bots/1/start");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("401: Unauthorized");
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
  });

  describe("GET /api/logs", () => {
    it("restituisce i log paginati", async () => {
      const fakeLogs = [{ id: 1, level: "INFO", message: "Bot avviato", botId: 1 }];
      mockPrisma.log.findMany.mockResolvedValue(fakeLogs);
      mockPrisma.log.count.mockResolvedValue(1);

      const res = await request(app).get("/api/logs?limit=10&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual(fakeLogs);
      expect(res.body.total).toBe(1);
    });
  });

  describe("GET and POST /api/bots/:id/groups", () => {
    it("restituisce i gruppi configurati per un bot", async () => {
      const fakeGroups = [{ id: 1, botId: 1, groupId: "-100123456" }];
      mockPrisma.groupConfig.findMany.mockResolvedValue(fakeGroups);

      const res = await request(app).get("/api/bots/1/groups");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(fakeGroups);
    });

    it("crea o aggiorna la configurazione di un gruppo", async () => {
      const fakeConfig = { id: 1, botId: 1, groupId: "-100123456", captchaEnabled: true };
      mockPrisma.groupConfig.upsert.mockResolvedValue(fakeConfig);

      const res = await request(app)
        .post("/api/bots/1/groups")
        .send({ groupId: "-100123456", captchaEnabled: true });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(fakeConfig);
    });
  });
});
