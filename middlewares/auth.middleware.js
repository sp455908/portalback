const jwt = require('jsonwebtoken');
const { User, UserSession } = require('../models');

exports.protect = async (req, res, next) => {
  console.log('Auth middleware called');
  console.log('Authorization header:', req.headers.authorization);
  
  let token;
  let sessionId;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extracted:', token ? 'Present' : 'Missing');
  }
  
  if (req.headers['x-session-id']) {
    sessionId = req.headers['x-session-id'];
    console.log('Session ID extracted:', sessionId ? 'Present' : 'Missing');
  }
  
  // Require session ID for all protected routes
  if (!req.headers['x-session-id']) {
    return res.status(401).json({
      status: 'fail',
      message: 'Session ID required',
      code: 'SESSION_ID_REQUIRED'
    });
  }

  sessionId = req.headers['x-session-id'];
  console.log('Session ID extracted:', sessionId ? 'Present' : 'Missing');

  if (!token) {
    return res.status(401).json({ 
      status: 'fail',
      message: 'Not authorized - No token provided' 
    });
  }

  try {
    // Verify JWT token
    console.log('Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded, user ID:', decoded.id);
    
    // Find user using Sequelize (PostgreSQL)
    console.log('Looking up user in database...');
    const user = await User.findByPk(decoded.id);
    console.log('User found:', user ? { id: user.id, role: user.role, userType: user.userType } : 'Not found');
    
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
    
    // Validate the session (required)
    console.log('Validating session...');
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
    console.log('Session validated and activity updated');
    
    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    
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