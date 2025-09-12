const jwt = require('jsonwebtoken');
const { Settings, User } = require('../models');

// Global maintenance gate: blocks non-admin traffic when maintenanceMode is ON
// Allows:
// - Admin requests (JWT bearer token with role=admin)
// - Admin login/refresh/settings endpoints to manage the platform
module.exports = async function maintenanceGate(req, res, next) {
  try {
    const settings = await Settings.findOne();
    if (!settings || settings.maintenanceMode !== true) {
      return next();
    }

    // Allow preflight
    if (req.method === 'OPTIONS') return next();

    const path = req.path || '';

    // Always allow admin auth endpoints so admin can get in and manage maintenance
    const allowlistPaths = [
      '/api/auth/login',
      '/api/auth/refresh-token',
      '/api/auth/verify-token',
      '/api/settings', // protected by admin in routes
      '/api/courses', // public content
      '/api/settings/maintenance-status', // public maintenance status
      '/api/captcha', // captcha for login page
      '/api/security/public-key', // public key for encryption
    ];
    if (allowlistPaths.some(p => path.startsWith(p))) {
      return next();
    }

    // Explicitly block registrations while in maintenance
    if (path.startsWith('/api/auth/register') || path.startsWith('/api/auth/user-auth/register')) {
      return res.status(503).json({ status: 'fail', message: 'Platform is under maintenance. Registration is temporarily disabled.' });
    }

    // If token present, verify and allow only admin role during maintenance
    let token = null;
    if (req.cookies && typeof req.cookies.token === 'string') {
      token = String(req.cookies.token);
    }
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id);
        if (user && user.role === 'admin') {
          return next();
        }
        // Non-admin with valid token during maintenance - block
        const origin = req.headers.origin;
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Vary', 'Origin');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        return res.status(503).json({ status: 'fail', message: 'Platform is under maintenance' });
      } catch (_) {
        // fall through to block
      }
    }

    // Default: block during maintenance
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    return res.status(503).json({ status: 'fail', message: 'Platform is under maintenance' });
  } catch (_) {
    return next();
  }
}

