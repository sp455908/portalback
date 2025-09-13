#!/usr/bin/env node

/**
 * CORS Test Script for IIFTL Backend
 * This script tests the CORS configuration to ensure it works correctly
 */

const https = require('https');
const http = require('http');

const testOrigins = [
  'https://iiftl-portal.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://example.com' // This should be blocked
];

const testEndpoints = [
  '/api/auth/me',
  '/api/captcha/id',
  '/health'
];

function makeRequest(url, origin = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'OPTIONS', // Test preflight request
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testCORS() {
  console.log('🧪 Testing CORS Configuration for IIFTL Backend\n');
  
  const baseUrl = process.argv[2] || 'https://portalback-8tth.onrender.com';
  console.log(`Testing against: ${baseUrl}\n`);

  for (const origin of testOrigins) {
    console.log(`\n📍 Testing origin: ${origin}`);
    console.log('─'.repeat(50));
    
    for (const endpoint of testEndpoints) {
      const url = `${baseUrl}${endpoint}`;
      
      try {
        const response = await makeRequest(url, origin);
        
        const corsOrigin = response.headers['access-control-allow-origin'];
        const corsCredentials = response.headers['access-control-allow-credentials'];
        const corsMethods = response.headers['access-control-allow-methods'];
        
        console.log(`  ${endpoint}:`);
        console.log(`    Status: ${response.statusCode}`);
        console.log(`    CORS Origin: ${corsOrigin || 'Not set'}`);
        console.log(`    CORS Credentials: ${corsCredentials || 'Not set'}`);
        console.log(`    CORS Methods: ${corsMethods || 'Not set'}`);
        
        // Check if CORS is working correctly
        const isAllowedOrigin = origin === 'https://iiftl-portal.vercel.app' || 
                               origin.startsWith('http://localhost') || 
                               origin.startsWith('http://127.0.0.1');
        
        if (isAllowedOrigin) {
          if (corsOrigin === origin || corsOrigin === '*') {
            console.log(`    ✅ CORS correctly configured`);
          } else {
            console.log(`    ❌ CORS not properly configured for allowed origin`);
          }
        } else {
          if (!corsOrigin) {
            console.log(`    ✅ CORS correctly blocked unauthorized origin`);
          } else {
            console.log(`    ❌ CORS incorrectly allowed unauthorized origin`);
          }
        }
        
      } catch (error) {
        console.log(`  ${endpoint}:`);
        console.log(`    ❌ Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n🏁 CORS testing completed!');
  console.log('\nIf you see CORS errors, make sure:');
  console.log('1. The backend server is running');
  console.log('2. The CORS configuration is properly deployed');
  console.log('3. The allowed origins include your frontend domain');
}

// Run the test
testCORS().catch(console.error);