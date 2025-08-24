require('dotenv').config();
const app = require('./app');
const { sequelize, testConnection, syncDatabase } = require('./config/database');

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://iiftl-portal.vercel.app",
  "https://your-frontend-domain.onrender.com" // Add your frontend Render domain here
];

const PORT = process.env.PORT || 3000;
let isConnected = false;

// Check if --force-sync flag is passed
const forceSync = process.argv.includes('--force-sync');
if (forceSync) {
  console.log('⚠️  Force sync mode enabled - this will recreate all tables!');
}

async function connectDB() {
  if (!isConnected) {
    try {
      console.log('Attempting to connect to PostgreSQL...');
      
      const connected = await testConnection();
      if (connected) {
        isConnected = true;
        console.log('PostgreSQL connected successfully');
        
        // Sync database (create tables if they don't exist)
        await syncDatabase(forceSync); // Use forceSync flag if passed
      } else {
        throw new Error('Failed to connect to PostgreSQL');
      }
    } catch (error) {
      console.error('PostgreSQL connection error:', error);
      isConnected = false;
    }
  }
}

// Start server function
async function startServer() {
  try {
    // Try to connect to database but don't fail if it doesn't work
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: ${isConnected ? 'Connected' : 'Disconnected'}`);
      console.log(`Server started successfully!`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  sequelize.close(() => {
    console.log('PostgreSQL connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  sequelize.close(() => {
    console.log('PostgreSQL connection closed');
    process.exit(0);
  });
});

// Start the server
startServer();