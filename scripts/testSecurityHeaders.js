#!/usr/bin/env node

/**
 * Security Headers Test Script
 * Tests the security headers implemented to address OWASP ZAP findings
 */

const https = require('https');
const http = require('http');
const url = require('url');

// Configuration
const TEST_URLS = [
  'https://iiftl-portal.vercel.app',
  'https://iiftl-portal.vercel.app/signin',
  'https://iiftl-portal.vercel.app/courses',
  'https://iiftl-portal.vercel.app/robots.txt'
];

const SENSITIVE_PATHS = ['/signin', '/signup', '/dashboard'];

// Expected security headers
const EXPECTED_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': /max-age=\d+; includeSubDomains; preload/,
  'Content-Security-Policy': /frame-ancestors 'none'/
};

// Expected cache control for sensitive pages
const EXPECTED_CACHE_HEADERS = {
  'Cache-Control': /no-store, no-cache, must-revalidate, private/,
  'Pragma': 'no-cache',
  'Expires': '0'
};

function makeRequest(testUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(testUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Security-Test-Script/1.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function testSecurityHeaders(headers, url) {
  console.log(`\n🔒 Testing Security Headers for: ${url}`);
  console.log('=' .repeat(60));
  
  let allPassed = true;
  
  // Test core security headers
  for (const [header, expectedValue] of Object.entries(EXPECTED_HEADERS)) {
    const actualValue = headers[header.toLowerCase()];
    
    if (!actualValue) {
      console.log(`❌ Missing: ${header}`);
      allPassed = false;
    } else if (expectedValue instanceof RegExp) {
      if (!expectedValue.test(actualValue)) {
        console.log(`❌ ${header}: Expected pattern ${expectedValue}, got "${actualValue}"`);
        allPassed = false;
      } else {
        console.log(`✅ ${header}: ${actualValue}`);
      }
    } else if (actualValue !== expectedValue) {
      console.log(`❌ ${header}: Expected "${expectedValue}", got "${actualValue}"`);
      allPassed = false;
    } else {
      console.log(`✅ ${header}: ${actualValue}`);
    }
  }
  
  // Test cache control for sensitive pages
  const isSensitivePage = SENSITIVE_PATHS.some(path => url.includes(path));
  if (isSensitivePage) {
    console.log('\n📋 Testing Cache Control Headers (Sensitive Page):');
    for (const [header, expectedValue] of Object.entries(EXPECTED_CACHE_HEADERS)) {
      const actualValue = headers[header.toLowerCase()];
      
      if (!actualValue) {
        console.log(`❌ Missing: ${header}`);
        allPassed = false;
      } else if (expectedValue instanceof RegExp) {
        if (!expectedValue.test(actualValue)) {
          console.log(`❌ ${header}: Expected pattern ${expectedValue}, got "${actualValue}"`);
          allPassed = false;
        } else {
          console.log(`✅ ${header}: ${actualValue}`);
        }
      } else if (actualValue !== expectedValue) {
        console.log(`❌ ${header}: Expected "${expectedValue}", got "${actualValue}"`);
        allPassed = false;
      } else {
        console.log(`✅ ${header}: ${actualValue}`);
      }
    }
  }
  
  return allPassed;
}

function testCORSHeaders(headers, url) {
  console.log(`\n🌐 Testing CORS Headers for: ${url}`);
  console.log('=' .repeat(60));
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': headers['access-control-allow-origin'],
    'Access-Control-Allow-Methods': headers['access-control-allow-methods'],
    'Access-Control-Allow-Headers': headers['access-control-allow-headers'],
    'Access-Control-Max-Age': headers['access-control-max-age']
  };
  
  let allPassed = true;
  
  for (const [header, value] of Object.entries(corsHeaders)) {
    if (!value) {
      console.log(`❌ Missing: ${header}`);
      allPassed = false;
    } else {
      console.log(`✅ ${header}: ${value}`);
    }
  }
  
  return allPassed;
}

function testRobotsTxt(data) {
  console.log(`\n🤖 Testing Robots.txt Content`);
  console.log('=' .repeat(60));
  
  const expectedDisallows = [
    '/api/',
    '/dashboard/',
    '/signin',
    '/signup',
    '/admin/'
  ];
  
  let allPassed = true;
  
  for (const disallow of expectedDisallows) {
    if (!data.includes(`Disallow: ${disallow}`)) {
      console.log(`❌ Missing: Disallow: ${disallow}`);
      allPassed = false;
    } else {
      console.log(`✅ Found: Disallow: ${disallow}`);
    }
  }
  
  return allPassed;
}

async function runSecurityTests() {
  console.log('🚀 Starting Security Headers Test Suite');
  console.log('=' .repeat(60));
  
  let overallResults = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  for (const testUrl of TEST_URLS) {
    try {
      overallResults.total++;
      
      console.log(`\n📡 Testing: ${testUrl}`);
      const response = await makeRequest(testUrl);
      
      // Test security headers
      const securityPassed = testSecurityHeaders(response.headers, testUrl);
      
      // Test CORS headers
      const corsPassed = testCORSHeaders(response.headers, testUrl);
      
      // Test robots.txt content
      let robotsPassed = true;
      if (testUrl.includes('/robots.txt')) {
        robotsPassed = testRobotsTxt(response.data);
      }
      
      if (securityPassed && corsPassed && robotsPassed) {
        console.log(`\n✅ All tests passed for: ${testUrl}`);
        overallResults.passed++;
      } else {
        console.log(`\n❌ Some tests failed for: ${testUrl}`);
        overallResults.failed++;
      }
      
    } catch (error) {
      console.log(`\n❌ Error testing ${testUrl}: ${error.message}`);
      overallResults.failed++;
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SECURITY TEST SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${overallResults.total}`);
  console.log(`Passed: ${overallResults.passed} ✅`);
  console.log(`Failed: ${overallResults.failed} ❌`);
  console.log(`Success Rate: ${((overallResults.passed / overallResults.total) * 100).toFixed(1)}%`);
  
  if (overallResults.failed === 0) {
    console.log('\n🎉 All security tests passed! Your application is secure.');
  } else {
    console.log('\n⚠️  Some security tests failed. Please review the issues above.');
  }
  
  return overallResults.failed === 0;
}

// Run the tests
if (require.main === module) {
  runSecurityTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runSecurityTests,
  testSecurityHeaders,
  testCORSHeaders,
  testRobotsTxt
};
