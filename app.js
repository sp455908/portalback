
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
const maintenanceGate = require('./middlewares/maintenance.middleware');
const { securityLogging } = require('./middlewares/securityLogging.middleware');
const { generateCSRFToken, verifyCSRFToken } = require('./middlewares/csrf.middleware');
const { sequelize } = require('./config/database');
const { UserSession } = require('./models');


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
const analyticsRoutes = require('./routes/analytics.routes');
const securityRoutes = require('./routes/security.routes');
const captchaRoutes = require('./routes/captcha.routes');
const ownerRoutes = require('./routes/owner.routes');
const healthRoutes = require('./routes/health.routes');
const realtimeRoutes = require('./routes/realtime.routes');
const { sanitizeRequest } = require('./middlewares/security.middleware');

const app = express();


app.set('trust proxy', 1);


const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
  [];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.log('CORS blocked origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    
    const error = new Error(`Origin ${origin} not allowed by CORS`);
    return callback(error, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-csrf-token',
    'x-session-id',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
    'If-None-Match',
    'X-API-Key'
  ],
  exposedHeaders: ['set-cookie', 'Authorization', 'X-Total-Count'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Additional CORS middleware for better compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Log CORS requests for debugging
  console.log(`CORS Request - Method: ${req.method}, Origin: ${origin}, Path: ${req.path}`);
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log(`✅ CORS allowed for origin: ${origin}`);
  } else if (origin) {
    console.log(`❌ CORS blocked for origin: ${origin}`);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-csrf-token, x-session-id, Access-Control-Request-Method, Access-Control-Request-Headers, Cache-Control, Pragma, If-Modified-Since, If-None-Match, X-API-Key');
  res.setHeader('Access-Control-Expose-Headers', 'set-cookie, Authorization, X-Total-Count');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Log cookie-related headers for debugging
  if (req.path.includes('/auth/login')) {
    console.log('Login request - setting CORS headers for cookie support');
    console.log('Request headers:', {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for']
    });
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling preflight request');
    res.status(204).end();
    return;
  }
  
  next();
});


app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://iiftl-portal.vercel.app"],
      frameSrc: ["'self'", "https://iiftl-portal.vercel.app"],
      objectSrc: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
})); 
app.use(morgan('dev')); 
app.use(securityLogging); 
app.use(performanceMonitor); 
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' })); 
app.use(cookieParser()); 
app.use(sanitizeRequest);

// Serve static security files
app.use(express.static('public'));

// CSRF Protection - Generate token for all requests
app.use(generateCSRFToken); 


// ✅ OWASP SECURITY: Enhanced session configuration with proper timeout
app.use(session({
  store: new pgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    tableName: 'sessions',
    // ✅ OWASP: Session cleanup configuration
    pruneSessionInterval: 15, // Clean up expired sessions every 15 minutes
    ttl: 30 * 60 // 30 minutes TTL for session data
  }),
  name: 'iiftl_session', // ✅ OWASP: Custom session name to avoid fingerprinting
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  resave: false, // ✅ OWASP: Don't resave unchanged sessions
  saveUninitialized: false, // ✅ OWASP: Don't save uninitialized sessions
  rolling: true, // ✅ OWASP: Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // ✅ OWASP: HTTPS only in production
    httpOnly: true, // ✅ OWASP: Prevent XSS attacks
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // ✅ OWASP: CSRF protection
    maxAge: 30 * 60 * 1000, // ✅ OWASP: 30 minutes session timeout
    domain: process.env.NODE_ENV === 'production' ? undefined : undefined // ✅ OWASP: Domain security
  }
}));




app.use(maintenanceGate);


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
app.use('/api/analytics', analyticsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/realtime', realtimeRoutes);


app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL'
  });
});


app.use(errorHandler);

// ✅ FIX: Start session cleanup job
UserSession.startCleanupJob();
console.log('[SESSION CLEANUP] Started automatic session cleanup job (every 5 minutes)');

module.exports = app;