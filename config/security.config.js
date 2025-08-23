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
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://iiftl-frontend.vercel.app',
      'https://exim-portal-guardian.vercel.app',
      'https://iiftl-portal.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token'
    ]
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
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  },

  // Environment-specific settings
  environment: {
    development: {
      cors: {
        allowedOrigins: ['http://localhost:3000', 'http://localhost:5173']
      },
      logging: {
        level: 'debug',
        includeStack: true
      }
    },
    production: {
      cors: {
        allowedOrigins: [
          'https://iiftl-frontend.vercel.app',
          'https://exim-portal-guardian.vercel.app',
          'https://iiftl-portal.vercel.app'
        ]
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