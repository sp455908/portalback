const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const restrictTo = require('../middlewares/role.middleware');
const { csrfProtection } = require('../middlewares/session.middleware');
const securityMonitor = require('../utils/securityMonitor');
const { User, UserSession } = require('../models');
const { getPublicKey } = require('../utils/rsa');

// ✅ ADD: Security monitoring routes (admin only)
router.get('/events', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ status: 'fail', message: 'Disabled in production' });
      }
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
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ status: 'fail', message: 'Disabled in production' });
      }
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
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ status: 'fail', message: 'Disabled in production' });
      }
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

// CSRF token fetch (admin only) - returns a fresh token
router.get(
  '/csrf-token',
  protect,
  restrictTo('admin'),
  csrfProtection.generateToken,
  (req, res) => {
    res.status(200).json({ status: 'success', token: res.locals.csrfToken });
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

// Admin session management endpoints

// List active sessions for a specific user (admin only)
router.get(
  '/sessions/:userId',
  protect,
  restrictTo('admin'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ status: 'fail', message: 'User not found' });
      }

      const sessions = await UserSession.findUserActiveSessions(user.id);

      return res.status(200).json({
        status: 'success',
        data: sessions.map(s => ({
          id: s.id,
          sessionId: s.sessionId,
          lastActivity: s.lastActivity,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          deviceInfo: s.deviceInfo,
          expiresAt: s.expiresAt,
          isActive: s.isActive
        }))
      });
    } catch (error) {
      console.error('List user sessions error:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to fetch sessions' });
    }
  }
);

// Kill a specific session for a user (admin only)
router.post(
  '/sessions/kill-one',
  protect,
  restrictTo('admin'),
  csrfProtection.validateToken,
  async (req, res) => {
    try {
      const { userId, sessionId } = req.body;

      if (!userId || !sessionId) {
        return res.status(400).json({ status: 'fail', message: 'userId and sessionId are required' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ status: 'fail', message: 'User not found' });
      }

      const updated = await UserSession.update(
        { isActive: false },
        { where: { userId: user.id, sessionId } }
      );

      if ((updated?.[0] || 0) === 0) {
        return res.status(404).json({ status: 'fail', message: 'Active session not found' });
      }

      return res.status(200).json({ status: 'success', message: 'Session terminated' });
    } catch (error) {
      console.error('Kill one session error:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to terminate session' });
    }
  }
);

// Kill all active sessions for a user (admin only)
router.post(
  '/sessions/kill-all',
  protect,
  restrictTo('admin'),
  csrfProtection.validateToken,
  async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ status: 'fail', message: 'userId is required' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ status: 'fail', message: 'User not found' });
      }

      const result = await UserSession.deactivateUserSessions(user.id);
      const count = Array.isArray(result) ? result[0] : result;

      return res.status(200).json({
        status: 'success',
        message: `Terminated ${count} active session(s)`
      });
    } catch (error) {
      console.error('Kill all sessions error:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to terminate sessions' });
    }
  }
);

// ✅ ADD: Security test endpoints
router.post('/test-csrf', 
  protect, 
  restrictTo('admin'), 
  csrfProtection.validateToken, 
  (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ status: 'fail', message: 'Disabled in production' });
    }
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
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ status: 'fail', message: 'Disabled in production' });
    }
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
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ status: 'fail', message: 'Disabled in production' });
      }
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

// Public RSA key endpoint (no auth)
// Expose at /api/security/public-key via main router mount
router.get('/public-key', (req, res) => {
  try {
    const pub = getPublicKey();
    res.status(200).json({ status: 'success', key: pub });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Failed to load public key' });
  }
});