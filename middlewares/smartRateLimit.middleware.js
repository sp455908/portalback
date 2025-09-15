const rateLimit = require('express-rate-limit');
const { rateLimitConfig } = require('./validation.middleware');

// Smart rate limiting middleware that adapts based on context
const smartRateLimit = {
  // General API rate limiting with hybrid approach
  general: rateLimit({
    ...rateLimitConfig.general,
    // Skip rate limiting for health checks and static assets
    skip: (req) => {
      return req.path.startsWith('/api/health') || 
             req.path.startsWith('/static/') ||
             req.path.startsWith('/favicon.ico');
    },
    // Custom key generator for hybrid limiting
    keyGenerator: (req) => {
      const ip = req.ip;
      const userId = req.user?.id;
      const userAgent = req.get('User-Agent') || '';
      
      // For authenticated users, use user-specific limiting
      if (userId) {
        return `user:${userId}`;
      }
      
      // For unauthenticated requests, use IP-based limiting
      return `ip:${ip}`;
    }
  }),

  // Authentication rate limiting - Strict per IP for security
  auth: rateLimit({
    ...rateLimitConfig.auth,
    // Always use IP-based limiting for auth (security critical)
    keyGenerator: (req) => `auth:${req.ip}`,
    // Skip for password reset and other legitimate auth flows
    skip: (req) => {
      return req.path.includes('/forgot-password') || 
             req.path.includes('/reset-password');
    }
  }),

  // Test submission rate limiting - Per user for fairness
  testSubmission: rateLimit({
    ...rateLimitConfig.testSubmission,
    // Per user limiting for test submissions
    keyGenerator: (req) => {
      const userId = req.user?.id;
      if (userId) {
        return `test:user:${userId}`;
      }
      // Fallback to IP for unauthenticated requests
      return `test:ip:${req.ip}`;
    }
  }),

  // Critical operations rate limiting
  critical: rateLimit({
    ...rateLimitConfig.critical,
    keyGenerator: (req) => {
      const userId = req.user?.id;
      const ip = req.ip;
      return userId ? `critical:user:${userId}` : `critical:ip:${ip}`;
    }
  }),

  // Adaptive rate limiting based on user type
  adaptive: (req, res, next) => {
    const user = req.user;
    const ip = req.ip;
    
    // Different limits for different user types
    let maxRequests = 100; // Default
    let windowMs = 15 * 60 * 1000; // 15 minutes
    
    if (user) {
      switch (user.role) {
        case 'admin':
          maxRequests = 1000; // Higher limit for admins
          break;
        case 'teacher':
        case 'corporate':
          maxRequests = 500; // Medium limit for teachers/corporate
          break;
        case 'student':
        case 'government':
          maxRequests = 200; // Standard limit for students
          break;
        default:
          maxRequests = 100;
      }
    }
    
    // Apply adaptive rate limiting
    const adaptiveLimiter = rateLimit({
      windowMs,
      max: maxRequests,
      keyGenerator: (req) => {
        const userId = req.user?.id;
        return userId ? `adaptive:user:${userId}` : `adaptive:ip:${ip}`;
      },
      message: {
        status: 'fail',
        message: `Rate limit exceeded. You can make ${maxRequests} requests per ${windowMs / 60000} minutes.`
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    
    adaptiveLimiter(req, res, next);
  },

  // Network-aware rate limiting
  networkAware: (req, res, next) => {
    const ip = req.ip;
    const userAgent = req.get('User-Agent') || '';
    
    // Detect if request is from a shared network
    const isSharedNetwork = 
      userAgent.includes('Mobile') || // Mobile networks often share IPs
      ip.startsWith('192.168.') ||    // Private networks
      ip.startsWith('10.') ||         // Private networks
      ip.startsWith('172.');          // Private networks
    
    // Adjust limits based on network type
    const baseLimit = isSharedNetwork ? 300 : 100; // Higher limit for shared networks
    
    const networkLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: baseLimit,
      keyGenerator: (req) => {
        const userId = req.user?.id;
        if (userId) {
          return `network:user:${userId}`;
        }
        return `network:ip:${ip}`;
      },
      message: {
        status: 'fail',
        message: isSharedNetwork 
          ? 'Rate limit exceeded for shared network. Please try again later.'
          : 'Rate limit exceeded. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    
    networkLimiter(req, res, next);
  }
};

module.exports = smartRateLimit;
