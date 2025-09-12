require('dotenv').config();
const app = require('./app');
const { sequelize, testConnection, syncDatabase } = require('./config/database');


const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('Please check your .env file or environment configuration');
  process.exit(1);
}


if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET is too short. Must be at least 32 characters long');
  process.exit(1);
}

console.log('✅ Environment variables validated successfully');
console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Missing'} (${process.env.JWT_SECRET?.length || 0} chars)`);
console.log(`🗄️  Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://iiftl-portal.vercel.app",
  "https://your-frontend-domain.onrender.com" 
];

const PORT = process.env.PORT || 3000;
let isConnected = false;


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
        
        
        await syncDatabase(forceSync); 
      } else {
        throw new Error('Failed to connect to PostgreSQL');
      }
    } catch (error) {
      console.error('PostgreSQL connection error:', error);
      isConnected = false;
    }
  }
}


async function startServer() {
  try {
    
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


startServer();