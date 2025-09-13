const session = require('express-session');
const crypto = require('crypto');

// Session configuration with fallback for when MongoDB is not available
const sessionConfig = {
  name: 'iiftl_session',
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined
  },
  store: undefined, // Using memory store for now, can be configured with PostgreSQL store later
  rolling: true, // Extend session on each request
  unset: 'destroy'
};

// CSRF token generation and validation
const csrfProtection = {
  // Generate CSRF token
  generateToken: (req, res, next) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
  },

  // Validate CSRF token
  validateToken: (req, res, next) => {
    // Skip CSRF validation for GET requests and public endpoints
    if (req.method === 'GET' || 
        req.path.startsWith('/api/health') || 
        req.path.startsWith('/api/debug') ||
        req.path.startsWith('/api/test')) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({
        status: 'fail',
        message: 'CSRF token validation failed',
        error: 'Invalid or missing CSRF token'
      });
    }

    // Regenerate CSRF token after successful validation
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
    
    next();
  },

  // Validate CSRF token with owner bypass for critical operations
  validateTokenWithOwnerBypass: (req, res, next) => {
    // Allow owners to bypass CSRF for critical security operations
    if (req.user && req.user.isOwner === true) {
      return next();
    }
    
    // For non-owners, use standard CSRF validation
    return csrfProtection.validateToken(req, res, next);
  },

  // Refresh CSRF token
  refreshToken: (req, res, next) => {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
    next();
  }
};

// Session security middleware
const sessionSecurity = {
  // Prevent session fixation
  preventSessionFixation: (req, res, next) => {
    if (req.session && req.session.isNew) {
      // Regenerate session ID for new sessions
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({
            status: 'error',
            message: 'Session error occurred'
          });
        }
        next();
      });
    } else {
      next();
    }
  },

  // Session activity tracking
  trackActivity: (req, res, next) => {
    if (req.session) {
      req.session.lastActivity = Date.now();
      req.session.userAgent = req.headers['user-agent'];
      req.session.ipAddress = req.ip || req.connection.remoteAddress;
    }
    next();
  },

  // Session timeout check
  checkTimeout: (req, res, next) => {
    if (req.session && req.session.lastActivity) {
      const timeout = 30 * 60 * 1000; // 30 minutes
      const now = Date.now();
      
      if (now - req.session.lastActivity > timeout) {
        // Session expired, destroy it
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
          }
          return res.status(401).json({
            status: 'fail',
            message: 'Session expired. Please login again.',
            error: 'SESSION_TIMEOUT'
          });
        });
        return;
      }
    }
    next();
  },

  // Session cleanup
  cleanup: (req, res, next) => {
    // Clean up old sessions periodically
    if (req.session && req.session.lastActivity) {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      if (req.session.lastActivity < cutoff) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session cleanup error:', err);
          }
        });
        return res.status(401).json({
          status: 'fail',
          message: 'Session expired. Please login again.',
          error: 'SESSION_EXPIRED'
        });
      }
    }
    next();
  }
};

// Session monitoring
const sessionMonitor = {
  // Log session events
  logEvent: (req, res, next) => {
    if (req.session) {
      const event = {
        timestamp: new Date().toISOString(),
        sessionId: req.session.id,
        userId: req.session.userId,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method
      };
      
      console.log('[SESSION]', event);
    }
    next();
  },

  // Get session statistics
  getStats: () => {
    // This would typically query the database for session statistics
    return {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0
    };
  }
};

module.exports = {
  sessionConfig,
  csrfProtection,
  sessionSecurity,
  sessionMonitor
}; 