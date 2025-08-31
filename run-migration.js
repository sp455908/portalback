const { sequelize } = require('./config/database');

async function runMigration() {
  try {
    console.log('Starting migration: Adding userType column to Batches table...');
    
    // Add the userType column
    await sequelize.query(`
      ALTER TABLE "Batches" 
      ADD COLUMN "userType" VARCHAR(20) NOT NULL DEFAULT 'student' 
      CHECK ("userType" IN ('student', 'corporate', 'government'))
    `);
    
    console.log('✅ Successfully added userType column to Batches table');
    
    // Update existing batches to have 'student' as default userType
    await sequelize.query(`
      UPDATE "Batches" 
      SET "userType" = 'student' 
      WHERE "userType" IS NULL OR "userType" = ''
    `);
    
    console.log('✅ Successfully updated existing batches with default userType');
    
    // Verify the column was added
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'Batches' AND column_name = 'userType'
    `);
    
    console.log('✅ Migration verification:', results);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42701') {
      console.log('Column already exists, skipping...');
    } else {
      throw error;
    }
  } finally {
    await sequelize.close();
    console.log('Migration script completed');
  }
}

runMigration().catch(console.error); 