require('dotenv').config();
const jwt = require('jsonwebtoken');
const { User, TestAttempt, PracticeTest } = require('./models');

async function testAuth() {
  try {
    console.log('🔍 Testing authentication flow...');
    
    // Test 1: Check if JWT_SECRET is loaded
    console.log('🔐 JWT_SECRET loaded:', !!process.env.JWT_SECRET);
    console.log('🔐 JWT_SECRET length:', process.env.JWT_SECRET?.length);
    
    // Test 2: Check database connection
    console.log('🗄️  Testing database connection...');
    await User.sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test 3: Check if Users table exists and has data
    console.log('👥 Checking Users table...');
    const userCount = await User.count();
    console.log('👥 Total users in database:', userCount);
    
    if (userCount > 0) {
      const sampleUser = await User.findOne();
      console.log('👥 Sample user:', {
        id: sampleUser.id,
        email: sampleUser.email,
        role: sampleUser.role,
        userType: sampleUser.userType,
        isActive: sampleUser.isActive
      });
      
      // Test 4: Test JWT token creation and verification
      console.log('🔐 Testing JWT token creation...');
      const token = jwt.sign({ id: sampleUser.id }, process.env.JWT_SECRET, {
        expiresIn: '7d'
      });
      console.log('🔐 Token created successfully, length:', token.length);
      
      // Test 5: Test JWT token verification
      console.log('🔐 Testing JWT token verification...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔐 Token verified successfully:', decoded);
      
      // Test 6: Test user lookup by ID
      console.log('🔍 Testing user lookup by ID...');
      const foundUser = await User.findByPk(decoded.id);
      if (foundUser) {
        console.log('✅ User found by ID:', foundUser.email);
      } else {
        console.log('❌ User not found by ID');
      }
      
      // Test 7: Check TestAttempt table
      console.log('📝 Checking TestAttempt table...');
      const attemptCount = await TestAttempt.count();
      console.log('📝 Total test attempts:', attemptCount);
      
      if (attemptCount > 0) {
        const sampleAttempt = await TestAttempt.findOne({
          include: [{
            model: PracticeTest,
            as: 'test',
            attributes: ['title', 'category']
          }]
        });
        console.log('📝 Sample test attempt:', {
          id: sampleAttempt.id,
          userId: sampleAttempt.userId,
          testTitle: sampleAttempt.testTitle,
          practiceTest: sampleAttempt.test
        });
      }
      
    } else {
      console.log('⚠️  No users found in database');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } finally {
    process.exit(0);
  }
}

testAuth(); 