require('dotenv').config();
const { Sequelize } = require('sequelize');

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Please check your .env file.');
}

// Decide whether to use SSL for Postgres
// Use SSL if any of the following are true:
// - Explicitly enabled via DB_SSL=true
// - Running in production (NODE_ENV=production)
// - Detected Render environment (RENDER=true)
// - DATABASE_URL already requests it via sslmode=require
const databaseUrl = process.env.DATABASE_URL;
const hasSslModeRequire = /[?&]sslmode=require/i.test(databaseUrl);
// Detect Render-managed Postgres by hostname
let isRenderManaged = false;
try {
  const parsed = new URL(databaseUrl);
  isRenderManaged = /render\.com$/i.test(parsed.hostname || '');
} catch (_) {
  isRenderManaged = false;
}
const shouldUseSsl = (
  String(process.env.DB_SSL || '').toLowerCase() === 'true' ||
  process.env.NODE_ENV === 'production' ||
  String(process.env.RENDER || '').toLowerCase() === 'true' ||
  hasSslModeRequire ||
  isRenderManaged // Auto-enable SSL for Render Postgres
);

// Base dialect options shared for both SSL and non-SSL
// These options are passed through to node-postgres (pg) Client
const baseDialectOptions = {
  statement_timeout: 60000, // 60 seconds
  idle_in_transaction_session_timeout: 60000, // 60 seconds
  // node-postgres uses these names
  connectionTimeoutMillis: 30000 // 30 seconds
};

// Conditionally add SSL options
const dialectOptions = shouldUseSsl
  ? {
      ...baseDialectOptions,
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  : { ...baseDialectOptions };

// Create Sequelize instance with optimized settings
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  // OPTIMIZED: Better connection pooling for performance
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,    // 30 seconds to acquire connection
    idle: 10000,       // 10 seconds idle timeout
    evict: 60000,      // Check for dead connections every minute
    handleDisconnects: true
  },
  // Performance optimizations
  benchmark: process.env.NODE_ENV === 'development',
  retry: {
    max: 2
  },
  // Query optimization
  define: {
    timestamps: true,
    underscored: false
    // Removed freezeTableName: true to fix table naming issues
  }
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL database connection established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to PostgreSQL database:', error);
    return false;
  }
};

// Sync database (create tables if they don't exist)
const syncDatabase = async (force = false) => {
  try {
    // Only sync if force is true or if key tables don't exist
    if (force) {
      await sequelize.sync({ force: true });
      console.log('Database force synchronized successfully.');
    } else {
      // Check if key tables exist first
      const checks = await Promise.all([
        sequelize.query(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Users')",
          { type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BatchStudents')",
          { type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BatchAssignedTests')",
          { type: sequelize.QueryTypes.SELECT }
        )
      ]);

      const usersExists = checks[0][0].exists;
      const batchStudentsExists = checks[1][0].exists;
      const batchAssignedTestsExists = checks[2][0].exists;

      if (usersExists && batchStudentsExists && batchAssignedTestsExists) {
        console.log('Database tables already exist, skipping sync.');
        return true;
      }

      // Create any missing tables without dropping existing ones
      await sequelize.sync({ alter: true });
      console.log('Database synchronized successfully (missing tables created/altered).');
    }
    return true;
  } catch (error) {
    console.error('Error synchronizing database:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
}; 