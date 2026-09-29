import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const DEFAULT_SALT = "runtime-telegram-moderator-salt-2026";

/**
 * Deriva una chiave crittografica a 256 bit da una chiave master o da un secret.
 */
function getEncryptionKey(): Buffer {
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64) {
    return Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  }
  const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || DEFAULT_SALT;
  return crypto.scryptSync(secret, DEFAULT_SALT, 32);
}

/**
 * Cifra un token Telegram prima di salvarlo nel database.
 * Formato: iv:authTag:ciphertext (tutto esadecimale)
 */
export function encryptToken(token: string): string {
  if (!token) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decifra un token Telegram memorizzato nel database.
 * Se il token è in chiaro (es. inserito prima dell'introduzione della cifratura), lo restituisce invariato.
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData) return "";
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    // Il token è in formato legacy (in chiaro)
    return encryptedData;
  }

  const [ivHex, authTagHex, encrypted] = parts;
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // Se fallisce la decifratura, restituisce la stringa originale
    return encryptedData;
  }
}

/**
 * Maschera un token Telegram per l'esposizione sicura via API.
 * Esempio: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" -> "123456789:•••••••••••••••••••••wxYZ"
 */
export function maskToken(rawOrEncryptedToken: string): string {
  if (!rawOrEncryptedToken) return "";
  const plain = decryptToken(rawOrEncryptedToken);
  const parts = plain.split(":");
  if (parts.length !== 2) {
    return "••••••••••••••••••••";
  }
  const [botId, secret] = parts;
  if (secret.length <= 4) {
    return `${botId}:••••`;
  }
  const maskedSecret = "•".repeat(Math.max(8, secret.length - 4)) + secret.slice(-4);
  return `${botId}:${maskedSecret}`;
}

/**
 * Valida il formato standard di un Bot Token di Telegram (es. 123456789:AA...ZZ).
 */
export function isValidTelegramToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const regex = /^\d{8,12}:[A-Za-z0-9_-]{30,50}$/;
  return regex.test(token.trim());
}
