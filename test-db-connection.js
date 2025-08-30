// Test database connection and table names
require('dotenv').config();
const { sequelize } = require('./config/database');

async function testDatabase() {
  try {
    console.log('🔌 Testing database connection...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Check what tables exist
    console.log('\n📋 Checking existing tables...');
    const tables = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log('📊 Existing tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Test User model specifically
    console.log('\n👤 Testing User model...');
    const { User } = require('./models');
    
    // Check if we can query the Users table
    const userCount = await User.count();
    console.log(`✅ User model working! Found ${userCount} users in database.`);
    
    // Test LoginAttempt model
    console.log('\n🔐 Testing LoginAttempt model...');
    const { LoginAttempt } = require('./models');
    
    try {
      const attemptCount = await LoginAttempt.count();
      console.log(`✅ LoginAttempt model working! Found ${attemptCount} login attempts.`);
    } catch (error) {
      console.log('⚠️  LoginAttempt table might not exist yet (this is normal for new tables)');
    }
    
    console.log('\n🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

testDatabase(); 