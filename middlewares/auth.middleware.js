const jwt = require('jsonwebtoken');
const { User, UserSession, Owner } = require('../models');

exports.protect = async (req, res, next) => {
  let token;
  let sessionId;

  // Prefer JWT from HTTP-only cookie (set by backend auth)
  if (req.cookies && typeof req.cookies.token === 'string') {
    token = req.cookies.token;
  }

  // Fallback to Authorization header for legacy clients/tools
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Optional session ID header for session validation (legacy/parallel systems)
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
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Support Owner (superadmin) tokens
    if (decoded && decoded.type === 'owner') {
      const owner = await Owner.findByPk(decoded.id);
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
    const user = await User.findByPk(decoded.id);
    
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