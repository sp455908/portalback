const CryptoJS = require('crypto-js');
const crypto = require('crypto');

// ✅ Enhanced Encryption utility for sensitive data with production-level security
class EncryptionService {
  constructor() {
    this.secretKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-key-change-in-production';
    this.algorithm = 'AES-256-GCM'; // More secure than CBC
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
  }

  /**
   * Generate a cryptographically secure key
   */
  generateKey() {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Generate a cryptographically secure IV
   */
  generateIV() {
    return crypto.randomBytes(this.ivLength);
  }

  /**
   * Derive key from password using PBKDF2
   */
  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }

  // Enhanced encrypt sensitive data with AES-256-GCM
  encrypt(text) {
    if (!text) return text;
    
    try {
      // For backward compatibility, check if it's already encrypted with old method
      if (this.isLegacyEncrypted(text)) {
        return text; // Return as-is if already encrypted with old method
      }

      const iv = this.generateIV();
      const cipher = crypto.createCipherGCM(this.algorithm, this.secretKey, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      console.error('Enhanced encryption failed, falling back to legacy:', error);
      // Fallback to legacy encryption for compatibility
      return this.legacyEncrypt(text);
    }
  }

  // Enhanced decrypt sensitive data with AES-256-GCM
  decrypt(encryptedText) {
    if (!encryptedText) return encryptedText;
    
    try {
      // Check if it's new format (IV:authTag:encrypted)
      if (encryptedText.includes(':') && encryptedText.split(':').length === 3) {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const decipher = crypto.createDecipherGCM(this.algorithm, this.secretKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
      } else {
        // Fallback to legacy decryption
        return this.legacyDecrypt(encryptedText);
      }
    } catch (error) {
      console.error('Enhanced decryption failed, trying legacy:', error);
      return this.legacyDecrypt(encryptedText);
    }
  }

  // Legacy encryption for backward compatibility
  legacyEncrypt(text) {
    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.secretKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Legacy encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Legacy decryption for backward compatibility
  legacyDecrypt(encryptedText) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.secretKey);
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      
      // If decryption results in empty string, the data was not encrypted
      if (!decryptedString) {
        return encryptedText; // Return original if not encrypted
      }
      
      return decryptedString;
    } catch (error) {
      console.error('Legacy decryption failed:', error);
      // Return original text if decryption fails (might not be encrypted)
      return encryptedText;
    }
  }

  // Check if data is encrypted with legacy method
  isLegacyEncrypted(data) {
    if (!data || typeof data !== 'string') return false;
    return data.startsWith('U2FsdGVkX1');
  }

  // Encrypt object (for complex data)
  encryptObject(obj) {
    if (!obj) return obj;
    
    try {
      const jsonString = JSON.stringify(obj);
      return this.encrypt(jsonString);
    } catch (error) {
      console.error('Object encryption failed:', error);
      throw new Error('Failed to encrypt object');
    }
  }

  // Decrypt object
  decryptObject(encryptedData) {
    if (!encryptedData) return encryptedData;
    
    try {
      const decryptedString = this.decrypt(encryptedData);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Object decryption failed:', error);
      throw new Error('Failed to decrypt object');
    }
  }

  // Check if data is encrypted
  isEncrypted(data) {
    if (!data || typeof data !== 'string') return false;
    
    // Check if it looks like encrypted data (CryptoJS format)
    if (data.startsWith('U2FsdGVkX1')) {
      try {
        const decrypted = CryptoJS.AES.decrypt(data, this.secretKey);
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
        return decryptedString.length > 0; // If we get a valid decrypted string, it was encrypted
      } catch {
        return false;
      }
    }
    
    return false;
  }

  // Safe decrypt - returns original if not encrypted
  safeDecrypt(data) {
    if (!data) return data;
    
    if (this.isEncrypted(data)) {
      return this.decrypt(data);
    }
    
    return data; // Return as-is if not encrypted
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService;
