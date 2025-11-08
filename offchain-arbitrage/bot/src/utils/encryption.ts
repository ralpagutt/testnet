import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Simple keystore encryption/decryption utility
 * WARNING: This is a basic implementation. For production, use Web3 keystore format.
 */

interface EncryptedKeystore {
  encrypted: string;
  iv: string;
  salt: string;
  version: string;
}

export class KeystoreManager {
  private algorithm = 'aes-256-gcm';

  /**
   * Encrypt private key and save to file
   */
  encryptAndSave(privateKey: string, password: string, filepath: string): void {
    // Generate salt and derive key
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    // Generate IV
    const iv = crypto.randomBytes(16);

    // Encrypt
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Create keystore object
    const keystore: EncryptedKeystore = {
      encrypted: encrypted + authTag.toString('hex'),
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      version: '1.0'
    };

    // Save to file
    fs.writeFileSync(filepath, JSON.stringify(keystore, null, 2), { mode: 0o600 });
    console.log(`✅ Keystore saved to ${filepath}`);
  }

  /**
   * Load and decrypt private key from file
   */
  loadAndDecrypt(filepath: string, password: string): string {
    // Read keystore file
    const keystoreData = fs.readFileSync(filepath, 'utf-8');
    const keystore: EncryptedKeystore = JSON.parse(keystoreData);

    // Derive key from password
    const salt = Buffer.from(keystore.salt, 'hex');
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    // Extract IV and auth tag
    const iv = Buffer.from(keystore.iv, 'hex');
    const encryptedData = keystore.encrypted;
    const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
    const encrypted = encryptedData.slice(0, -32);

    // Decrypt
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Check if keystore file exists
   */
  exists(filepath: string): boolean {
    return fs.existsSync(filepath);
  }
}

// Export singleton
export const keystoreManager = new KeystoreManager();

/**
 * Helper function to get private key from config
 */
export function getPrivateKey(config: any): string {
  // Option 1: Direct private key from env
  if (config.wallet.privateKey) {
    return config.wallet.privateKey;
  }

  // Option 2: Encrypted keystore
  if (config.wallet.keystorePath && config.wallet.password) {
    if (!keystoreManager.exists(config.wallet.keystorePath)) {
      throw new Error(`Keystore file not found: ${config.wallet.keystorePath}`);
    }

    return keystoreManager.loadAndDecrypt(
      config.wallet.keystorePath,
      config.wallet.password
    );
  }

  throw new Error('No private key configuration found');
}
