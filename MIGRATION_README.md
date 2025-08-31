# Database Migration: Add userType to Batches Table

## Overview
This migration adds a `userType` column to the `Batches` table to support creating batches for different user types:
- **student**: Regular student batches
- **corporate**: Corporate user batches  
- **government**: Government user batches

## Problem
The current database schema doesn't have the `userType` column, causing this error:
```
error: column Batch.userType does not exist
```

## Solution
Run the migration script to add the missing column.

## Migration Scripts

### Option 1: Simple VARCHAR Migration (Recommended for quick fix)
```bash
cd "IIFTL Backend"
node run-migration.js
```

### Option 2: Proper ENUM Migration (Recommended for production)
```bash
cd "IIFTL Backend"
node run-migration-enum.js
```

## What the Migration Does

1. **Creates ENUM type** (if using ENUM migration):
   - `student`
   - `corporate` 
   - `government`

2. **Adds userType column** to `Batches` table:
   - Type: ENUM or VARCHAR with CHECK constraint
   - Default value: `'student'`
   - NOT NULL constraint

3. **Updates existing batches** to have `'student'` as default userType

4. **Verifies the migration** was successful

## Verification
After running the migration, you should see:
- ✅ Successfully added userType column to Batches table
- ✅ Successfully updated existing batches with default userType
- ✅ Migration verification showing the new column

## Rollback
If you need to rollback, you can manually drop the column:
```sql
ALTER TABLE "Batches" DROP COLUMN "userType";
DROP TYPE IF EXISTS "enum_Batches_userType";
```

## Frontend Changes
The frontend has already been updated to:
- Show userType dropdown in Create/Edit Batch forms
- Display userType badges in batch lists
- Filter batches by userType
- Show batch statistics by userType

## Testing
After migration:
1. Restart your backend server
2. Try creating a new batch with different user types
3. Verify the batches load without errors
4. Check that filtering by userType works

## Notes
- The migration is safe to run multiple times
- Existing batches will be set to 'student' userType
- New batches will require selecting a userType
- The frontend will now properly display and manage different user types 