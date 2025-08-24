# MongoDB to PostgreSQL Migration Guide

This guide will help you migrate your IIFTL Backend from MongoDB Atlas to PostgreSQL on Render.

## Prerequisites

1. **Render Account**: Make sure you have a Render account
2. **PostgreSQL Database**: Create a PostgreSQL database on Render
3. **Backup**: Ensure you have a backup of your MongoDB data

## Step 1: Set up PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "PostgreSQL"
3. Choose your plan:
   - **Free**: Good for development/testing
   - **Starter**: $7/month for production use
4. Set database name: `iiftl_db`
5. Note down the connection details

## Step 2: Install New Dependencies

```bash
# Remove MongoDB dependencies
npm uninstall mongoose connect-mongo

# Install PostgreSQL dependencies
npm install pg sequelize pg-hstore connect-pg-simple
npm install --save-dev sequelize-cli
```

## Step 3: Update Environment Variables

### Local Development (.env)
```env
# PostgreSQL Connection
DATABASE_URL=postgresql://username:password@host:port/database

# Alternative individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iiftl_db
DB_USER=your_username
DB_PASSWORD=your_password

# Session Store
SESSION_SECRET=your-session-secret-key

# Keep MongoDB URI temporarily for data migration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

### Render Environment Variables
1. Go to your Render service dashboard
2. Navigate to "Environment" tab
3. Add these variables:
   - `DATABASE_URL`: Your PostgreSQL connection string from Render
   - `JWT_SECRET`: Your JWT secret key
   - `SESSION_SECRET`: Your session secret key
   - `NODE_ENV`: production
   - `ALLOWED_ORIGINS`: Your frontend URLs

## Step 4: Database Migration

### Create Database Tables
```bash
# Run the migration script
npm run migrate
```

### Migrate Data (Optional)
If you have existing data in MongoDB:

```bash
# Install mongoose temporarily for data migration
npm install mongoose

# Run data migration
node scripts/migrateData.js

# Remove mongoose after migration
npm uninstall mongoose
```

## Step 5: Update Controllers

You'll need to update your controllers to use Sequelize instead of Mongoose. Here are the key changes:

### Before (Mongoose)
```javascript
const User = require('../models/user.model');

// Find user
const user = await User.findById(id);

// Create user
const newUser = await User.create(userData);

// Update user
await User.findByIdAndUpdate(id, updateData);

// Delete user
await User.findByIdAndDelete(id);
```

### After (Sequelize)
```javascript
const { User } = require('../models');

// Find user
const user = await User.findByPk(id);

// Create user
const newUser = await User.create(userData);

// Update user
await User.update(updateData, { where: { id } });

// Delete user
await User.destroy({ where: { id } });
```

## Step 6: Test Locally

1. Set up local PostgreSQL database
2. Update your `.env` file with local database credentials
3. Run the application:
```bash
npm run dev
```

## Step 7: Deploy to Render

1. Push your changes to your Git repository
2. Render will automatically deploy the updated code
3. Check the logs to ensure the database connection is successful

## Step 8: Verify Migration

1. Test all API endpoints
2. Verify data integrity
3. Check session management
4. Monitor application performance

## Common Issues and Solutions

### 1. Connection Timeout
- Check your `DATABASE_URL` format
- Ensure SSL settings are correct for production
- Verify network connectivity

### 2. Model Associations
- Make sure all foreign key relationships are properly defined
- Check that referenced tables exist

### 3. Data Type Mismatches
- Verify that data types match between MongoDB and PostgreSQL
- Check for any JSON fields that need special handling

### 4. Session Store Issues
- Ensure the sessions table is created
- Check session configuration in app.js

## Performance Considerations

1. **Indexes**: Add appropriate indexes for frequently queried fields
2. **Connection Pooling**: Configure connection pool settings
3. **Query Optimization**: Use Sequelize's query optimization features

## Rollback Plan

If you need to rollback:

1. Keep your MongoDB connection string in environment variables
2. Maintain both database connections temporarily
3. Have a backup of your MongoDB data
4. Test thoroughly before removing MongoDB dependencies

## Support

If you encounter issues during migration:

1. Check the application logs
2. Verify database connection settings
3. Test database connectivity manually
4. Review Sequelize documentation for specific queries

## Post-Migration Checklist

- [ ] All API endpoints working
- [ ] User authentication working
- [ ] Session management working
- [ ] Data integrity verified
- [ ] Performance acceptable
- [ ] MongoDB dependencies removed
- [ ] Environment variables cleaned up
- [ ] Documentation updated 