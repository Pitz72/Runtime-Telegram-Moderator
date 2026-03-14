import express, { Request, Response } from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { botManager, prisma } from "./botManager/index.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

/**
 * GET /api/bots - Ritorna la lista di tutti i bot registrati
 */
app.get("/api/bots", async (_req: Request, res: Response) => {
  try {
    const bots = await prisma.bot.findMany({
      include: {
        _count: {
          select: { groupConfigs: true },
        },
      },
    });
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: "Errore nel recupero dei bot" });
  }
});

/**
 * POST /api/bots - Registra un nuovo bot nel sistema
 */
app.post("/api/bots", async (req: Request, res: Response) => {
  const { name, token } = req.body;

  if (!name || !token) {
    return res.status(400).json({ error: "Nome e Token sono obbligatori" });
  }

  try {
    const newBot = await prisma.bot.create({
      data: {
        name,
        token,
        isRunning: false,
      },
    });
    res.status(201).json(newBot);
  } catch (error) {
    res.status(500).json({ error: "Errore nella creazione del bot (Token già esistente?)" });
  }
});

/**
 * POST /api/bots/:id/start - Avvia un bot specifico
 */
app.post("/api/bots/:id/start", async (req: Request, res: Response) => {
  const { id } = req.params;
  const botId = parseInt(id as string);

  try {
    const botRecord = await prisma.bot.findUnique({ where: { id: botId } });
    if (!botRecord) {
      return res.status(404).json({ error: "Bot non trovato" });
    }

    await botManager.startBot(botRecord.id, botRecord.token);
    res.json({ message: `Bot ${botId} avviato` });
  } catch (error) {
    res.status(500).json({ error: "Errore durante l'avvio del bot" });
  }
});

/**
 * POST /api/bots/:id/stop - Ferma un bot specifico
 */
app.post("/api/bots/:id/stop", async (req: Request, res: Response) => {
  const { id } = req.params;
  const botId = parseInt(id as string);

  try {
    await botManager.stopBot(botId);
    res.json({ message: `Bot ${botId} fermato` });
  } catch (error) {
    res.status(500).json({ error: "Errore durante l'arresto del bot" });
  }
});

// --- SERVER STARTUP ---

const startServer = async () => {
  try {
    // Inizializza la flotta di bot (quelli marcati come isRunning: true nel DB)
    await botManager.initAllBots();

    app.listen(PORT, () => {
      console.log(`[Titan Server] In ascolto sulla porta ${PORT}`);
      console.log(`[Titan Server] Dashboard API: http://localhost:${PORT}/api/bots`);
    });
  } catch (error) {
    console.error("[Titan Server] Errore fatale all'avvio:", error);
    process.exit(1);
  }
};

export { app };

// Avvia il server solo quando il file è eseguito direttamente (non durante i test)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
