// Window/Tab switching detection and prevention middleware
// Following OWASP guidelines for secure test environments

const windowFocusMiddleware = {
  // Track user focus events
  trackFocus: (req, res, next) => {
    // Add headers to help frontend detect focus changes
    res.setHeader('X-Focus-Tracking', 'enabled');
    res.setHeader('X-Test-Security', 'strict');
    next();
  },

  // Validate test attempt integrity
  validateTestIntegrity: async (req, res, next) => {
    try {
      // Check for suspicious patterns in test attempts
      const userAgent = req.get('User-Agent') || '';
      const ipAddress = req.ip;
      
      // Log potential security violations
      if (req.path.includes('/attempt/') && req.method === 'POST') {
        // Check for rapid submissions (potential automation)
        const now = Date.now();
        const lastSubmission = req.session?.lastTestSubmission || 0;
        const timeDiff = now - lastSubmission;
        
        if (timeDiff < 1000) { // Less than 1 second between submissions
          console.warn('Potential rapid test submission detected:', {
            ip: ipAddress,
            userAgent,
            timeDiff,
            userId: req.user?.id
          });
        }
        
        req.session.lastTestSubmission = now;
      }
      
      next();
    } catch (error) {
      console.error('Error in test integrity validation:', error);
      next(); // Continue processing even if validation fails
    }
  },

  // Prevent multiple concurrent test sessions
  preventConcurrentSessions: async (req, res, next) => {
    try {
      if (req.user && req.path.includes('/start')) {
        // Check for existing in-progress tests
        const TestAttempt = require('../models/testAttempt.model');
        const existingAttempt = await TestAttempt.findOne({
          where: {
            userId: req.user.id,
            status: 'in_progress'
          }
        });

        if (existingAttempt) {
          return res.status(409).json({
            status: 'fail',
            message: 'You already have a test in progress. Please complete it before starting a new one.',
            existingAttemptId: existingAttempt.id
          });
        }
      }
      
      next();
    } catch (error) {
      console.error('Error checking concurrent sessions:', error);
      next(); // Continue processing even if check fails
    }
  },

  // Add security headers for test pages
  addTestSecurityHeaders: (req, res, next) => {
    if (req.path.includes('/attempt/') || req.path.includes('/start')) {
      // Prevent caching of test content
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Add security headers
      res.setHeader('X-Test-Mode', 'secure');
      res.setHeader('X-Content-Security', 'strict');
    }
    
    next();
  }
};

module.exports = windowFocusMiddleware;
