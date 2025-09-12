
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
const { sequelize } = require('./config/database');


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


const allowedOrigins = [
  'https://iiftl-portal.vercel.app',
];

const corsOptions = {
  origin: function (origin, callback) {
    
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
    'x-csrf-token',
    'x-session-id',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
    'If-None-Match'
  ],
  exposedHeaders: ['set-cookie', 'Authorization'],
  maxAge: 86400, 
  preflightContinue: false,
  optionsSuccessStatus: 204
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


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
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser()); 
app.use(sanitizeRequest); 


app.use(session({
  store: new pgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      
      ssl: { rejectUnauthorized: false },
    },
    tableName: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 
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

module.exports = app;