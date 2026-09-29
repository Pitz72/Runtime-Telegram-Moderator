# --- Base Stage ---
FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
COPY tsconfig.json ./

# --- Dev Stage ---
FROM base AS dev

RUN npm install
RUN DATABASE_URL="file:./dev.db" npx prisma generate

COPY src/ ./src/

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]

# --- Builder Stage ---
FROM base AS builder

RUN npm install
RUN DATABASE_URL="file:./dev.db" npx prisma generate

COPY src/ ./src/

RUN npm run build

# --- Prod Stage ---
FROM node:22-alpine AS prod

WORKDIR /app

# Assicura che la directory per il volume SQLite esista
RUN mkdir -p /app/data

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma/ ./prisma/
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]