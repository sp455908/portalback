const jwt = require('jsonwebtoken');
const { User, UserSession } = require('../models');
const crypto = require('crypto');
const eventBus = require('../utils/eventBus');

// Session timeout configuration (30 minutes)
const SESSION_TIMEOUT_MINUTES = 30;
const IDLE_TIMEOUT_MINUTES = 30;

// Generate unique session ID
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Check if user has active sessions (for single session enforcement)
const checkActiveSessions = async (userId, currentSessionId = null) => {
  try {
    const activeSessions = await UserSession.findUserActiveSessions(userId);
    // Filter out current session if provided
    const otherSessions = currentSessionId 
      ? activeSessions.filter(session => session.sessionId !== currentSessionId)
      : activeSessions;
    return {
      hasActiveSessions: otherSessions.length > 0,
      activeSessions: otherSessions,
      currentSession: currentSessionId ? activeSessions.find(s => s.sessionId === currentSessionId) : null
    };
  } catch (error) {
    return { hasActiveSessions: false, activeSessions: [], currentSession: null };
  }
};

// Create new session
const createSession = async (user, req) => {
  try {
    const sessionId = generateSessionId();
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    // Extract device info from user agent
    const deviceInfo = {
      userAgent,
      ipAddress,
      timestamp: new Date()
    };
    // Calculate expiration time (30 minutes from now)
    const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000);
    const sessionData = {
      userId: user.id,
      sessionId,
      accessToken: '', // Will be set after token generation
      refreshToken: '', // Will be set after token generation
      ipAddress,
      userAgent,
      lastActivity: new Date(),
      expiresAt,
      deviceInfo
    };
    const session = await UserSession.createSession(sessionData);
    return session;
  } catch (error) {
    throw error;
  }
};

// Update session activity
const updateSessionActivity = async (sessionId) => {
  try {
    const session = await UserSession.findOne({
      where: { sessionId, isActive: true }
    });
    if (session) {
      await session.updateActivity();
      return session;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Deactivate session
const deactivateSession = async (sessionId) => {
  try {
    await UserSession.update(
      { isActive: false },
      { where: { sessionId } }
    );
    // Emit realtime event so connected clients can react instantly
    eventBus.emit('session_terminated', { sessionId });
    return true;
  } catch (error) {
    return false;
  }
};

// Cleanup expired sessions
const cleanupExpiredSessions = async () => {
  try {
    const result = await UserSession.cleanupExpiredSessions();
    return result[0];
  } catch (error) {
    return 0;
  }
};

// Session validation middleware
const validateSession = async (req, res, next) => {
  try {
    let token;
    let sessionId;
    // Extract token and session ID from headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (req.headers['x-session-id']) {
      sessionId = req.headers['x-session-id'];
    }
    if (!token || !sessionId) {
      return res.status(401).json({
        status: 'fail',
        message: 'Missing authentication token or session ID'
      });
    }
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found or inactive'
      });
    }
    // Find active session
    const session = await UserSession.findActiveSession(user.id, sessionId);
    if (!session) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired session',
        code: 'SESSION_EXPIRED'
      });
    }
    // Check if session is idle (30 minutes of inactivity)
    if (session.isIdle(IDLE_TIMEOUT_MINUTES)) {
      await deactivateSession(sessionId);
      return res.status(401).json({
        status: 'fail',
        message: 'Session expired due to inactivity',
        code: 'SESSION_IDLE_TIMEOUT'
      });
    }
    // Check if session is expired
    if (session.isExpired()) {
      await deactivateSession(sessionId);
      return res.status(401).json({
        status: 'fail',
        message: 'Session has expired',
        code: 'SESSION_EXPIRED'
      });
    }
    // Update last activity
    await updateSessionActivity(sessionId);
    // Attach user and session to request
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Session validation failed'
    });
  }
};

// Single session enforcement middleware
const enforceSingleSession = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return next(); // Skip if no userId provided
    }
    const sessionCheck = await checkActiveSessions(userId);
    if (sessionCheck.hasActiveSessions) {
      // Deactivate other sessions
      await UserSession.deactivateUserSessions(userId);
      // Emit broadcast to notify UI to refresh its active sessions list
      eventBus.emit('broadcast', { type: 'sessions_deactivated', userId });
    }
    next();
  } catch (error) {
    next(); // Continue even if enforcement fails
  }
};

// Activity tracking middleware
const trackActivity = async (req, res, next) => {
  try {
    // Skip activity tracking for certain endpoints
    const skipEndpoints = ['/api/health', '/api/auth/refresh', '/api/auth/validate-session'];
    if (skipEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
      return next();
    }
    
    // ✅ FIX: Enhanced activity tracking for all authenticated requests
    if (req.user && req.user.id) {
      // Try to update session activity using sessionId from header
      const sessionId = req.headers['x-session-id'];
      if (sessionId) {
        await updateSessionActivity(sessionId);
      } else {
        // If no sessionId, find and update the most recent active session
        const activeSessions = await UserSession.findUserActiveSessions(req.user.id);
        if (activeSessions.length > 0) {
          // Update the most recent session
          await activeSessions[0].updateActivity();
        }
      }
    }
    
    // Legacy session tracking
    if (req.session && req.session.sessionId) {
      await updateSessionActivity(req.session.sessionId);
    }
    
    next();
  } catch (error) {
    console.error('Activity tracking error:', error);
    next(); // Continue even if tracking fails
  }
};

// ✅ IMPROVEMENT: Enhanced session conflict detection middleware
const detectSessionConflict = async (req, res, next) => {
  try {
    if (req.user && req.session) {
      const sessionCheck = await checkActiveSessions(req.user.id, req.session.sessionId);
      if (sessionCheck.hasActiveSessions) {
        // ✅ IMPROVEMENT: More detailed session conflict information
        return res.status(409).json({
          status: 'fail',
          message: 'User is already logged in on another device. Please log out from other sessions or contact administrator.',
          code: 'SESSION_CONFLICT',
          data: {
            activeSessions: sessionCheck.activeSessions.map(session => ({
              id: session.id,
              sessionId: session.sessionId,
              lastActivity: session.lastActivity,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
              deviceInfo: session.deviceInfo
            })),
            currentSession: {
              id: req.session.id,
              sessionId: req.session.sessionId,
              lastActivity: req.session.lastActivity
            },
            totalActiveSessions: sessionCheck.activeSessions.length + 1
          }
        });
      }
    }
    next();
  } catch (error) {
    console.error('Session conflict detection error:', error);
    next(); // Continue even if detection fails
  }
};

module.exports = {
  validateSession,
  enforceSingleSession,
  trackActivity,
  detectSessionConflict,
  createSession,
  updateSessionActivity,
  deactivateSession,
  cleanupExpiredSessions,
  checkActiveSessions,
  SESSION_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_MINUTES
};
