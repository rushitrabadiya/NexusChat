import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Default to a hardcoded 32-byte key if env is missing during tests (DO NOT DO THIS IN PROD)
const DEFAULT_KEY = '8b4c20d7f9a1e3b56c8d20f1a9b4e7c3d2f9a1e8c6b5d4f3a2b1e0c9d8e7f6a5';

function getSecretKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || DEFAULT_KEY;
  return Buffer.from(secret, 'hex');
}

export class CryptoUtil {
  /**
   * Encrypts a plain text string into a hex string (iv:encryptedData)
   */
  static encrypt(text: string): string {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts a hex string (iv:encryptedData) back into plain text
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

    try {
      const [ivHex, dataHex] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
      let decrypted = decipher.update(dataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      console.error('[CryptoUtil] Failed to decrypt data');
      return '';
    }
  }
}
