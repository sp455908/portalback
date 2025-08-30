// D:\IIFTL Backend\app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const errorHandler = require('./middlewares/error.middleware');
const performanceMonitor = require('./middlewares/performance.middleware');
const { sequelize } = require('./config/database');

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
const settingsRoutes = require('./routes/settings.routes');
// const analyticsRoutes = require('./routes/analytics.routes'); // Temporarily commented out
const securityRoutes = require('./routes/security.routes');

const app = express();

// Enhanced CORS configuration for Vercel deployment
const allowedOrigins = [
  'https://iiftl-portal.vercel.app',
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
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
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
app.use(performanceMonitor); // Performance monitoring
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// Session configuration with PostgreSQL store
app.use(session({
  store: new pgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    },
    tableName: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle CORS preflight requests
app.options('*', cors(corsOptions));

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
app.use('/api/settings', settingsRoutes);
// app.use('/api/analytics', analyticsRoutes); // Temporarily commented out
app.use('/api/security', securityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL'
  });
});

// Error handling middleware (should be last)
app.use(errorHandler);

module.exports = app;