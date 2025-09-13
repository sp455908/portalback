#!/usr/bin/env node

/**
 * Secret Generator for Production Environment
 * Generates cryptographically secure secrets for production deployment
 */

const crypto = require('crypto');

console.log('🔐 Generating secure secrets for production deployment...\n');

// Generate random secrets
const generateSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

const secrets = {
  JWT_SECRET: generateSecret(32),
  CSRF_SECRET: generateSecret(32),
  ENCRYPTION_KEY: generateSecret(32),
  SESSION_SECRET: generateSecret(32),
  SETUP_KEY: generateSecret(16)
};

console.log('📋 Copy these values to your Render environment variables:\n');

Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});

console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
console.log('1. Never commit these secrets to version control');
console.log('2. Store them securely in Render environment variables');
console.log('3. Use different secrets for each environment (staging/production)');
console.log('4. Rotate secrets regularly (every 90 days recommended)');
console.log('5. Keep backups of your secrets in a secure password manager');

console.log('\n🚀 Your production environment is now secure!');