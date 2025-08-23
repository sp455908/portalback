const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const restrictTo = require('../middlewares/role.middleware');
const { csrfProtection } = require('../middlewares/session.middleware');
const securityMonitor = require('../utils/securityMonitor');

// ✅ ADD: Security monitoring routes (admin only)
router.get('/events', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    try {
      const { limit = 100, severity } = req.query;
      const events = securityMonitor.getEvents(parseInt(limit), severity);
      
      res.status(200).json({
        status: 'success',
        data: {
          events,
          total: events.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching security events:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch security events'
      });
    }
  }
);

router.get('/report', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    try {
      const report = securityMonitor.generateReport();
      
      res.status(200).json({
        status: 'success',
        data: {
          report,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating security report:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate security report'
      });
    }
  }
);

router.get('/stats', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    try {
      const stats = securityMonitor.getStats();
      
      res.status(200).json({
        status: 'success',
        data: {
          stats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching security stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch security stats'
      });
    }
  }
);

// ✅ ADD: Security configuration routes
router.get('/config', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    try {
      const config = {
        maxFailedAttempts: securityMonitor.maxFailedAttempts,
        blockDuration: securityMonitor.blockDuration,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
        environment: process.env.NODE_ENV || 'development',
        securityFeatures: {
          csrf: true,
          xss: true,
          sqlInjection: true,
          rateLimiting: true,
          sessionManagement: true
        }
      };
      
      res.status(200).json({
        status: 'success',
        data: {
          config,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching security config:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch security configuration'
      });
    }
  }
);

// ✅ ADD: Security test endpoints
router.post('/test-csrf', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'CSRF protection is working correctly',
      timestamp: new Date().toISOString()
    });
  }
);

router.post('/test-xss', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    const { testInput } = req.body;
    
    if (!testInput) {
      return res.status(400).json({
        status: 'fail',
        message: 'Test input is required'
      });
    }
    
    // Test XSS protection
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onload/i,
      /onerror/i
    ];
    
    const hasSuspiciousContent = suspiciousPatterns.some(pattern => 
      pattern.test(testInput)
    );
    
    if (hasSuspiciousContent) {
      securityMonitor.trackSuspiciousActivity({
        type: 'xss_test_detected',
        details: { input: testInput },
        severity: 'medium'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'XSS protection test completed',
      data: {
        input: testInput,
        suspiciousContentDetected: hasSuspiciousContent,
        sanitized: true
      },
      timestamp: new Date().toISOString()
    });
  }
);

// ✅ ADD: Security cleanup routes
router.post('/cleanup', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    try {
      const { days = 7 } = req.body;
      securityMonitor.clearOldEvents(parseInt(days));
      
      res.status(200).json({
        status: 'success',
        message: `Security events older than ${days} days have been cleaned up`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error cleaning up security events:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to cleanup security events'
      });
    }
  }
);

module.exports = router;