const rateLimit = require('express-rate-limit');

/**
 * Rate limiting middleware for practice test operations
 */
const practiceTestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    status: 'fail',
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin users
    return req.user && (req.user.role === 'admin' || req.user.isOwner);
  }
});

/**
 * Rate limiting for test submission (more restrictive)
 */
const testSubmissionRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 test submissions per 5 minutes
  message: {
    status: 'fail',
    message: 'Too many test submissions, please wait before submitting again'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting for authentication endpoints
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per 15 minutes
  message: {
    status: 'fail',
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting for PDF downloads - Prevent abuse
 */
const pdfDownloadRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each user to 10 PDF downloads per 5 minutes
  message: {
    status: 'fail',
    message: 'Too many PDF downloads, please wait before downloading again'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Per user limiting for PDF downloads - only for authenticated users
  keyGenerator: (req) => {
    const userId = req.user?.id;
    if (userId) {
      return `pdf:user:${userId}`;
    }
    // For unauthenticated requests, skip rate limiting (they'll be blocked by auth anyway)
    return `pdf:skip:${Math.random()}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin users or unauthenticated requests
    return !req.user || (req.user.role === 'admin' || req.user.isOwner);
  }
});

module.exports = {
  practiceTestRateLimit,
  testSubmissionRateLimit,
  authRateLimit,
  pdfDownloadRateLimit
};