const jwt = require('jsonwebtoken');
const { User, UserSession, Owner, Settings } = require('../models');

// Basic validators to reduce injection risk from untrusted inputs
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isValidBearer = (h) => isNonEmptyString(h) && /^Bearer\s+[^\s]+$/i.test(h);
const isHex = (v, len) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${len}}$`, 'i').test(v);
const isLikelyUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
const coerceId = (id) => {
  // Accept numeric PKs or UUIDs; return normalized string/numeric or null
  if (typeof id === 'number' && isPositiveInt(id)) return id;
  if (typeof id === 'string') {
    const t = id.trim();
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      return isPositiveInt(n) ? n : null;
    }
    if (isLikelyUuid(t)) return t.toLowerCase();
  }
  return null;
};
const sanitizeToken = (t) => (typeof t === 'string' ? t.trim() : '');

exports.protect = async (req, res, next) => {
  let token;
  let sessionId;

  // Prefer JWT from HTTP-only cookie (set by backend auth)
  if (req.cookies && typeof req.cookies.token === 'string') {
    token = sanitizeToken(req.cookies.token);
  }

  // Fallback to Authorization header for legacy clients/tools
  if (!token && isValidBearer(req.headers.authorization)) {
    token = sanitizeToken(req.headers.authorization.split(' ')[1]);
  }

  // Optional session ID header for session validation (legacy/parallel systems)
  if (isNonEmptyString(req.headers['x-session-id'])) {
    // Only accept reasonably safe sessionId formats: hex(64) or UUID
    const raw = String(req.headers['x-session-id']).trim();
    if (isHex(raw, 64) || isLikelyUuid(raw)) {
      sessionId = raw;
    }
  }

  if (!token) {
    return res.status(401).json({ 
      status: 'fail',
      message: 'Not authorized - No token provided' 
    });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Support Owner (superadmin) tokens
    if (decoded && decoded.type === 'owner') {
      const ownerId = coerceId(decoded.id);
      if (ownerId == null) {
        return res.status(401).json({ status: 'fail', message: 'Invalid token subject' });
      }
      const owner = await Owner.findByPk(ownerId);
      if (!owner || owner.isActive === false) {
        return res.status(401).json({ status: 'fail', message: 'Owner not found or inactive' });
      }
      req.user = {
        id: owner.id,
        email: owner.email,
        role: 'owner',
        isOwner: true
      };
      return next();
    }

    // Find user using Sequelize (PostgreSQL)
    const safeUserId = coerceId(decoded.id);
    if (safeUserId == null) {
      return res.status(401).json({ status: 'fail', message: 'Invalid token subject' });
    }
    const user = await User.findByPk(safeUserId);
    
    if (!user) {
      return res.status(401).json({ 
        status: 'fail',
        message: 'User not found' 
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        status: 'fail',
        message: 'Account is disabled' 
      });
    }
    
    if (sessionId) {
      // Validate the session only when provided
      const session = await UserSession.findActiveSession(user.id, sessionId);
      
      if (!session) {
        return res.status(401).json({
          status: 'fail',
          message: 'Invalid or expired session. Please login again.',
          code: 'SESSION_INVALID'
        });
      }
      
      // Check if session is idle (30 minutes of inactivity)
      if (session.isIdle(30)) {
        await UserSession.update({ isActive: false }, { where: { sessionId } });
        return res.status(401).json({
          status: 'fail',
          message: 'Session expired due to inactivity. Please login again.',
          code: 'SESSION_IDLE_TIMEOUT'
        });
      }
      
      // Check if session is expired
      if (session.isExpired()) {
        await UserSession.update({ isActive: false }, { where: { sessionId } });
        return res.status(401).json({
          status: 'fail',
          message: 'Session has expired. Please login again.',
          code: 'SESSION_EXPIRED'
        });
      }
      
      // Update session activity
      await session.updateActivity();
    }
    
    // Maintenance mode check: block all non-admin/owner access
    try {
      const settings = await Settings.findOne();
      if (settings?.maintenanceMode) {
        const role = user.role;
        if (role !== 'admin') {
          // Still return 503, but ensure CORS headers are present by echoing origin if available
          const origin = req.headers.origin;
          if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
          }
          return res.status(503).json({ status: 'fail', message: 'Platform is under maintenance' });
        }
      }
    } catch (_) {}

    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        status: 'fail',
        message: 'Token expired' 
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        status: 'fail',
        message: 'Invalid token' 
      });
    }
    
    res.status(401).json({ 
      status: 'fail',
      message: 'Token verification failed' 
    });
  }
};

// Variant: allow JWT via query token (e.g., for file downloads opened in a new tab)
exports.protectWithQueryToken = async (req, res, next) => {
  console.log('Auth middleware (query token allowed) called');
  let token;
  let sessionId;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Fallback to query token (e.g., /path?token=...)
  if (!token && req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (req.headers['x-session-id']) {
    sessionId = req.headers['x-session-id'];
  }

  if (!token) {
    return res.status(401).json({ 
      status: 'fail',
      message: 'Not authorized - No token provided' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ status: 'fail', message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({ status: 'fail', message: 'Account is disabled' });
    }

    if (sessionId) {
      const session = await UserSession.findActiveSession(user.id, sessionId);
      if (!session) {
        return res.status(401).json({ status: 'fail', message: 'Invalid or expired session', code: 'SESSION_INVALID' });
      }
      if (session.isIdle(30) || session.isExpired()) {
        await UserSession.update({ isActive: false }, { where: { sessionId } });
        return res.status(401).json({ status: 'fail', message: 'Session expired', code: 'SESSION_EXPIRED' });
      }
      await session.updateActivity();
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth (query token) error:', err);
    return res.status(401).json({ status: 'fail', message: 'Invalid token or session expired' });
  }
};
// Middleware to detect session conflicts
exports.detectSessionConflict = async (req, res, next) => {
  try {
    if (req.user && req.headers['x-session-id']) {
      const userId = req.user.id;
      const currentSessionId = req.headers['x-session-id'];
      
      // Check for other active sessions
      const activeSessions = await UserSession.findUserActiveSessions(userId);
      const otherSessions = activeSessions.filter(session => session.sessionId !== currentSessionId);
      
      if (otherSessions.length > 0) {
        // Log the conflict
        console.log(`⚠️ Session conflict detected for user ${req.user.email}: ${otherSessions.length} other active sessions`);
        
        // You can choose to either:
        // 1. Allow the request but log the conflict (current behavior)
        // 2. Block the request and force re-login
        // 3. Automatically deactivate other sessions
        
        // For now, we'll just log and continue
        // In a production environment, you might want to be more strict
      }
    }
    
    next();
  } catch (error) {
    console.error('Session conflict detection error:', error);
    next(); // Continue even if detection fails
  }
};