require('dotenv').config();
const { User } = require('../models');
const bcrypt = require('bcryptjs');

async function setupAdminUser() {
  try {
    console.log('🔧 Setting up admin user...');
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:', existingAdmin.email);
      console.log('🔄 Updating existing admin user...');
      
      // Update existing admin with new credentials
      const hashedPassword = await bcrypt.hash('sunVexpress#0912', 12);
      await existingAdmin.update({
        email: 'iiftladmin@iiftl.com',
        password: hashedPassword,
        firstName: 'IIFTL',
        lastName: 'Administrator',
        role: 'admin',
        userType: 'corporate', // Use corporate as userType for admin
        isActive: true
      });
      
      console.log('✅ Admin user updated successfully');
    } else {
      console.log('🆕 Creating new admin user...');
      
      // Create new admin user
      const hashedPassword = await bcrypt.hash('sunVexpress#0912', 12);
      const adminUser = await User.create({
        firstName: 'IIFTL',
        lastName: 'Administrator',
        email: 'iiftladmin@iiftl.com',
        password: hashedPassword,
        role: 'admin',
        userType: 'corporate', // Use corporate as userType for admin
        isActive: true
      });
      
      console.log('✅ Admin user created successfully with ID:', adminUser.id);
    }
    
    // Verify the setup
    const adminUser = await User.findOne({ where: { role: 'admin' } });
    const adminCount = await User.count({ where: { role: 'admin' } });
    
    console.log('\n📋 Setup Summary:');
    console.log('==================');
    console.log('👤 Admin User:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   User Type: ${adminUser.userType}`);
    console.log(`   Status: ${adminUser.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Created: ${adminUser.createdAt}`);
    
    console.log('\n🔒 Security Status:');
    console.log(`   Total Admin Users: ${adminCount}`);
    console.log(`   Single Admin Rule: ${adminCount === 1 ? '✅ Enforced' : '❌ Violated'}`);
    
    console.log('\n🎉 Admin user setup completed successfully!');
    console.log('🔐 Login credentials:');
    console.log('   Email: iiftladmin@iiftl.com');
    console.log('   Password: sunVexpress#0912');
    
    console.log('\n💡 Note: The single admin rule is enforced at the database level');
    console.log('   through User model hooks. No additional settings required.');
    
  } catch (error) {
    console.error('❌ Error setting up admin user:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

setupAdminUser(); 