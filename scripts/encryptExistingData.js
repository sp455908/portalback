// ✅ ADD: Migration script to encrypt existing data
const mongoose = require('mongoose');
const User = require('../models/user.model');
const encryptionService = require('../utils/encryption');
require('dotenv').config();

async function encryptExistingData() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Find all users with phone or address data
    const users = await User.find({
      $or: [
        { phone: { $exists: true, $ne: null, $ne: '' } },
        { address: { $exists: true, $ne: null, $ne: '' } }
      ]
    });

    console.log(`Found ${users.length} users with phone/address data to encrypt`);

    let encryptedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        let needsUpdate = false;
        const updateData = {};

        // Check if phone needs encryption
        if (user.phone && !encryptionService.isEncrypted(user.phone)) {
          updateData.phone = encryptionService.encrypt(user.phone);
          needsUpdate = true;
          console.log(`Encrypting phone for user: ${user.email}`);
        }

        // Check if address needs encryption
        if (user.address && !encryptionService.isEncrypted(user.address)) {
          updateData.address = encryptionService.encrypt(user.address);
          needsUpdate = true;
          console.log(`Encrypting address for user: ${user.email}`);
        }

        // Update user if needed
        if (needsUpdate) {
          await User.findByIdAndUpdate(user._id, updateData);
          encryptedCount++;
        }
      } catch (error) {
        console.error(`Error encrypting data for user ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log(`\nMigration completed:`);
    console.log(`✅ Successfully encrypted: ${encryptedCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log(`📊 Total processed: ${users.length} users`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run migration if called directly
if (require.main === module) {
  encryptExistingData();
}

module.exports = encryptExistingData;
