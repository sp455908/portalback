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
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      
      // If decryption results in empty string, the data was not encrypted
      if (!decryptedString) {
        return encryptedText; // Return original if not encrypted
      }
      
      return decryptedString;
    } catch (error) {
      console.error('Decryption failed:', error);
      // Return original text if decryption fails (might not be encrypted)
      return encryptedText;
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
