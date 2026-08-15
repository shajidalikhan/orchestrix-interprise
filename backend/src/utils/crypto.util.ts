import * as crypto from 'crypto';

export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  /**
   * Encrypts plain text using AES-256-GCM.
   * @param text Plain text to encrypt
   * @param keySecret Master key string (derived or loaded from environment)
   */
  static encrypt(text: string, keySecret: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    // Derive a 32-byte key from the secret
    const key = crypto.scryptSync(keySecret, 'salt-salt-salt', 32);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    // Store as: IV + TAG + CIPHERTEXT
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  /**
   * Decrypts encrypted text using AES-256-GCM.
   * @param cipherText Encrypted string (IV:TAG:CIPHERTEXT)
   * @param keySecret Master key string
   */
  static decrypt(cipherText: string, keySecret: string): string {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid cipher text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = crypto.scryptSync(keySecret, 'salt-salt-salt', 32);
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
