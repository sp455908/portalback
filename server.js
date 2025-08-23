require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://iiftl-portal.vercel.app",
  "https://your-frontend-domain.onrender.com" // Add your frontend Render domain here
];

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;
let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    try {
      console.log('Attempting to connect to MongoDB...');
      console.log('MongoDB URI:', MONGO_URI ? 'Set' : 'Not set');
      
      if (!MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not set');
      }

      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        socketTimeoutMS: 45000, // 45 second timeout
      });
      
      isConnected = true;
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      // Don't exit immediately, let the server start and handle reconnection
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
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Start the server
startServer();