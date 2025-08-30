// Test LoginAttempt model and methods
require('dotenv').config();
const { sequelize } = require('./config/database');

async function testLoginAttempt() {
  try {
    console.log('🔌 Testing LoginAttempt model...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Import models
    const { LoginAttempt, User } = require('./models');
    
    // Test if LoginAttempt model exists
    console.log('\n📋 Testing LoginAttempt model...');
    console.log('LoginAttempt model:', typeof LoginAttempt);
    console.log('LoginAttempt methods:', Object.getOwnPropertyNames(LoginAttempt));
    
    // Test if getLoginStatus method exists
    if (typeof LoginAttempt.getLoginStatus === 'function') {
      console.log('✅ getLoginStatus method exists!');
    } else {
      console.log('❌ getLoginStatus method missing!');
    }
    
    // Test if processLoginAttempt method exists
    if (typeof LoginAttempt.processLoginAttempt === 'function') {
      console.log('✅ processLoginAttempt method exists!');
    } else {
      console.log('❌ processLoginAttempt method missing!');
    }
    
    // Test if we can query the LoginAttempts table
    try {
      const attemptCount = await LoginAttempt.count();
      console.log(`✅ LoginAttempt table accessible! Found ${attemptCount} records.`);
    } catch (error) {
      console.log('⚠️  LoginAttempt table not accessible:', error.message);
    }
    
    // Test User model
    console.log('\n👤 Testing User model...');
    try {
      const userCount = await User.count();
      console.log(`✅ User model working! Found ${userCount} users.`);
      
      // Test a specific user query
      const testUser = await User.findOne({ where: { email: 'sp455908@gmail.com' } });
      if (testUser) {
        console.log(`✅ Found test user: ${testUser.email} (ID: ${testUser.id})`);
      } else {
        console.log('⚠️  Test user not found');
      }
    } catch (error) {
      console.log('❌ User model error:', error.message);
    }
    
    console.log('\n🎉 LoginAttempt test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

testLoginAttempt(); 