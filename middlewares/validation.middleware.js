const { body, param, query, validationResult } = require('express-validator');

// Input validation middleware following OWASP guidelines
const validationMiddleware = {
  // Validate test attempt ID
  validateAttemptId: [
    param('testAttemptId')
      .isInt({ min: 1 })
      .withMessage('Test attempt ID must be a positive integer')
      .toInt(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid test attempt ID',
          errors: errors.array()
        });
      }
      next();
    }
  ],

  // Validate test ID
  validateTestId: [
    param('testId')
      .isInt({ min: 1 })
      .withMessage('Test ID must be a positive integer')
      .toInt(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid test ID',
          errors: errors.array()
        });
      }
      next();
    }
  ],

  // Validate test submission
  validateTestSubmission: [
    body('answers')
      .isArray({ min: 1 })
      .withMessage('Answers must be a non-empty array'),
    body('answers.*.selectedAnswer')
      .isInt({ min: 0, max: 3 })
      .withMessage('Selected answer must be between 0 and 3'),
    body('answers.*.timeSpent')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Time spent must be a non-negative integer'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid test submission data',
          errors: errors.array()
        });
      }
      next();
    }
  ],

  // Validate pagination parameters
  validatePagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid pagination parameters',
          errors: errors.array()
        });
      }
      next();
    }
  ],

  // Sanitize and validate search parameters
  validateSearch: [
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1 and 100 characters')
      .trim()
      .escape(),
    query('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters')
      .trim()
      .escape(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid search parameters',
          errors: errors.array()
        });
      }
      next();
    }
  ]
};

// Rate limiting configuration
const rateLimitConfig = {
  // General API rate limiting
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      status: 'fail',
      message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Strict rate limiting for authentication
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
      status: 'fail',
      message: 'Too many authentication attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Test submission rate limiting
  testSubmission: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 test submissions per minute
    message: {
      status: 'fail',
      message: 'Too many test submissions, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false
  }
};

module.exports = {
  validationMiddleware,
  rateLimitConfig
};
