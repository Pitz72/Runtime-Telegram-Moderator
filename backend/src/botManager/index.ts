import { Bot } from "grammy";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const dbPath = dbUrl.replace("file:", "");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

export class BotManager {
  private activeBots: Map<number, Bot> = new Map();

  /**
   * Avvia un bot specifico dato il suo ID e Token.
   */
  async startBot(botId: number, token: string): Promise<void> {
    if (this.activeBots.has(botId)) {
      console.log(`[BotManager] Bot ${botId} già attivo.`);
      return;
    }

    try {
      const bot = new Bot(token);

      // Gestore errori globale per l'istanza del bot
      bot.catch(async (err) => {
        const ctx = err.ctx;
        const errorMsg = `Errore nell'aggiornamento ${ctx.update.update_id}: ${err.message}`;
        console.error(`[BotManager] Errore Bot ${botId}:`, errorMsg);

        // Log dell'errore nel database
        await prisma.log.create({
          data: {
            botId: botId,
            level: "ERROR",
            message: errorMsg,
          },
        });
      });

      // Comando di test
      bot.command("ping", (ctx) => ctx.reply("Pong da Runtime Moderator!"));

      // Avvio del bot in background (non await per non bloccare il server)
      bot.start({ drop_pending_updates: true });

      // Salvataggio istanza e aggiornamento stato nel DB
      this.activeBots.set(botId, bot);
      await prisma.bot.update({
        where: { id: botId },
        data: { isRunning: true },
      });

      console.log(`[BotManager] Bot ${botId} avviato correttamente.`);
    } catch (error) {
      console.error(`[BotManager] Errore critico all'avvio del Bot ${botId}:`, error);
      await prisma.log.create({
        data: {
          botId: botId,
          level: "CRITICAL",
          message: `Impossibile avviare il bot: ${(error as Error).message}`,
        },
      });
    }
  }

  /**
   * Ferma un bot specifico e aggiorna lo stato nel DB.
   */
  async stopBot(botId: number): Promise<void> {
    const bot = this.activeBots.get(botId);
    if (!bot) {
      console.log(`[BotManager] Bot ${botId} non è in esecuzione.`);
      return;
    }

    try {
      await bot.stop();
      this.activeBots.delete(botId);

      await prisma.bot.update({
        where: { id: botId },
        data: { isRunning: false },
      });

      console.log(`[BotManager] Bot ${botId} fermato.`);
    } catch (error) {
      console.error(`[BotManager] Errore durante lo stop del Bot ${botId}:`, error);
    }
  }

  /**
   * Inizializza tutti i bot che risultano "isRunning" nel database all'avvio del server.
   */
  async initAllBots(): Promise<void> {
    console.log("[BotManager] Inizializzazione flotta bot...");
    const botsToStart = await prisma.bot.findMany({
      where: { isRunning: true },
    });

    for (const botRecord of botsToStart) {
      try {
        // Avviamo ogni bot; se uno fallisce, passiamo al prossimo senza bloccare tutto
        await this.startBot(botRecord.id, botRecord.token);
      } catch (error) {
        console.error(`[BotManager] Fallita inizializzazione Bot ${botRecord.id}:`, error);
      }
    }
    console.log(`[BotManager] Inizializzazione completata. Bot attivi: ${this.activeBots.size}`);
  }
}

export const botManager = new BotManager();
export { prisma };
