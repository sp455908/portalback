require('dotenv').config();
const { Sequelize } = require('sequelize');

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Please check your .env file.');
}

// Create Sequelize instance
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
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