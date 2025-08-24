require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('🔐 Testing JWT Configuration...');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'NOT SET');
console.log('JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN || '7d');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set!');
  process.exit(1);
}

// Test JWT token generation
try {
  const testUser = { id: 1, email: 'test@example.com' };
  const token = jwt.sign(testUser, process.env.JWT_SECRET, { 
    expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
  });
  
  console.log('✅ JWT token generated successfully');
  console.log('Token length:', token.length);
  
  // Test JWT token verification
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('✅ JWT token verified successfully');
  console.log('Decoded payload:', decoded);
  
  // Test token expiration
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = decoded.exp - now;
  console.log('⏰ Token expires in:', Math.floor(timeUntilExpiry / 3600), 'hours');
  
} catch (error) {
  console.error('❌ JWT test failed:', error.message);
  process.exit(1);
}

console.log('🎉 All JWT tests passed!'); 