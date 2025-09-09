// Test script to verify phone number decryption with production data
require('dotenv').config();
const encryptionService = require('./utils/encryption');

console.log('🧪 Testing phone number decryption with production data...\n');

// The encrypted phone number from your production database
const encryptedPhone = 'U2FsdGVkX18cGRnciwfq+oJV3kk+yLvzyV56wu3EfwI=';

console.log(`Encrypted phone: ${encryptedPhone}`);

try {
  const decryptedPhone = encryptionService.decrypt(encryptedPhone);
  console.log(`Decrypted phone: ${decryptedPhone}`);
  console.log('✅ Successfully decrypted the phone number!');
} catch (error) {
  console.log(`❌ Error decrypting: ${error.message}`);
  console.log('This means the encryption key in production is different from local.');
}

// Test with a new phone number to show encryption/decryption works
console.log('\n--- Testing with new phone number ---');
const testPhone = '9988224488';
const encrypted = encryptionService.encrypt(testPhone);
const decrypted = encryptionService.decrypt(encrypted);

console.log(`Original: ${testPhone}`);
console.log(`Encrypted: ${encrypted}`);
console.log(`Decrypted: ${decrypted}`);
console.log(`Match: ${testPhone === decrypted ? '✅ YES' : '❌ NO'}`);