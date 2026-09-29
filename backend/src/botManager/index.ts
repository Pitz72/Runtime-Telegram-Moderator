import { Bot } from "grammy";
import { run, RunnerHandle } from "@grammyjs/runner";
import { prisma } from "../db/prisma.js";
import { decryptToken } from "../utils/crypto.js";

export interface StartBotResult {
  success: boolean;
  message?: string;
  error?: string;
  botInfo?: {
    id: number;
    username?: string;
    first_name: string;
  };
}

export class BotManager {
  private activeBots: Map<number, { bot: Bot; runner: RunnerHandle }> = new Map();

  /**
   * Avvia un bot specifico dato il suo ID e Token cifrato o in chiaro.
   * Valida preliminarmente le credenziali verso Telegram prima di avviare il polling runner.
   */
  async startBot(botId: number, rawToken: string): Promise<StartBotResult> {
    if (this.activeBots.has(botId)) {
      console.log(`[BotManager] Bot ${botId} già attivo.`);
      return { success: true, message: `Bot ${botId} già attivo` };
    }

    const token = decryptToken(rawToken);

    try {
      const bot = new Bot(token);

      // 1. Validazione credenziali Telegram tramite handshake preliminare
      const botInfo = await bot.api.getMe();

      // 2. Gestore errori globale a livello di middleware/update
      bot.catch(async (err) => {
        const ctx = err.ctx;
        const errorMsg = `Errore nell'aggiornamento ${ctx.update.update_id}: ${err.message}`;
        console.error(`[BotManager] Errore Bot ${botId} (@${botInfo.username}):`, errorMsg);

        try {
          await prisma.log.create({
            data: {
              botId,
              level: "ERROR",
              message: errorMsg,
            },
          });
        } catch (logErr) {
          console.error(`[BotManager] Errore scrittura log nel database:`, logErr);
        }
      });

      // 3. Comandi Telegram iniziali
      bot.command("ping", (ctx) => ctx.reply("Pong da Runtime Moderator!"));

      // 4. Avvio controllato del polling tramite runner non bloccante
      const runner = run(bot);

      // 5. Registrazione in memoria attiva
      this.activeBots.set(botId, { bot, runner });

      // 6. Allineamento stato e salvataggio username nel DB
      await prisma.bot.update({
        where: { id: botId },
        data: {
          isRunning: true,
          username: botInfo.username ?? null,
        },
      });

      console.log(`[BotManager] Bot ${botId} (@${botInfo.username}) avviato con successo.`);
      return {
        success: true,
        message: `Bot ${botId} (@${botInfo.username}) avviato`,
        botInfo: {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name,
        },
      };
    } catch (error) {
      const errorMsg = (error as Error).message || "Errore sconosciuto";
      console.error(`[BotManager] Errore critico all'avvio del Bot ${botId}:`, errorMsg);

      // Registrazione errore nel database
      try {
        await prisma.log.create({
          data: {
            botId,
            level: "CRITICAL",
            message: `Impossibile avviare il bot: ${errorMsg}`,
          },
        });
      } catch (logErr) {
        console.error(`[BotManager] Errore scrittura log:`, logErr);
      }

      // Garantisce che il database non rimanga bloccato su isRunning=true
      try {
        await prisma.bot.update({
          where: { id: botId },
          data: { isRunning: false },
        });
      } catch (dbErr) {
        console.error(`[BotManager] Errore reset stato bot nel DB:`, dbErr);
      }

      return {
        success: false,
        error: `Impossibile avviare il bot: ${errorMsg}`,
      };
    }
  }

  /**
   * Ferma un bot specifico e allinea sempre lo stato nel DB.
   */
  async stopBot(botId: number): Promise<void> {
    const entry = this.activeBots.get(botId);
    if (entry) {
      try {
        if (entry.runner.isRunning()) {
          await entry.runner.stop();
        }
      } catch (error) {
        console.error(`[BotManager] Errore durante l'arresto del runner per Bot ${botId}:`, error);
      } finally {
        this.activeBots.delete(botId);
      }
      console.log(`[BotManager] Bot ${botId} fermato in memoria.`);
    } else {
      console.log(`[BotManager] Bot ${botId} non era attivo in memoria.`);
    }

    // Assicura che il database sia SEMPRE sincronizzato a isRunning: false
    try {
      await prisma.bot.update({
        where: { id: botId },
        data: { isRunning: false },
      });
    } catch (dbErr) {
      console.error(`[BotManager] Errore aggiornamento stato stop nel DB per Bot ${botId}:`, dbErr);
    }
  }

  /**
   * Verifica se un bot è attualmente in esecuzione in memoria.
   */
  isBotRunning(botId: number): boolean {
    const entry = this.activeBots.get(botId);
    return entry !== undefined && entry.runner.isRunning();
  }

  /**
   * Restituisce il numero totale di bot attivi in memoria.
   */
  getActiveBotsCount(): number {
    return this.activeBots.size;
  }

  /**
   * Inizializza tutti i bot contrassegnati come isRunning nel database all'avvio.
   */
  async initAllBots(): Promise<void> {
    console.log("[BotManager] Inizializzazione flotta bot...");
    const botsToStart = await prisma.bot.findMany({
      where: { isRunning: true },
    });

    for (const botRecord of botsToStart) {
      try {
        await this.startBot(botRecord.id, botRecord.token);
      } catch (error) {
        console.error(`[BotManager] Fallita inizializzazione Bot ${botRecord.id}:`, error);
      }
    }
    console.log(`[BotManager] Inizializzazione completata. Bot attivi in memoria: ${this.activeBots.size}`);
  }

  /**
   * Ferma tutte le istanze attive per un graceful shutdown.
   */
  async stopAll(): Promise<void> {
    console.log("[BotManager] Arresto controllato di tutti i bot...");
    const activeIds = Array.from(this.activeBots.keys());
    for (const id of activeIds) {
      await this.stopBot(id);
    }
    console.log("[BotManager] Tutti i bot sono stati arrestati.");
  }
}

export const botManager = new BotManager();
export { prisma };
