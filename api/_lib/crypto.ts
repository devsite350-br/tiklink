// API key encryption helpers (AES-256-GCM).
//
// The encryption key is derived from APP_ENCRYPTION_KEY (a per-deployment secret)
// instead of the Firebase project id, so no developer-specific value is baked in.
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

const getKey = () => {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) throw new Error('APP_ENCRYPTION_KEY env var is not set');
  return crypto.scryptSync(secret, 'simpofy-api-key-salt', 32);
};

export const encryptApiKey = (plainText: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptApiKey = (encryptedText: string): string => {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return encryptedText;
  const [ivHex, authTagHex, ciphertext] = parts;
  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e: any) {
    console.error('[decryptApiKey] Decryption failed:', e.message);
    return encryptedText;
  }
};

export const maskApiKey = (key: string): string =>
  key.length > 7
    ? `${key.slice(0, 4)}${'•'.repeat(key.length - 7)}${key.slice(-3)}`
    : '•'.repeat(key.length);
