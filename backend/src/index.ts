import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { botManager, prisma } from "./botManager/index.js";
import { encryptToken, maskToken, isValidTelegramToken } from "./utils/crypto.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- HELPER FUNCTIONS ---

function parseNumericId(param: unknown): number | null {
  if (typeof param !== "string" && typeof param !== "number") return null;
  const parsed = parseInt(String(param), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

// --- API ROUTES: BOTS ---

/**
 * GET /api/bots - Ritorna la lista di tutti i bot registrati con token mascherati
 */
app.get("/api/bots", async (_req: Request, res: Response) => {
  try {
    const bots = await prisma.bot.findMany({
      include: {
        _count: {
          select: { groupConfigs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sanitizedBots = bots.map((b) => ({
      id: b.id,
      name: b.name,
      username: b.username,
      tokenMasked: maskToken(b.token),
      isRunning: botManager.isBotRunning(b.id) || b.isRunning,
      groupCount: b._count.groupConfigs,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    res.json(sanitizedBots);
  } catch (error) {
    console.error("[API GET /api/bots] Errore:", error);
    res.status(500).json({ error: "Errore nel recupero dei bot" });
  }
});

/**
 * GET /api/bots/:id - Dettaglio di un singolo bot
 */
app.get("/api/bots/:id", async (req: Request, res: Response) => {
  const botId = parseNumericId(req.params.id);
  if (!botId) {
    return res.status(400).json({ error: "ID bot non valido" });
  }

  try {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: {
        groupConfigs: true,
        _count: { select: { logs: true } },
      },
    });

    if (!bot) {
      return res.status(404).json({ error: "Bot non trovato" });
    }

    res.json({
      id: bot.id,
      name: bot.name,
      username: bot.username,
      tokenMasked: maskToken(bot.token),
      isRunning: botManager.isBotRunning(bot.id) || bot.isRunning,
      groupConfigs: bot.groupConfigs,
      logCount: bot._count.logs,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
    });
  } catch (error) {
    console.error(`[API GET /api/bots/${botId}] Errore:`, error);
    res.status(500).json({ error: "Errore nel recupero del bot" });
  }
});

/**
 * POST /api/bots - Registra un nuovo bot nel sistema (token cifrato a riposo)
 */
app.post("/api/bots", async (req: Request, res: Response) => {
  const { name, token } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Il nome del bot è obbligatorio" });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ error: "Il token del bot è obbligatorio" });
  }

  const trimmedToken = token.trim();
  if (!isValidTelegramToken(trimmedToken)) {
    return res.status(400).json({
      error: "Formato Token non valido. Deve rispettare lo standard BotFather (es. 123456789:AA...ZZ)",
    });
  }

  try {
    const encrypted = encryptToken(trimmedToken);

    const newBot = await prisma.bot.create({
      data: {
        name: name.trim(),
        token: encrypted,
        isRunning: false,
      },
    });

    res.status(201).json({
      id: newBot.id,
      name: newBot.name,
      username: newBot.username,
      tokenMasked: maskToken(encrypted),
      isRunning: newBot.isRunning,
      createdAt: newBot.createdAt,
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Esiste già un bot registrato con questo token" });
    }
    console.error("[API POST /api/bots] Errore:", error);
    res.status(500).json({ error: "Errore durante la registrazione del bot" });
  }
});

/**
 * DELETE /api/bots/:id - Elimina un bot (arrestandolo se attivo, con cascade delete)
 */
app.delete("/api/bots/:id", async (req: Request, res: Response) => {
  const botId = parseNumericId(req.params.id);
  if (!botId) {
    return res.status(400).json({ error: "ID bot non valido" });
  }

  try {
    const existing = await prisma.bot.findUnique({ where: { id: botId } });
    if (!existing) {
      return res.status(404).json({ error: "Bot non trovato" });
    }

    // Arresta il bot se attivo
    await botManager.stopBot(botId);

    // Elimina record (GroupConfig e Log eliminati in cascata grazie a onDelete: Cascade)
    await prisma.bot.delete({ where: { id: botId } });

    res.json({ message: `Bot ${botId} eliminato con successo` });
  } catch (error) {
    console.error(`[API DELETE /api/bots/${botId}] Errore:`, error);
    res.status(500).json({ error: "Errore durante l'eliminazione del bot" });
  }
});

/**
 * POST /api/bots/:id/start - Avvia un bot specifico
 */
app.post("/api/bots/:id/start", async (req: Request, res: Response) => {
  const botId = parseNumericId(req.params.id);
  if (!botId) {
    return res.status(400).json({ error: "ID bot non valido" });
  }

  try {
    const botRecord = await prisma.bot.findUnique({ where: { id: botId } });
    if (!botRecord) {
      return res.status(404).json({ error: "Bot non trovato" });
    }

    const startResult = await botManager.startBot(botRecord.id, botRecord.token);

    if (!startResult.success) {
      return res.status(400).json({
        error: startResult.error || "Impossibile avviare il bot su Telegram",
      });
    }

    res.json({
      message: startResult.message || `Bot ${botId} avviato`,
      botInfo: startResult.botInfo,
    });
  } catch (error) {
    console.error(`[API POST /api/bots/${botId}/start] Errore:`, error);
    res.status(500).json({ error: "Errore durante l'avvio del bot" });
  }
});

/**
 * POST /api/bots/:id/stop - Ferma un bot specifico
 */
app.post("/api/bots/:id/stop", async (req: Request, res: Response) => {
  const botId = parseNumericId(req.params.id);
  if (!botId) {
    return res.status(400).json({ error: "ID bot non valido" });
  }

  try {
    await botManager.stopBot(botId);
    res.json({ message: `Bot ${botId} fermato` });
  } catch (error) {
    console.error(`[API POST /api/bots/${botId}/stop] Errore:`, error);
    res.status(500).json({ error: "Errore durante l'arresto del bot" });
  }
});

// --- API ROUTES: LOGS ---

/**
 * GET /api/logs - Recupero paginato dei log di moderazione e di sistema
 */
app.get("/api/logs", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 50), 10) || 50, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset || 0), 10) || 0, 0);
  const botId = req.query.botId ? parseNumericId(req.query.botId) : undefined;
  const level = typeof req.query.level === "string" ? req.query.level.toUpperCase() : undefined;

  const whereClause: any = {};
  if (botId) whereClause.botId = botId;
  if (level) whereClause.level = level;

  try {
    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where: whereClause,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        include: {
          bot: { select: { id: true, name: true, username: true } },
        },
      }),
      prisma.log.count({ where: whereClause }),
    ]);

    res.json({ logs, total, limit, offset });
  } catch (error) {
    console.error("[API GET /api/logs] Errore:", error);
    res.status(500).json({ error: "Errore nel recupero dei log" });
  }
});

// --- API ROUTES: GROUP CONFIGS ---

/**
 * GET /api/bots/:id/groups - Elenco dei gruppi configurati per un bot
 */
app.get("/api/bots/:id/groups", async (req: Request, res: Response) => {
  const botId = parseNumericId(req.params.id);
  if (!botId) {
    return res.status(400).json({ error: "ID bot non valido" });
  }

  try {
    const groups = await prisma.groupConfig.findMany({
      where: { botId },
      orderBy: { id: "asc" },
    });
    res.json(groups);
  } catch (error) {
    console.error(`[API GET /api/bots/${botId}/groups] Errore:`, error);
    res.status(500).json({ error: "Errore nel recupero dei gruppi" });
  }
});

/**
 * POST /api/bots/:id/groups - Aggiunge o aggiorna la configurazione di un gruppo per un bot
 */
app.post("/api/bots/:id/groups", async (req: Request, res: Response) => {
  const botId = parseNumericId(req.params.id);
  if (!botId) {
    return res.status(400).json({ error: "ID bot non valido" });
  }

  const { groupId, groupName, captchaEnabled, nightModeEnabled, nightModeStart, nightModeEnd, bannedWords } = req.body;

  if (!groupId || typeof groupId !== "string") {
    return res.status(400).json({ error: "groupId obbligatorio (stringa)" });
  }

  try {
    const groupConfig = await prisma.groupConfig.upsert({
      where: {
        botId_groupId: { botId, groupId },
      },
      update: {
        groupName: groupName ?? undefined,
        captchaEnabled: typeof captchaEnabled === "boolean" ? captchaEnabled : undefined,
        nightModeEnabled: typeof nightModeEnabled === "boolean" ? nightModeEnabled : undefined,
        nightModeStart: nightModeStart ?? undefined,
        nightModeEnd: nightModeEnd ?? undefined,
        bannedWords: bannedWords ?? undefined,
      },
      create: {
        botId,
        groupId,
        groupName: groupName ?? null,
        captchaEnabled: Boolean(captchaEnabled),
        nightModeEnabled: Boolean(nightModeEnabled),
        nightModeStart: nightModeStart ?? null,
        nightModeEnd: nightModeEnd ?? null,
        bannedWords: bannedWords ?? null,
      },
    });

    res.status(201).json(groupConfig);
  } catch (error) {
    console.error(`[API POST /api/bots/${botId}/groups] Errore:`, error);
    res.status(500).json({ error: "Errore nel salvataggio della configurazione gruppo" });
  }
});

// --- SERVER STARTUP & LIFECYCLE ---

let serverInstance: any = null;

const startServer = async () => {
  try {
    // Inizializza la flotta di bot marcati come isRunning
    await botManager.initAllBots();

    serverInstance = app.listen(PORT, () => {
      console.log(`[Runtime Server] In ascolto sulla porta ${PORT}`);
      console.log(`[Runtime Server] Dashboard API: http://localhost:${PORT}/api/bots`);
    });
  } catch (error) {
    console.error("[Runtime Server] Errore fatale all'avvio:", error);
    process.exit(1);
  }
};

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n[Runtime Server] Ricevuto segnale ${signal}. Avvio arresto controllato...`);
  try {
    await botManager.stopAll();
    if (serverInstance) {
      serverInstance.close(() => {
        console.log("[Runtime Server] Server HTTP chiuso.");
      });
    }
  } catch (err) {
    console.error("[Runtime Server] Errore durante lo shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

export { app };

// Avvia il server solo quando il file è eseguito direttamente (non durante i test)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
