const axios = require('axios');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const TEST_EMAIL = 'iiftladmin@iiftl.com';
const TEST_PASSWORD = 'sunVexpress#0912';

// Test session management
async function testSessionManagement() {
  console.log('🧪 Testing Session Management Implementation\n');
  
  try {
    // Test 1: Login from first browser/device
    console.log('1️⃣ Testing login from first device...');
    const login1 = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    console.log('✅ First login successful');
    console.log('   Session ID:', login1.data.sessionId);
    console.log('   Token:', login1.data.token ? 'Present' : 'Missing');
    
    const sessionId1 = login1.data.sessionId;
    const token1 = login1.data.token;
    
    // Test 2: Login from second browser/device (should deactivate first session)
    console.log('\n2️⃣ Testing login from second device...');
    const login2 = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    console.log('✅ Second login successful');
    console.log('   Session ID:', login2.data.sessionId);
    console.log('   Token:', login2.data.token ? 'Present' : 'Missing');
    
    const sessionId2 = login2.data.sessionId;
    const token2 = login2.data.token;
    
    // Test 3: Try to use first session (should fail)
    console.log('\n3️⃣ Testing first session after second login...');
    try {
      await axios.get(`${BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token1}`,
          'x-session-id': sessionId1
        }
      });
      console.log('❌ First session should have been deactivated but still works');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ First session correctly deactivated');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }
    
    // Test 4: Use second session (should work)
    console.log('\n4️⃣ Testing second session...');
    try {
      const meResponse = await axios.get(`${BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token2}`,
          'x-session-id': sessionId2
        }
      });
      console.log('✅ Second session works correctly');
      console.log('   User:', meResponse.data.data.user.email);
    } catch (error) {
      console.log('❌ Second session failed:', error.response?.data || error.message);
    }
    
    // Test 5: Check active sessions
    console.log('\n5️⃣ Testing active sessions endpoint...');
    try {
      const sessionsResponse = await axios.get(`${BASE_URL}/auth/active-sessions`, {
        headers: {
          'Authorization': `Bearer ${token2}`,
          'x-session-id': sessionId2
        }
      });
      console.log('✅ Active sessions retrieved');
      console.log('   Total sessions:', sessionsResponse.data.data.totalSessions);
      console.log('   Other sessions:', sessionsResponse.data.data.otherSessions);
    } catch (error) {
      console.log('❌ Failed to get active sessions:', error.response?.data || error.message);
    }
    
    // Test 6: Logout from second session
    console.log('\n6️⃣ Testing logout...');
    try {
      await axios.post(`${BASE_URL}/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token2}`,
          'x-session-id': sessionId2
        }
      });
      console.log('✅ Logout successful');
    } catch (error) {
      console.log('❌ Logout failed:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 Session management test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
if (require.main === module) {
  testSessionManagement();
}

module.exports = { testSessionManagement };