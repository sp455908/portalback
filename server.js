require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://iiftl-portal.vercel.app",
  "https://your-frontend-domain.onrender.com" // Add your frontend Render domain here
];

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;
let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    try {
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      isConnected = true;
      console.log('MongoDB connected successfully');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    }
  }
}

// Start server function
async function startServer() {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: ${isConnected ? 'Connected' : 'Disconnected'}`);
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