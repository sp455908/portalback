// D:\IIFTL Backend\app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middlewares/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const courseRoutes = require('./routes/course.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const applicationRoutes = require('./routes/application.routes');
const alertRoutes = require('./routes/alert.routes');
const examRoutes = require('./routes/exam.routes');
const materialRoutes = require('./routes/material.routes');
const practiceTestRoutes = require('./routes/practiceTest.routes');
const batchRoutes = require('./routes/batch.routes');

const app = express();

// Enhanced CORS configuration for Render deployment
const allowedOrigins = [
  'https://iiftl-portal.vercel.app',
  'https://your-frontend-domain.onrender.com', // Add your frontend Render domain here
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    const error = new Error(`Origin ${origin} not allowed by CORS`);
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept'
  ],
  exposedHeaders: ['set-cookie', 'Authorization'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply middleware in correct order
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
})); // Security headers first
app.use(morgan('dev')); // Logging
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// Apply CORS middleware
app.use(cors(corsOptions));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/practice-tests', practiceTestRoutes);
app.use('/api/batches', batchRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'IIFTL Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;