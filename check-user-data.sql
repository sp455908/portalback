-- SQL Queries to check user data in PostgreSQL database
-- Run these queries in pgAdmin or your PostgreSQL client

-- 1. Check if the address columns exist in the Users table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'Users' 
AND column_name IN ('address', 'city', 'state', 'pincode')
ORDER BY column_name;

-- 2. View all users with their address information
SELECT 
    id,
    email,
    "firstName",
    "lastName",
    phone,
    address,
    city,
    state,
    pincode,
    "studentId",
    role,
    "createdAt",
    "updatedAt"
FROM "Users"
ORDER BY id;

-- 3. Check specific user by email (replace with actual email)
SELECT 
    id,
    email,
    "firstName",
    "lastName",
    phone,
    address,
    city,
    state,
    pincode,
    "studentId",
    role,
    "createdAt",
    "updatedAt"
FROM "Users"
WHERE email = 'sp455908@gmail.com';

-- 4. Check users with missing address information
SELECT 
    id,
    email,
    "firstName",
    "lastName",
    address,
    city,
    state,
    pincode
FROM "Users"
WHERE address IS NULL 
   OR city IS NULL 
   OR state IS NULL 
   OR pincode IS NULL
   OR address = ''
   OR city = ''
   OR state = ''
   OR pincode = '';

-- 5. Count users with complete address information
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN address IS NOT NULL AND address != '' THEN 1 END) as with_address,
    COUNT(CASE WHEN city IS NOT NULL AND city != '' THEN 1 END) as with_city,
    COUNT(CASE WHEN state IS NOT NULL AND state != '' THEN 1 END) as with_state,
    COUNT(CASE WHEN pincode IS NOT NULL AND pincode != '' THEN 1 END) as with_pincode,
    COUNT(CASE WHEN address IS NOT NULL AND address != '' 
                AND city IS NOT NULL AND city != '' 
                AND state IS NOT NULL AND state != '' 
                AND pincode IS NOT NULL AND pincode != '' THEN 1 END) as complete_address
FROM "Users";

-- 6. Update a specific user's address information (replace values as needed)
-- UPDATE "Users" 
-- SET 
--     address = 'Your Address Here',
--     city = 'Your City',
--     state = 'Your State',
--     pincode = 'Your Pincode',
--     "updatedAt" = NOW()
-- WHERE email = 'sp455908@gmail.com';

-- 7. Add address columns if they don't exist (run only if columns are missing)
-- ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS city VARCHAR(255);
-- ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS state VARCHAR(255);
-- ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);

-- 8. Check table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Users'
ORDER BY ordinal_position;
