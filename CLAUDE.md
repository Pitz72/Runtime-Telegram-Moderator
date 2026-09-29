# CLAUDE.md — Istruzioni operative per il Runtime Moderator

Questo file definisce come Claude e gli sviluppatori devono operare su questo progetto. Va letto prima di qualsiasi attività.

---

## Ambiente di esecuzione

Il progetto supporta sia l'esecuzione containerizzata con **Docker**, sia lo sviluppo locale diretto con **Node.js (v22+)** su Windows, macOS e Linux.

### Opzione A: Sviluppo Locale Diretto (Rapido)
```bash
cd backend
npm install
npm test
npm run dev
```

### Opzione B: Docker (Produzione & CI)
```bash
# Prima volta o dopo modifiche al Dockerfile / package.json
docker compose up --build

# Avvio normale
docker compose up
```

---

## Eseguire i test

I test usano **Vitest** con mock completi di Prisma e grammY. Non richiedono database reale né connessioni esterne a Telegram.

```bash
cd backend

# Esecuzione singola
npm test

# Watch mode durante lo sviluppo
npm run test:watch

# Con report di coverage
npm run test:coverage
```

### Struttura dei test
- `src/__tests__/botManager.test.ts` — unit test di `BotManager` (handshake `getMe`, `@grammyjs/runner`, start/stop, resilienza)
- `src/__tests__/api.test.ts` — integration test delle route Express via `supertest` (CRUD Bot, validazione, mascheramento token, logs, groups)

---

## Regole di Sviluppo & Sicurezza

### Stack Obbligatorio
- **TypeScript** strict mode, moduli ESM (`"type": "module"`), risoluzione `NodeNext`.
- **Express 5** — castare e validare sempre i parametri numerici (es. `parseNumericId`).
- **Prisma 7** — configurazione datasource in `prisma.config.ts` con `@prisma/config` e adapter `better-sqlite3`.
- **SQLite Concurrency** — modalità WAL (`journal_mode = WAL`) e `busy_timeout = 5000` sempre attivi per evitare colli di bottiglia e `SQLITE_BUSY`.
- **grammY & Runner** — mai chiamare `bot.start()` per bot multipli; usare sempre `@grammyjs/runner` con validazione preventiva `await bot.api.getMe()`.

### Privacy & Token Security
- **Zero Token in Chiaro via API**: non esporre mai i token Telegram in chiaro negli endpoint REST. Usare sempre `maskToken()` da `src/utils/crypto.ts` (`tokenMasked`).
- **Cifratura a Riposo**: tutti i token memorizzati nel database SQLite devono essere cifrati tramite `encryptToken()` e decifrati solo all'istanziazione tramite `decryptToken()`.
- **Database fuori da Git**: non committare mai file `.db`, `.sqlite`, `.db-wal` o file di database nel repository.

### Resilienza & Isolamento degli Errori
- Un token revocato, errato o un bot espulso da una chat **non deve MAI far crashare il server**.
- `BotManager.startBot()` valida preventivamente le credenziali tramite `bot.api.getMe()`. In caso di errore (es. `401 Unauthorized`), restituisce `{ success: false, error }`, registra un log `CRITICAL` nel DB e mantiene `isRunning: false`.
- L'API Express risponde con status HTTP `400` coerente, permettendo all'interfaccia utente di mostrare il motivo del mancato avvio.

### Tipizzazione Rigorosa
- Definire sempre `interface` o `type` per le strutture dati. Mai usare `any`.
- Aggiungere test per ogni nuovo modulo o route.