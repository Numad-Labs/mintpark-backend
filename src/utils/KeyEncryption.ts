import { config } from "@config/config";
import * as crypto from "crypto";

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

class KeyEncryption {
  private masterKey: Buffer;

  constructor(masterKey: string) {
    if (!masterKey || masterKey.length !== 64) {
      throw new Error("Master key must be 64 hex characters (32 bytes)");
    }
    this.masterKey = Buffer.from(masterKey, "hex");
  }

  /**
   * Encrypt a private key
   */
  encrypt(privateKey: string): EncryptedData {
    // Generate random IV for this encryption
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, iv);

    // Encrypt
    let encrypted = cipher.update(privateKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get auth tag for integrity verification
    const authTag = cipher.getAuthTag();

    // Return all parts needed for decryption
    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex")
    };
  }

  /**
   * Decrypt a private key
   */
  decrypt(encryptedData: EncryptedData): string {
    // Create decipher
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.masterKey,
      Buffer.from(encryptedData.iv, "hex")
    );

    // Set auth tag for verification
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));

    // Decrypt
    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

export const encryption = new KeyEncryption(config.ENCRYPTION_MASTER_KEY);
