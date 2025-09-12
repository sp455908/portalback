#!/usr/bin/env node

/**
 * Script to add missing maintenance columns to Settings table
 * Run this to fix the 503 error caused by missing columns
 */

require('dotenv').config();
const { sequelize } = require('./config/database');

async function runMigration() {
  try {
    console.log('🔄 Starting maintenance columns migration...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Add maintenanceMessage column
    try {
      await sequelize.query(`
        ALTER TABLE "Settings" 
        ADD COLUMN IF NOT EXISTS "maintenanceMessage" TEXT DEFAULT '';
      `);
      console.log('✅ Added maintenanceMessage column');
    } catch (error) {
      console.log('⚠️  maintenanceMessage column might already exist:', error.message);
    }
    
    // Add maintenanceEndTime column
    try {
      await sequelize.query(`
        ALTER TABLE "Settings" 
        ADD COLUMN IF NOT EXISTS "maintenanceEndTime" TIMESTAMP DEFAULT NULL;
      `);
      console.log('✅ Added maintenanceEndTime column');
    } catch (error) {
      console.log('⚠️  maintenanceEndTime column might already exist:', error.message);
    }
    
    // Verify the columns exist
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Settings' 
      AND column_name IN ('maintenanceMessage', 'maintenanceEndTime');
    `);
    
    console.log('📋 Existing maintenance columns:', results.map(r => r.column_name));
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the migration
runMigration();