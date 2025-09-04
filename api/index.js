require('dotenv').config();
const mongoose = require('mongoose');
const app = require('../app');

const allowedOrigins = [
  'https://iiftl-portal.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080'
];

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  console.log('Request origin:', origin);
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);

  // Set CORS headers for ALL requests
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,x-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'Authorization,Set-Cookie');

  // Handle CORS preflight request FIRST - before any other logic
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    res.status(204).end();
    return;
  }

  // Simple test endpoint
  if (req.url === '/api/test-cors') {
    return res.status(200).json({
      status: 'success',
      message: 'CORS is working!',
      origin: origin,
      timestamp: new Date().toISOString()
    });
  }

  // Only connect to DB and handle app logic for non-OPTIONS requests
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('Error in API handler:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
