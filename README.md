# 🛡️ Titan Telegram Moderator (Multi-Bot Fleet Edition)

## 📖 Visione del Progetto
**Titan Telegram Moderator** è un'applicazione web self-hosted di livello Enterprise progettata per la gestione automatizzata, la moderazione e la sicurezza di molteplici gruppi e canali Telegram. 

A differenza dei tradizionali bot di moderazione pubblici (che sollevano enormi problemi di privacy leggendo i dati di tutti gli utenti), Titan nasce con una filosofia **Privacy-First e Zero-Dependencies**. Tutto risiede sul server dell'utente.

Inoltre, Titan non gestisce un singolo bot, ma implementa un'architettura **Multi-Tenant (Bot Fleet)**: permette a un singolo amministratore di configurare, avviare, stoppare e gestire regole per $X$ bot differenti su $X$ canali simultaneamente da un'unica dashboard unificata.

---

## 🏗️ Architettura di Sistema (Il Paradigma "Titan")

Il sistema si divide in due macro-ambienti (Monorepo), che comunicano tramite API REST:

1.  **Il Motore Centrale (Backend Node.js + Bot Manager):**
    Non esiste un singolo script in ascolto. Il backend utilizza un demone che funge da *Bot Manager*. Questo manager interroga il database e istanzia dinamicamente connessioni Telegram (via long-polling) per ogni bot registrato e contrassegnato come "Attivo". Le istanze dei bot vengono mantenute in memoria tramite una `Map<botId, Istanza>` per consentire lo start/stop in tempo reale senza riavviare il server.

2.  **La Dashboard di Controllo (Frontend React):**
    Un'interfaccia utente avanzata (ispirata a software desktop professionali) che permette di aggiungere nuovi bot (tramite Bot Token), assegnarli a specifici gruppi e definire le regole di moderazione in modo granulare (per Bot e per Gruppo).

---

## 🛠️ Stack Tecnologico Obbligatorio

Qualsiasi sviluppo su questa repository deve rigorosamente rispettare il seguente stack:

*   **Linguaggio Globale:** `TypeScript` (Strict Mode) - Nessun file `.js` puro ammesso, la tipizzazione è vitale per la comunicazione Frontend-Backend.
*   **Backend Framework:** `Node.js` con `Express.js`.
*   **Database & ORM:** `SQLite` gestito tramite `Prisma ORM`.
*   **Libreria Telegram:** `grammY` (scelta obbligata per la gestione robusta di bot multipli e middleware in TypeScript).
*   **Frontend Framework:** `React` (inizializzato con `Vite`).
*   **Styling UI:** `Tailwind CSS`.

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
├── .env                  # Variabili d'ambiente globali (Porte, JWT secrets)
├── README.md             # Questo file (Master Context)
├── backend/              # Node.js Server & Bot Manager
│   ├── package.json
│   ├── prisma/           # Schema Database SQLite
│   └── src/
│       ├── index.ts      # Entry point server Express
│       ├── api/          # Route API REST per il frontend
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

## 🤖 Istruzioni Cruciali per gli Agenti LLM (AI Context)

Se sei un'Intelligenza Artificiale che sta assistendo lo sviluppatore in questo progetto, **DEVI** rispettare le seguenti regole in ogni tua risposta o generazione di codice:

1.  **Pensa Multi-Bot:** Non scrivere **MAI** codice come `const bot = new Bot(process.env.TOKEN); bot.start();` nel backend. Tutte le istanze bot devono essere gestite da una classe `BotManager` che le preleva dal database Prisma.
2.  **Isolamento del Contesto:** Quando scrivi la logica di un comando Telegram o un ascoltatore di eventi (es. `bot.on('message')`), ricordati sempre che il bot deve prima verificare le regole nel database specifiche per quel gruppo e per quel bot.
3.  **Step-by-Step:** Sviluppa moduli isolati. Non sovrascrivere l'intera architettura se ti viene richiesto di implementare una singola funzionalità. Segui fedelmente i prompt nucleari forniti dallo sviluppatore.
4.  **Gestione Errori:** Nel contesto Multi-Bot, un token revocato o un bot espulso da un gruppo non deve **MAI** far crashare l'intero server Node.js. Usa blocchi `try/catch` per isolare le eccezioni al singolo bot.
5.  **Strict TypeScript:** Definisci sempre le interfacce (`interface` o `type`) per le risposte API e le configurazioni del bot. Niente `any`.

