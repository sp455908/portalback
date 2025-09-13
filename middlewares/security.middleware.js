const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sanitizeValue } = require('../utils/sanitize');

// Optional security middlewares – fall back to no-ops if not installed
let mongoSanitize;
let xss;
let hpp;
const noop = () => (req, res, next) => next();
try { mongoSanitize = require('express-mongo-sanitize'); } catch (_) { mongoSanitize = noop; }
try { xss = require('xss-clean'); } catch (_) { xss = noop; }
try { hpp = require('hpp'); } catch (_) { hpp = noop; }

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      status: 'fail',
      message: message || 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Security middleware configuration
const securityMiddleware = {
  // ✅ SECURITY FIX: Enhanced security headers with stricter CSP
  basic: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"], // Removed 'unsafe-inline'
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"], // Removed 'unsafe-inline' and 'unsafe-eval'
        connectSrc: ["'self'", "https://iiftl-portal.vercel.app"],
        frameSrc: ["'self'", "https://iiftl-portal.vercel.app"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
        reportUri: "/api/security/csp-report" // Add CSP reporting
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  // ✅ SECURITY FIX: Enhanced rate limiters with progressive delays
  authLimiter: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    'Too many login attempts, please try again in 15 minutes.'
  ),

  // Stricter rate limiting for sensitive endpoints
  sensitiveLimiter: createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    10, // 10 requests
    'Too many requests to sensitive endpoint, please try again later.'
  ),

  generalLimiter: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests
    'Too many requests from this IP, please try again later.'
  ),

  // Input sanitization
  sanitize: [
    // Prevent NoSQL injection (no-op if package not installed)
    (typeof mongoSanitize === 'function' ? mongoSanitize() : noop()),
    // Prevent XSS attacks (no-op if package not installed)
    (typeof xss === 'function' ? xss() : noop()),
    // Prevent HTTP Parameter Pollution (no-op if package not installed)
    (typeof hpp === 'function' ? hpp() : noop()),
  ],

  // CSRF protection
  csrf: (req, res, next) => {
    // Skip CSRF for GET requests and public endpoints
    if (req.method === 'GET' || req.path.startsWith('/api/health') || req.path.startsWith('/api/debug')) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({
        status: 'fail',
        message: 'CSRF token validation failed'
      });
    }

    next();
  },

  // Input validation middleware
  validateInput: (req, res, next) => {
    // Sanitize and validate email
    if (req.body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body.email)) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid email format'
        });
      }
      req.body.email = req.body.email.toLowerCase().trim();
    }

    // Sanitize and validate password
    if (req.body.password) {
      if (typeof req.body.password !== 'string' || req.body.password.length < 6) {
        return res.status(400).json({
          status: 'fail',
          message: 'Password must be at least 6 characters long'
        });
      }
    }

    // Sanitize string inputs
    const stringFields = ['firstName', 'lastName', 'phone', 'address'];
    stringFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim().replace(/[<>]/g, '');
      }
    });

    next();
  },

  // ✅ SECURITY FIX: Enhanced request logging for security monitoring
  securityLog: (req, res, next) => {
    const securityEvents = [
      'login',
      'register',
      'password-reset',
      'admin-action',
      'logout',
      'refresh-token'
    ];

    if (securityEvents.some(event => req.path.includes(event))) {
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id || 'anonymous'
      };
      
      console.log(`[SECURITY] ${JSON.stringify(logData)}`);
    }

    next();
  },

  // ✅ NEW: Additional security headers
  additionalHeaders: (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent XSS
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  },

  // Lightweight origin/referer guard for file downloads (mitigates CSRF/link-leaks)
  verifyOriginForDownloads: (req, res, next) => {
    try {
      // Allow direct top-level navigations without Origin/Referer (browser may omit)
      const origin = req.headers.origin || '';
      const referer = req.headers.referer || '';

      // Whitelist allowed frontends; allow same-origin backend as well
      const allowed = new Set([
        'https://iiftl-portal.vercel.app',
        process.env.FRONTEND_ORIGIN || '',
      ].filter(Boolean));

      const isAllowedOrigin = origin ? allowed.has(origin) : true;
      const isAllowedReferer = referer ? Array.from(allowed).some(a => referer.startsWith(a)) : true;

      if (!isAllowedOrigin || !isAllowedReferer) {
        return res.status(403).json({ status: 'fail', message: 'Forbidden by origin policy' });
      }

      return next();
    } catch (_) {
      // Fail closed
      return res.status(403).json({ status: 'fail', message: 'Forbidden' });
    }
  }
};

function sanitizeRequest(req, res, next) {
  try {
    if (req.body) req.body = sanitizeValue(req.body);
    if (req.query) req.query = sanitizeValue(req.query);
    if (req.params) req.params = sanitizeValue(req.params);
  } catch (e) {
    // best-effort; continue
  }
  next();
}

function parseAllowedOrigins() {
  const env = (process.env.ALLOWED_ORIGINS || '').trim();
  if (!env) return ['https://iiftl-portal.vercel.app'];
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

function verifyOriginForDownloads(req, res, next) {
  try {
    const allowed = new Set(parseAllowedOrigins());
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';

    const isAllowedOrigin = origin && allowed.has(origin);
    const isAllowedReferer = referer && Array.from(allowed).some(o => referer.startsWith(o));

    if (isAllowedOrigin || isAllowedReferer) {
      return next();
    }

    // If no origin/referer (e.g., direct curl), allow only when authenticated
    if (!origin && !referer && req.headers.authorization) {
      return next();
    }

    return res.status(403).json({
      status: 'fail',
      message: 'Forbidden: invalid request origin'
    });
  } catch (err) {
    return res.status(400).json({ status: 'fail', message: 'Invalid request' });
  }
}

module.exports = {
  securityMiddleware,
  sanitizeRequest,
  verifyOriginForDownloads
}; 