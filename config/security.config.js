// Security configuration for IIFTL Backend
const securityConfig = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieExpiresIn: process.env.JWT_COOKIE_EXPIRES_IN || 7,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  // Rate Limiting Configuration
  rateLimit: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts
      message: 'Too many login attempts, please try again in 15 minutes.'
    },
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests
      message: 'Too many requests from this IP, please try again later.'
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests
      message: 'API rate limit exceeded.'
    }
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token',
      'X-Session-Id',
      'X-Forwarded-For',
      'X-Real-IP'
    ],
    exposedHeaders: ['X-CSRF-Token', 'X-Session-Id'],
    maxAge: 86400 // 24 hours
  },

  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },

  // Password Policy
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // Input Validation
  validation: {
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      maxLength: 254
    },
    password: {
      minLength: 8,
      maxLength: 128
    },
    name: {
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s]+$/
    },
    phone: {
      pattern: /^\+?[\d\s\-\(\)]+$/,
      maxLength: 20
    }
  },

  // Security Headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  },

  // CSRF Configuration
  csrf: {
    secret: process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-secret-change-in-production',
    tokenLength: 32,
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // Environment-specific settings
  environment: {
    development: {
      cors: {
        allowedOrigins: process.env.DEV_ALLOWED_ORIGINS ? process.env.DEV_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : []
      },
      logging: {
        level: 'debug',
        includeStack: true
      }
    },
    production: {
      cors: {
        allowedOrigins: process.env.PROD_ALLOWED_ORIGINS ? process.env.PROD_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : []
      },
      logging: {
        level: 'error',
        includeStack: false
      }
    }
  }
};

// Get environment-specific configuration
const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return {
    ...securityConfig,
    ...securityConfig.environment[env]
  };
};

module.exports = {
  securityConfig,
  getConfig
}; 