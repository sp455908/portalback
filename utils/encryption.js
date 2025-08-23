const CryptoJS = require('crypto-js');

// ✅ ADD: Encryption utility for sensitive data
class EncryptionService {
  constructor() {
    this.secretKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-key-change-in-production';
    this.algorithm = 'AES-256-CBC';
  }

  // Encrypt sensitive data
  encrypt(text) {
    if (!text) return text;
    
    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.secretKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt sensitive data
  decrypt(encryptedText) {
    if (!encryptedText) return encryptedText;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.secretKey);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
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
    
    try {
      // Try to decrypt - if it works, it was encrypted
      this.decrypt(data);
      return true;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService;
