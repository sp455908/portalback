const { sequelize } = require('./config/database');

async function runMigration() {
  try {
    console.log('Starting migration: Adding userType ENUM column to Batches table...');
    
    // First, create the ENUM type
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Batches_userType" AS ENUM ('student', 'corporate', 'government');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    console.log('✅ Successfully created ENUM type');
    
    // Add the userType column with ENUM type
    await sequelize.query(`
      ALTER TABLE "Batches" 
      ADD COLUMN "userType" "enum_Batches_userType" NOT NULL DEFAULT 'student'
    `);
    
    console.log('✅ Successfully added userType column to Batches table');
    
    // Update existing batches to have 'student' as default userType
    await sequelize.query(`
      UPDATE "Batches" 
      SET "userType" = 'student'::"enum_Batches_userType" 
      WHERE "userType" IS NULL
    `);
    
    console.log('✅ Successfully updated existing batches with default userType');
    
    // Verify the column was added
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'Batches' AND column_name = 'userType'
    `);
    
    console.log('✅ Migration verification:', results);
    
    // Show the table structure
    const [tableInfo] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'Batches' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Current Batches table structure:', tableInfo);
    
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