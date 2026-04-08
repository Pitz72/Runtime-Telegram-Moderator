# 🛡️ Runtime TelegramBot Moderator (v0.1.0) - Multi-Bot Fleet Edition

Benvenuti nel sistema di moderazione Telegram di nuova generazione.
**Runtime TelegramBot Moderator** è un'applicazione web self-hosted di livello Enterprise progettata per la gestione automatizzata, la moderazione e la sicurezza di molteplici gruppi e canali Telegram. 

A differenza dei tradizionali bot di moderazione pubblici (che sollevano enormi problemi di privacy leggendo i dati di tutti gli utenti), questo software nasce con una filosofia **Privacy-First e Zero-Dependencies**. Tutto risiede sul server dell'utente.

Inoltre, il sistema non gestisce un singolo bot, ma implementa un'architettura **Multi-Tenant (Bot Fleet)**: permette a un singolo amministratore di configurare, avviare, stoppare e gestire regole per $X$ bot differenti su $X$ canali simultaneamente da un'unica dashboard unificata.

---

## 👨‍💻 Autori & Crediti

Questo progetto è sviluppato da:

- **Galano Valerio** (PensierInCodice)
- **Pizzi Simone** (Ecosystem.Runtime)

---

## 🏗️ Architettura di Sistema (L'approccio Runtime)

Il sistema si divide in due macro-ambienti (Monorepo), che comunicano tramite API REST:

1. **Il Motore Centrale (Backend Node.js + Bot Manager):**
    Non esiste un singolo script in ascolto. Il backend utilizza un demone che funge da *Bot Manager*. Questo manager interroga il database e istanzia dinamicamente connessioni Telegram (via long-polling) per ogni bot registrato e contrassegnato come "Attivo". Le istanze dei bot vengono mantenute in memoria tramite una `Map<botId, Istanza>` per consentire lo start/stop in tempo reale senza riavviare il server.

2. **La Dashboard di Controllo (Frontend React):**
    Un'interfaccia utente avanzata (ispirata a software desktop professionali) che permette di aggiungere nuovi bot (tramite Bot Token), assegnarli a specifici gruppi e definire le regole di moderazione in modo granulare (per Bot e per Gruppo).

### 📡 API REST Interne (Bot Manager)

Il backend espone una serie di endpoint per permettere alla dashboard (o altri client autorizzati) di orchestrare la flotta in tempo reale. Queste chiamate interagiscono direttamente con il `BotManager` e la sua `Map` in memoria:

-   `GET /api/bots`: Recupera la lista di tutti i bot, il loro stato (`isRunning`) e il conteggio dei gruppi configurati.
-   `POST /api/bots`: Registra un nuovo Bot Token nel database.
-   `POST /api/bots/:id/start`: Forza l'inizializzazione e l'avvio del polling per un bot specifico.
-   `POST /api/bots/:id/stop`: Ferma immediatamente l'istanza del bot e la rimuove dalla memoria attiva.

---

## 🟢 Fase 1: Fondamenta Core (COMPLETATA)

- [x] Inizializzazione Monorepo.
- [x] Setup SQLite + Prisma 7 (Configurazione ESM/NodeNext).
- [x] Sviluppo Modelli Relazionali Multi-Tenant (`Bot`, `GroupConfig`, `Log`).
- [x] Sviluppo `BotManager` (Long-polling dinamico via `grammY` e `Map` in memoria).
- [x] Sviluppo API REST Express 5 per il controllo della flotta.

---

## 🛠️ Stack Tecnologico Obbligatorio

Qualsiasi sviluppo su questa repository deve rigorosamente rispettare il seguente stack:

- **Linguaggio Globale:** `TypeScript` (Strict Mode). Il progetto utilizza nativamente i moduli **ESM** (`"type": "module"` nel `package.json`) e la risoluzione `NodeNext` nel `tsconfig.json` per garantire la massima modernità e performance.
- **Backend Framework:** `Node.js` con **Express 5**. 
    > [!IMPORTANT]
    > Express 5 richiede un casting rigoroso dei tipi per i `req.params`, in quanto possono essere interpretati come array di stringhe.
- **Database & ORM:** **Prisma 7** con `SQLite`. 
    > [!NOTE]
    > In Prisma 7 la configurazione del datasource (e della URL del DB) risiede esclusivamente nel file `prisma.config.ts` gestito tramite `@prisma/config`, lasciando il file `.prisma` dedicato solo alla definizione dei modelli.
- **Libreria Telegram:** `grammY` (gestione robusta di bot multipli e middleware).
- **Frontend Framework:** `React` (Vite).
- **Styling UI:** `Tailwind CSS`.

---

## ⚙️ Funzionalità Core (Roadmap di Sviluppo)

1.  **Dynamic Bot Management:** Aggiunta, rimozione, avvio e spegnimento di singoli bot direttamente dalla UI tramite l'inserimento del Bot Token.
2.  **Granular Rule Engine:** Le regole di moderazione non sono globali, ma incrociate per `BotID` e `GroupID`. Un singolo bot può avere regole diverse a seconda del gruppo in cui si trova.
3.  **Anti-Spam & Quarantine (Captcha):** Sistema di intercettazione `chat_join_request`. Messa in mute istantanea del nuovo utente con sblocco vincolato all'interazione con un pulsante (verifica umana).
4.  **Night Mode (Coprifuoco):** Schedulazione del silenziamento dei gruppi (modifica dei permessi globali della chat tramite API Telegram) in fasce orarie predefinite.
5.  **Live Logging:** Un sistema di log in tempo reale che registra le azioni di sistema (es. "Bot avviato") e le azioni di moderazione (es. "Utente X kickato per spam dal Bot Y").

---

## 📂 Struttura della Repository (Monorepo)

```text
titan-moderator/
│       ├── botManager/   # Logica di orchestrazione grammY (start/stop)
│       └── services/     # Logica di business (Captcha, Mute, ecc.)
└── frontend/             # Dashboard React + Vite
    ├── package.json
    └── src/
        ├── components/   # UI elements (Tailwind)
        ├── pages/        # Viste della dashboard
        └── api/          # Chiamate Axios verso il backend
```

---

## 🚀 Avvio dell'Ambiente di Sviluppo

### Prerequisiti
- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/) installati.

### Avvio con Docker (consigliato)

```bash
docker compose up --build
```

Il container esegue automaticamente le migrazioni Prisma al primo avvio e si riavvia ad ogni modifica ai file in `backend/src/` (hot-reload via `nodemon`).

Il database SQLite è persistito nel volume Docker `db_data` e sopravvive ai riavvii del container.

| Servizio    | URL                              |
|-------------|----------------------------------|
| Backend API | `http://localhost:3000/api/bots` |

---

> [!NOTE]
> La cartella `PROTOTIPO-INTEFACCIA-TEMP` contiene le bozze statiche del prototipo finale dell'interfaccia. Queste bozze sono fornite come riferimento per lo sviluppo futuro, ma la loro implementazione completa sarà discussa solo al termine del core engine.

### Avvio locale (senza Docker)

```bash
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

> [!NOTE]
> In locale il database viene creato in `backend/dev.db`. Con Docker viene usato il volume `db_data` con path interno `/app/data/titan.db`.

### Variabili d'Ambiente

| Variabile      | Default          | Descrizione               |
|----------------|------------------|---------------------------|
| `PORT`         | `3000`           | Porta del server Express  |
| `DATABASE_URL` | `file:./dev.db`  | Path del database SQLite  |

---

## 🧪 Testing

Il sistema di test usa **Vitest** con mock di Prisma e grammY. I test non richiedono un database reale né connessioni a Telegram.

### Eseguire i test

```bash
# Esecuzione singola
docker compose run --rm backend npm test

# Watch mode (riesegue ad ogni modifica)
docker compose run --rm backend npm run test:watch

# Con report di coverage
docker compose run --rm backend npm run test:coverage
```

### Struttura dei test

| File                               | Tipo        | Cosa testa                                       |
|------------------------------------|-------------|--------------------------------------------------|
| `src/__tests__/botManager.test.ts` | Unit        | `BotManager`: start, stop, init, resilienza      |
| `src/__tests__/api.test.ts`        | Integration | Tutte le route REST: risposte, validazione, 404  |

---

## 🤖 Istruzioni Cruciali per gli Agenti LLM (AI Context)

Se sei un'Intelligenza Artificiale che sta assistendo lo sviluppatore in questo progetto, **DEVI** rispettare le seguenti regole in ogni tua risposta o generazione di codice:

1.  **Pensa Multi-Bot:** Non scrivere **MAI** codice come `const bot = new Bot(process.env.TOKEN); bot.start();` nel backend. Tutte le istanze bot devono essere gestite da una classe `BotManager` che le preleva dal database Prisma.
2.  **Isolamento del Contesto:** Quando scrivi la logica di un comando Telegram o un ascoltatore di eventi (es. `bot.on('message')`), ricordati sempre che il bot deve prima verificare le regole nel database specifiche per quel gruppo e per quel bot.
3.  **Step-by-Step:** Sviluppa moduli isolati. Non sovrascrivere l'intera architettura se ti viene richiesto di implementare una singola funzionalità. Segui fedelmente i prompt nucleari forniti dallo sviluppatore.
4.  **Gestione Errori:** Nel contesto Multi-Bot, un token revocato o un bot espulso da un gruppo non deve **MAI** far crashare l'intero server Node.js. Usa blocchi `try/catch` per isolare le eccezioni al singolo bot.
5.  **Strict TypeScript:** Definisci sempre le interfacce (`interface` o `type`) per le risposte API e le configurazioni del bot. Niente `any`.
