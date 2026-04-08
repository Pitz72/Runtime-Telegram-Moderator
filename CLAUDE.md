# CLAUDE.md — Istruzioni operative per il Runtime Moderator

Questo file definisce come Claude deve operare su questo progetto. Va letto prima di qualsiasi altra attività.

---

## Ambiente di esecuzione

**Tutto gira dentro Docker.** Non eseguire mai `npm install`, `npm run *`, `npx` o comandi Node.js direttamente nel terminale locale. Usare sempre i comandi Docker equivalenti.

---

## Avviare il progetto

```bash
# Prima volta o dopo modifiche al Dockerfile / package.json
docker compose up --build

# Avvio normale (immagine già built)
docker compose up
```

Il container esegue automaticamente `prisma migrate deploy` all'avvio prima di lanciare il server.

---

## Attività di sviluppo

### Installare o aggiornare dipendenze

Modificare `backend/package.json`, poi ricostruire l'immagine:

```bash
docker compose up --build
```

### Creare una nuova migrazione Prisma

Dopo aver modificato `backend/prisma/schema.prisma`:

```bash
docker compose run --rm backend npx prisma migrate dev --name <nome_migrazione>
```

### Aprire una shell nel container

```bash
docker compose run --rm backend sh
```

### Verificare i log del server

```bash
docker compose logs -f backend
```

---

## Eseguire i test

I test usano **Vitest** con mock completi di Prisma e grammY. Non richiedono database reale né connessioni a Telegram.

```bash
# Esecuzione singola (CI)
docker compose run --rm backend npm test

# Watch mode durante lo sviluppo
docker compose run --rm backend npm run test:watch

# Con report di coverage
docker compose run --rm backend npm run test:coverage
```

### Struttura dei test

I test si trovano in `backend/src/__tests__/`. Ogni modulo ha il proprio file:

- `botManager.test.ts` — unit test della classe `BotManager`
- `api.test.ts` — integration test delle route Express via `supertest`

### Regole per scrivere test

- Mockare sempre `@prisma/client` e `grammy` nei test unitari.
- Nei test API, mockare l'intero modulo `../botManager/index.js`.
- Non usare un database reale nei test: tutto va mockato.
- I file di test vanno in `src/__tests__/` con naming `<modulo>.test.ts`.

---

## Regole di sviluppo

### Stack obbligatorio

- **TypeScript** strict mode, moduli ESM (`"type": "module"`), risoluzione `NodeNext`
- **Express 5** — castare sempre `req.params` esplicitamente (`id as string`)
- **Prisma 7** — la configurazione del datasource sta in `prisma.config.ts`, non nello schema
- **grammY** — mai istanziare `Bot` direttamente nell'applicazione; usare sempre `BotManager`

### Architettura multi-bot

Non scrivere mai codice del tipo:

```typescript
// SBAGLIATO
const bot = new Bot(process.env.TOKEN);
bot.start();
```

Tutte le istanze bot sono gestite da `BotManager` in `src/botManager/index.ts`, che le preleva dal database e le mantiene in una `Map<number, Bot>`.

### Gestione degli errori

Un token revocato o un errore su un singolo bot non deve mai far crashare il server. Isolare sempre gli errori per bot con `try/catch` e loggare nel database tramite `prisma.log.create`.

### Modifiche al codice

- Sviluppare moduli isolati, un'entità alla volta.
- Non sovrascrivere l'architettura esistente per implementare una singola funzionalità.
- Definire sempre `interface` o `type` per le strutture dati. Mai usare `any`.
- Aggiungere test per ogni nuovo modulo o route.