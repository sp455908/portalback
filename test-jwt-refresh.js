const axios = require('axios');

// Test JWT token refresh functionality
const testJWTRefresh = async () => {
  const baseURL = 'https://portalback-8tth.onrender.com/api';
  
  console.log('🧪 Testing JWT Token Refresh Functionality...\n');
  
  try {
    // Step 1: Login to get initial tokens
    console.log('1️⃣ Logging in to get initial tokens...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'iiftladmin@iiftl.com',
      password: 'sunVexpress#0912'
    });
    
    if (loginResponse.data.status === 'success') {
      const { token, refreshToken } = loginResponse.data;
      console.log('✅ Login successful');
      console.log('   Access Token:', token.substring(0, 50) + '...');
      console.log('   Refresh Token:', refreshToken.substring(0, 50) + '...');
      
      // Step 2: Test protected endpoint with access token
      console.log('\n2️⃣ Testing protected endpoint with access token...');
      const meResponse = await axios.get(`${baseURL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (meResponse.data.status === 'success') {
        console.log('✅ Protected endpoint works with access token');
        console.log('   User:', meResponse.data.data.user.email);
      }
      
      // Step 3: Test token refresh
      console.log('\n3️⃣ Testing token refresh...');
      const refreshResponse = await axios.post(`${baseURL}/auth/refresh-token`, {}, {
        headers: { Cookie: `refreshToken=${refreshToken}` }
      });
      
      if (refreshResponse.data.status === 'success') {
        const newToken = refreshResponse.data.token;
        console.log('✅ Token refresh successful');
        console.log('   New Access Token:', newToken.substring(0, 50) + '...');
        
        // Step 4: Test protected endpoint with new token
        console.log('\n4️⃣ Testing protected endpoint with refreshed token...');
        const newMeResponse = await axios.get(`${baseURL}/auth/me`, {
          headers: { Authorization: `Bearer ${newToken}` }
        });
        
        if (newMeResponse.data.status === 'success') {
          console.log('✅ Protected endpoint works with refreshed token');
          console.log('   User:', newMeResponse.data.data.user.email);
        }
      }
      
      // Step 5: Test logout
      console.log('\n5️⃣ Testing logout...');
      const logoutResponse = await axios.post(`${baseURL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${newToken || token}` }
      });
      
      if (logoutResponse.data.status === 'success') {
        console.log('✅ Logout successful');
      }
      
      console.log('\n🎉 All JWT tests passed! Session persistence should work correctly.');
      
    } else {
      console.log('❌ Login failed:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 This might be a CORS or cookie issue. Check:');
      console.log('   - CORS credentials are enabled');
      console.log('   - Cookie domain settings');
      console.log('   - Frontend axios configuration');
    }
  }
};

// Run the test
testJWTRefresh(); 