const { User, LoginAttempt, UserSession, Settings, Owner } = require('../models');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { promisify } = require('util');
const crypto = require('crypto');
const { userCache, adminCountCache } = require('../utils/cache');
const { 
  createSession, 
  deactivateSession, 
  enforceSingleSession,
  SESSION_TIMEOUT_MINUTES 
} = require('../middlewares/sessionManagement.middleware');


const devLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    
    console.log(...args);
  }
};


const verifyToken = promisify(jwt.verify);


const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
  });
};


const signRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: '30d' 
  });
};

// Sign access token for Owner (superadmin)
const signOwnerToken = (id) => {
  return jwt.sign({ id, type: 'owner' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};


const createSendToken = async (user, statusCode, res, req = null, extraMeta = {}) => {
  const accessToken = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  
  
  user.password = undefined;

  
  let session = null;
  if (req) {
    try {
      session = await createSession(user, req);
      
      await session.update({
        accessToken,
        refreshToken
      });
    } catch (error) {
      
      
    }
  }

  
  // Set access token cookie for browser requests (supports new-tab file downloads)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // match access token expiry (7d default)
    domain: process.env.NODE_ENV === 'production' ? undefined : undefined
  };
  
  console.log('Setting token cookie with options:', cookieOptions);
  res.cookie('token', accessToken, cookieOptions);

  const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    domain: process.env.NODE_ENV === 'production' ? undefined : undefined
  };
  
  console.log('Setting refreshToken cookie with options:', refreshCookieOptions);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);

  
  // ✅ SECURITY FIX: Minimize sensitive data in login response
  let userForResponse = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
  
  // Only include essential user data for login response
  userForResponse = {
    id: userForResponse.id,
    email: userForResponse.email,
    firstName: userForResponse.firstName,
    lastName: userForResponse.lastName,
    role: userForResponse.role,
    userType: userForResponse.userType,
    isActive: userForResponse.isActive,
    createdAt: userForResponse.createdAt
    // Removed: phone, address, studentId, corporateId, governmentId, pincode, city, state, profileImage
  };

  res.status(statusCode).json({
    status: 'success',
    // Return token in response body for frontend localStorage (in addition to HTTP-only cookie)
    token: accessToken,
    refreshToken: refreshToken,
    sessionId: session ? session.sessionId : null,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    sessionTimeout: SESSION_TIMEOUT_MINUTES * 60, 
    meta: extraMeta,
    data: {
      user: userForResponse
    }
  });
};


exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, userType, phone, address, city, state, pincode } = req.body;
    const encryptionService = require('../utils/encryption');
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;

    if (!role || !userType) {
      return res.status(400).json({
        status: 'fail',
        message: 'Role and userType are required.'
      });
    }

    // Hardened: Disallow creating admin/superadmin via public registration
    const publicAllowedRoles = ['student', 'corporate', 'government'];
    if (!publicAllowedRoles.includes(role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'Registration for this role is not allowed'
      });
    }

    
    const validUserTypes = ['student', 'corporate', 'government'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid userType. Must be student, corporate, or government.'
      });
    }

    // Skip admin counting since public register cannot create admin users
    const [existingUser] = await Promise.all([
      User.findOne({ where: { email: normalizedEmail } })
    ]);

    
    if (existingUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }

    
    let newUser;
    try {
      newUser = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        password,
        role, // role already validated to be in publicAllowedRoles
        userType,
        phone: phone ? encryptionService.encrypt(String(phone)) : phone,
        address: address ? encryptionService.encrypt(String(address)) : address,
        city,
        state,
        pincode: pincode ? encryptionService.encrypt(String(pincode)) : pincode
      });
    } catch (createErr) {
      
      if (createErr.name === 'SequelizeUniqueConstraintError' && 
          (createErr?.fields?.studentId || createErr?.fields?.corporateId || createErr?.fields?.governmentId)) {
        newUser = await User.create({
          firstName,
          lastName,
          email: normalizedEmail,
          password,
          role,
          userType,
          phone: phone ? encryptionService.encrypt(String(phone)) : phone,
          address: address ? encryptionService.encrypt(String(address)) : address,
          city,
          state,
          pincode: pincode ? encryptionService.encrypt(String(pincode)) : pincode
        });
      } else {
        throw createErr;
      }
    }

    
    await createSendToken(newUser, 201, res, req);

  } catch (err) {
    
    
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        status: 'fail',
        message: messages.join('. ')
      });
    }
    
    
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(val => val.message);
      return res.status(400).json({
        status: 'fail',
        message: messages.join('. ')
      });
    }
    
    
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }
    
    
    if (err.message === 'Only one admin user is allowed in the system') {
      return res.status(400).json({
        status: 'fail',
        message: err.message
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
    }

    
    const currentSettings = await Settings.findOne();
    
    
    const user = await User.findOne({ where: { email } });

    // Special case: Allow Owner (superadmin) login by email when not found in Users
    if (!user) {
      const owner = await Owner.findOne({ where: { email } });
      if (owner) {
        // Validate password
        const isMatch = await owner.comparePassword(password);
        if (!isMatch) {
          return res.status(401).json({
            status: 'fail',
            message: 'Incorrect email or password',
            code: 'INVALID_CREDENTIALS',
            shouldCountFailedAttempt: false,
            failedAttemptsCount: 0
          });
        }
        if (owner.isActive === false) {
          return res.status(403).json({
            status: 'fail',
            message: 'Your account has been disabled. Please contact an administrator.'
          });
        }

        // Issue Owner tokens and cookies (no UserSession tracking)
        const accessToken = signOwnerToken(owner.id);
        const ownerRefreshToken = signRefreshToken(owner.id);

        // Set cookies
        res.cookie('token', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          domain: process.env.NODE_ENV === 'production' ? undefined : undefined
        });
        res.cookie('refreshToken', ownerRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          domain: process.env.NODE_ENV === 'production' ? undefined : undefined
        });

        return res.status(200).json({
          status: 'success',
          // Return tokens in response body for frontend localStorage (in addition to HTTP-only cookies)
          token: accessToken,
          refreshToken: ownerRefreshToken,
          sessionId: null,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          sessionTimeout: SESSION_TIMEOUT_MINUTES * 60,
          data: {
            user: {
              id: owner.id,
              email: owner.email,
              role: 'owner',
              isOwner: true,
              firstName: 'IIFTL',
              lastName: 'SuperAdmin',
              isActive: owner.isActive
            }
          }
        });
      }
    }

    if (currentSettings?.maintenanceMode) {
      
      if (!user || (user.role !== 'admin')) {
        return res.status(503).json({
          status: 'fail',
          message: 'Platform is under maintenance.'
        });
      }
    }
    
    
    if (user) {
      userCache.set(`user_${user.id}`, {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }, 2 * 60 * 1000); 
    }
    
    if (!user || !(await user.comparePassword(password))) {
      
      if (user) {
        devLog(`🔐 Failed login attempt for user: ${user.email} (ID: ${user.id})`);
        
        const loginResult = await LoginAttempt.processLoginAttempt({
          userId: user.id,
          email,
          ipAddress,
          userAgent,
          success: false
        });

        devLog(`📊 Login result:`, loginResult);

        
        if (loginResult.shouldBlock && user.role !== 'admin') {
          devLog(`🚫 Blocking user ${user.email} after ${loginResult.failedCount} failed attempts`);
          
          
          const blockedUntil = await LoginAttempt.manuallyBlockUser(user.id, email, 'Multiple failed login attempts - Account blocked for security', null);
          
          
          await user.update({ isActive: false });
          
          devLog(`✅ User ${user.email} blocked successfully and marked as inactive`);
          
          return res.status(423).json({
            status: 'fail',
            message: 'Your account has been blocked due to multiple failed login attempts. Please contact an administrator to unblock your account.',
            code: 'ACCOUNT_BLOCKED',
            blockedUntil: null,
            remainingMinutes: null,
            isPermanent: true,
            contactAdmin: true
          });
        } else {
          
          if (user.role === 'admin') {
            devLog(`🛡️ Admin ${user.email} failed attempt count ${loginResult.failedCount || 0} – block skipped by policy`);
          } else {
            devLog(`⚠️ User ${user.email} has ${loginResult.failedCount || 0} failed attempts, not blocked yet`);
          }
        }
      }

      
      const failedAttemptsCount = user ? await LoginAttempt.getFailedAttemptsCount(user.id) : await LoginAttempt.getFailedAttemptsCountByEmail(email);
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect email or password',
        code: 'INVALID_CREDENTIALS',
        shouldCountFailedAttempt: true,
        failedAttemptsCount: failedAttemptsCount || 0
      });
    }

    
    const loginStatus = await LoginAttempt.getLoginStatus(user.id, email);
    
    
    if ((loginStatus.isUserBlocked || loginStatus.isEmailBlocked) && user.role !== 'admin') {
      
      await LoginAttempt.create({
        userId: user.id,
        email,
        ipAddress,
        userAgent,
        success: false,
        attemptTime: new Date()
      });

      const blockedUntil = loginStatus.isUserBlocked ? loginStatus.userBlockedUntil : loginStatus.emailBlockedUntil;
      const isPermanent = !blockedUntil;
      
      if (isPermanent) {
        return res.status(423).json({
          status: 'fail',
          message: 'Your account has been blocked due to multiple failed login attempts. Please contact an administrator to unblock your account.',
          code: 'ACCOUNT_BLOCKED',
          blockedUntil: null,
          remainingMinutes: null,
          isPermanent: true,
          contactAdmin: true
        });
      } else {
        const remainingTime = Math.ceil((new Date(blockedUntil) - new Date()) / (1000 * 60));
        return res.status(423).json({
          status: 'fail',
          message: `Account temporarily blocked due to multiple failed login attempts. Please try again in ${remainingTime} minutes or contact an administrator.`,
          code: 'ACCOUNT_BLOCKED',
          blockedUntil,
          remainingMinutes: remainingTime,
          isPermanent: false
        });
      }
    }

    
    if (!user.isActive) {
      
      await LoginAttempt.create({
        userId: user.id,
        email,
        ipAddress,
        userAgent,
        success: false,
        attemptTime: new Date()
      });

      return res.status(403).json({
        status: 'fail',
        message: 'Your account has been disabled. Please contact an administrator.'
      });
    }

    
    // ✅ SECURITY FIX: Allow multiple sessions but limit to prevent abuse
    let otherActiveSessions = [];
    try {
      // First, clean up any expired sessions for this user
      await UserSession.update(
        { isActive: false },
        { 
          where: { 
            userId: user.id, 
            isActive: true,
            expiresAt: { [require('sequelize').Op.lt]: new Date() }
          } 
        }
      );
      
      const existingSessions = await UserSession.findUserActiveSessions(user.id);
      const validSessions = existingSessions.filter(s => s.isActive && !s.isExpired());
      otherActiveSessions = validSessions;
      
      // Allow up to 3 concurrent sessions per user (configurable via environment)
      const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 3;
      if (validSessions.length >= MAX_CONCURRENT_SESSIONS) {
        devLog(`🚫 Login blocked: User ${user.email} has ${validSessions.length} active sessions (max: ${MAX_CONCURRENT_SESSIONS})`);
        const statusInfo = await LoginAttempt.getLoginStatus(user.id, email);
        return res.status(409).json({
          status: 'fail',
          message: `You have reached the maximum number of concurrent sessions (${MAX_CONCURRENT_SESSIONS}). Please logout from another device first.`,
          code: 'TOO_MANY_SESSIONS',
          failedAttempt: false,
          shouldCountFailedAttempt: false,
          failedAttemptsCount: statusInfo?.failedAttemptsCount || 0,
          data: {
            activeSessions: validSessions.map(s => ({
              lastActivity: s.lastActivity,
              ipAddress: s.ipAddress,
              userAgent: s.userAgent
            })),
            count: validSessions.length,
            maxSessions: MAX_CONCURRENT_SESSIONS
          }
        });
      }
      
      // Log session info but allow login
      if (validSessions.length > 0) {
        devLog(`ℹ️ User ${user.email} logging in with ${validSessions.length} existing active session(s)`);
      }
    } catch (sessionError) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Session check error (non-critical):', sessionError);
      }
    }

    
    await LoginAttempt.create({
      userId: user.id,
      email,
      ipAddress,
      userAgent,
      success: true,
      attemptTime: new Date()
    });

    

    
    const conflict = otherActiveSessions.length > 0 && user.role !== 'admin';
    await createSendToken(user, 200, res, req, conflict ? {
      sessionConflict: true,
      activeSessions: otherActiveSessions.slice(0, 3).map(s => ({
        lastActivity: s.lastActivity,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent
      })),
      count: otherActiveSessions.length
    } : {});

  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      
      
    }
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? err : undefined
    });
  }
};


exports.getMe = async (req, res, next) => {
  try {
    // Support owner tokens: middleware sets req.user with isOwner
    if (req.user && req.user.isOwner === true) {
      return res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            role: 'owner',
            isOwner: true,
            firstName: 'IIFTL',
            lastName: 'SuperAdmin',
            isActive: true
          }
        }
      });
    }

    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    
    const encryptionService = require('../utils/encryption');
    const userJson = user.toJSON();
    const decryptedUser = {
      ...userJson,
      phone: userJson.phone ? encryptionService.safeDecrypt(String(userJson.phone)) : userJson.phone
    };

    res.status(200).json({
      status: 'success',
      data: {
        user: decryptedUser
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user profile'
    });
  }
};


exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(401).json({
        status: 'fail',
        message: 'No refresh token provided'
      });
    }

    
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token type'
      });
    }

    // If this refresh token belongs to an Owner (superadmin), mint an owner access token
    // We can reuse the same token payload but treat owner as a special principal
    let owner = null;
    let user = null;
    owner = await Owner.findByPk(decoded.id);
    if (owner && owner.isActive !== false) {
      const newOwnerAccess = signOwnerToken(owner.id);
      res.cookie('token', newOwnerAccess, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      return res.status(200).json({
        status: 'success',
        // ✅ SECURITY FIX: Don't return token in response body - it's in HTTP-only cookie
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        data: {
          user: {
            id: owner.id,
            email: owner.email,
            role: 'owner',
            isOwner: true
          }
        }
      });
    }
    
    // Otherwise, treat as regular user refresh
    user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found or inactive'
      });
    }

    
    const currentSettings = await Settings.findOne();
    if (currentSettings?.maintenanceMode && user.role !== 'admin') {
      return res.status(503).json({
        status: 'fail',
        message: 'Platform under maintenance. Please try again later.'
      });
    }

    
    const newAccessToken = signToken(user.id);

    // Also set/refresh access token cookie for browser-based auth (supports new-tab downloads)
    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: process.env.NODE_ENV === 'production' ? undefined : undefined
    });

    // Return token in response body for frontend localStorage (in addition to HTTP-only cookie)
    res.status(200).json({
      status: 'success',
      token: newAccessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      data: {
        user
      }
    });

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Refresh token expired. Please login again.'
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid refresh token'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Token refresh failed'
    });
  }
};


exports.logout = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const authHeader = req.headers.authorization && req.headers.authorization.startsWith('Bearer')
      ? req.headers.authorization.split(' ')[1]
      : null;
    
    
    if (sessionId) {
      
      try {
        await UserSession.update(
          { isActive: false },
          { where: { userId: req.user?.id, sessionId } }
        );
      } catch (_) {}
      await deactivateSession(sessionId);
    } else if (req.user?.id && authHeader) {
      
      await UserSession.update(
        { isActive: false },
        { where: { userId: req.user.id, accessToken: authHeader, isActive: true } }
      );
    }
    
    
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (err) {
    
    res.status(500).json({
      status: 'error',
      message: 'Logout failed'
    });
  }
};


exports.validateSession = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({
        status: 'fail',
        message: 'Session ID required'
      });
    }
    
    const session = await UserSession.findOne({
      where: { sessionId, isActive: true },
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'role', 'userType', 'isActive'] }]
    });
    
    if (!session) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired session',
        code: 'SESSION_INVALID'
      });
    }
    
    
    if (session.isIdle(30) || session.isExpired()) {
      await deactivateSession(sessionId);
      return res.status(401).json({
        status: 'fail',
        message: 'Session expired due to inactivity',
        code: 'SESSION_EXPIRED'
      });
    }
    
    
    await session.updateActivity();
    
    res.status(200).json({
      status: 'success',
      data: {
        session: {
          id: session.id,
          sessionId: session.sessionId,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt
        },
        user: session.user
      }
    });
  } catch (err) {
    
    res.status(500).json({
      status: 'error',
      message: 'Session validation failed'
    });
  }
};


exports.updateSessionActivity = async (req, res, next) => {
  try {
    const { sessionId, lastActivity } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required'
      });
    }
    
    const session = await UserSession.findOne({
      where: { sessionId, isActive: true }
    });
    
    if (!session) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired session',
        code: 'SESSION_INVALID'
      });
    }
    
    
    await session.updateActivity();
    
    res.status(200).json({
      status: 'success',
      message: 'Session activity updated',
      data: {
        lastActivity: session.lastActivity
      }
    });
  } catch (err) {
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to update session activity'
    });
  }
};



exports.protect = async (req, res, next) => {
  try {
    
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in! Please log in to get access.'
      });
    }

    
    const decoded = await verifyToken(token, process.env.JWT_SECRET);

    
    const currentUser = await User.findByPk(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'fail',
        message: 'User recently changed password! Please log in again.'
      });
    }

    
    req.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: 'Invalid token or session expired'
    });
  }
};


exports.getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.headers['x-session-id'];
    
    const activeSessions = await UserSession.findUserActiveSessions(userId);
    
    
    const otherSessions = currentSessionId 
      ? activeSessions.filter(session => session.sessionId !== currentSessionId)
      : activeSessions;
    
    res.status(200).json({
      status: 'success',
      data: {
        activeSessions: activeSessions.map(session => ({
          id: session.id,
          sessionId: session.sessionId,
          lastActivity: session.lastActivity,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          deviceInfo: session.deviceInfo,
          isCurrent: session.sessionId === currentSessionId
        })),
        totalSessions: activeSessions.length,
        otherSessions: otherSessions.length
      }
    });
  } catch (err) {
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch active sessions'
    });
  }
};


exports.logoutAllOtherSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.headers['x-session-id'];
    
    if (!currentSessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Current session ID required'
      });
    }
    
    
    const result = await UserSession.deactivateUserSessions(userId, currentSessionId);
    
    devLog(`🔐 Force logged out ${result[0]} other sessions for user ${req.user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: `Successfully logged out from ${result[0]} other sessions`,
      data: {
        deactivatedSessions: result[0]
      }
    });
  } catch (err) {
    console.error('Logout all other sessions error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to logout other sessions'
    });
  }
};


exports.createInitialAdmin = async (req, res, next) => {
  try {
    
    const adminCount = await User.count({ where: { role: 'admin' } });
    
    if (adminCount > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Admin user already exists. Use regular login or contact support.'
      });
    }

    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const setupKey = req.headers['x-setup-key'];
    const validSetupKey = process.env.SETUP_KEY || 'iiftl-setup-2024';
    
    if (!isDevelopment && setupKey !== validSetupKey) {
      return res.status(403).json({
        status: 'fail',
        message: 'Initial admin creation requires proper setup key or development environment'
      });
    }

    
    const hashedPassword = await bcrypt.hash('sunVexpress#0912', 12);
    const adminUser = await User.create({
      firstName: 'IIFTL',
      lastName: 'Administrator',
      email: 'iiftladmin@iiftl.com',
      password: hashedPassword,
      role: 'admin',
      userType: 'corporate',
      isActive: true
    });

    devLog('🎉 Initial admin user created successfully:', adminUser.email);

    res.status(201).json({
      status: 'success',
      message: 'Initial admin user created successfully',
      data: {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          userType: adminUser.userType,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName
        }
      },
      credentials: {
        email: 'iiftladmin@iiftl.com',
        password: 'sunVexpress#0912'
      },
      note: 'Please change the default password after first login'
    });

  } catch (err) {
    console.error('Initial admin creation error:', err);
    
    if (err.message === 'Only one admin user is allowed in the system') {
      return res.status(400).json({
        status: 'fail',
        message: 'Admin user already exists'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to create initial admin user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};