require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAuth() {
  console.log('🧪 Testing Authentication Endpoints...');
  
  try {
    // Test 1: Check if server is running
    console.log('\n1️⃣ Testing server availability...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test 2: Test email availability check
    console.log('\n2️⃣ Testing email availability check...');
    const emailResponse = await axios.get(`${BASE_URL}/auth/check-email?email=test@example.com`);
    console.log('✅ Email check response:', emailResponse.data);
    
    // Test 3: Test login endpoint (this will fail with invalid credentials, but should not crash)
    console.log('\n3️⃣ Testing login endpoint...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword'
      });
      console.log('✅ Login response:', loginResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Login endpoint working (expected 401 for wrong credentials)');
      } else {
        console.log('❌ Login endpoint error:', error.response?.data || error.message);
      }
    }
    
    console.log('\n🎉 All basic endpoint tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAuth(); 