# 🗺️ Titan Telegram Moderator - Technical Roadmap

Questo documento delinea gli step architetturali e operativi per portare Titan dalla sua infrastruttura base (v0.0.2) alla release di produzione (v1.0.0).

## 🟢 Fase 1: Fondamenta Core (COMPLETATA)
- [x] Inizializzazione Monorepo.
- [x] Setup SQLite + Prisma 7 (Configurazione ESM/NodeNext).
- [x] Sviluppo Modelli Relazionali Multi-Tenant (`Bot`, `GroupConfig`, `Log`).
- [x] Sviluppo `BotManager` (Long-polling dinamico via `grammY` e `Map` in memoria).
- [x] Sviluppo API REST Express 5 per il controllo della flotta.

---

## 🟡 Fase 2: Sviluppo Dashboard Frontend (React/Vite)
**Obiettivo:** Creare l'interfaccia UI (stile "Titan Desktop") per gestire i bot senza usare chiamate API manuali.
- [ ] **Setup React:** Inizializzazione Vite + React + TypeScript + Tailwind CSS.
- [ ] **API Client:** Configurazione di Axios per dialogare con `localhost:3000/api`.
- [ ] **Viste Principali:**
  - `Dashboard`: Statistiche globali e bot attivi.
  - `Bot Fleet Manager`: Tabella per aggiungere/rimuovere bot, inserire i Token e avviare/stoppare i processi (interruttori UI collegati a `/start` e `/stop`).
  - `Group Configuration`: UI per selezionare un Bot, inserire il `groupId` e configurare le regole tramite interruttori (Captcha abilitato, Night Mode).

---

## 🟠 Fase 3: Logica di Moderazione Telegram (Il Cuore di grammY)
**Obiettivo:** Trasformare i bot da semplici "Ping/Pong" a veri moderatori leggendo le regole dal DB.
- [ ] **Middleware di Configurazione:** Creare un middleware grammY che intercetta ogni messaggio, legge il `ctx.chat.id`, interroga Prisma (`GroupConfig`) e inietta le regole nel `ctx` per l'uso nei passaggi successivi.
- [ ] **Sistema Anti-Spam (Blacklist):** Implementare un listener sui messaggi testuali che verifica la presenza di `bannedWords` (salvate nel DB). Se trovate -> `ctx.deleteMessage()`.
- [ ] **Sistema Captcha (chat_join_request):**
  - Listener sull'evento di ingresso di un nuovo utente.
  - Restrizione istantanea (Mute).
  - Invio di un messaggio con Inline Keyboard (Pulsante: "Sono un umano").
  - Gestione della Callback Query: se cliccato, ripristino permessi e cancellazione messaggio captcha.

---

## 🔴 Fase 4: Funzionalità Avanzate e Cron Jobs
**Obiettivo:** Implementare le automazioni legate al tempo e il tracciamento.
- [ ] **Night Mode (Coprifuoco):**
  - Integrazione di `node-cron` nel backend.
  - Un worker che controlla ogni minuto se l'ora attuale coincide con `nightModeStart` o `nightModeEnd` di qualsiasi `GroupConfig`.
  - Se sì, utilizza le API di Telegram (`setChatPermissions`) per disabilitare/abilitare l'invio di messaggi nel gruppo, inviando un avviso testuale.
- [ ] **Live Logging System:**
  - Sostituire i `console.log` base con inserimenti nella tabella Prisma `Log` per ogni azione punitiva (es. "Messaggio cancellato", "Utente mutato").
  - Esposizione API `/api/logs` e visualizzazione nella dashboard React.

---

## 🟣 Fase 5: Packaging e Distribuzione (Release)
**Obiettivo:** Rendere Titan installabile da chiunque su un VPS con un singolo comando.
- [ ] **Dockerizzazione:** Creazione di un `Dockerfile` multi-stage che compila sia il frontend (React build) che il backend (TypeScript compile), per poi servire la cartella di build di React tramite Express come file statici.
- [ ] **Docker Compose:** Creazione di un `docker-compose.yml` per mappare il volume del database SQLite esternamente, garantendo la persistenza dei dati durante gli aggiornamenti.
- [ ] **Sicurezza (Autenticazione Admin):** Aggiunta di un semplice login JWT al backend e al frontend per evitare che chiunque conosca l'IP del server possa accedere alla dashboard.
