const { User, LoginAttempt, UserSession } = require('../models');
// D:\IIFTL Backend\controllers\auth.controller.js
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

// Promisify jwt.verify
const verifyToken = promisify(jwt.verify);

// Helper to sign JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d' // Default to 7 days if not set
  });
};

// Helper to sign refresh token
const signRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: '30d' // Refresh token valid for 30 days
  });
};

// Create and send token with refresh token
const createSendToken = async (user, statusCode, res, req = null, extraMeta = {}) => {
  const accessToken = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  
  // Remove password from output
  user.password = undefined;

  // Create session if request object is provided
  let session = null;
  if (req) {
    try {
      session = await createSession(user, req);
      // Update session with tokens
      await session.update({
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Error creating session:', error);
      // Continue without session if creation fails
    }
  }

  // Set refresh token as HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.status(statusCode).json({
    status: 'success',
    token: accessToken,
    refreshToken: refreshToken,
    sessionId: session ? session.sessionId : null,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    sessionTimeout: SESSION_TIMEOUT_MINUTES * 60, // in seconds
    meta: extraMeta,
    data: {
      user
    }
  });
};

// Register a new user
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, userType, phone, address, city, state, pincode } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;

    if (!role || !userType) {
      return res.status(400).json({
        status: 'fail',
        message: 'Role and userType are required.'
      });
    }

    // Validate userType
    const validUserTypes = ['student', 'corporate', 'government'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid userType. Must be student, corporate, or government.'
      });
    }

    // OPTIMIZED: Single query to check both admin count and existing user
    const [adminCount, existingUser] = await Promise.all([
      role === 'admin' ? User.count({ where: { role: 'admin' } }) : Promise.resolve(0),
      User.findOne({ where: { email: normalizedEmail } })
    ]);

    // Cache admin count for future use
    if (role === 'admin') {
      adminCountCache.set('admin_count', adminCount, 5 * 60 * 1000); // 5 minutes
    }

    // Check single admin rule
    if (role === 'admin' && adminCount > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Only one admin user is allowed in the system. Admin user already exists.'
      });
    }

    // Check if user already exists
    if (existingUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }

    // Create new user (retry once on studentId collision)
    let newUser;
    try {
      newUser = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        password,
        role,
        userType,
        phone,
        address,
        city,
        state,
        pincode
      });
    } catch (createErr) {
      if (createErr.name === 'SequelizeUniqueConstraintError' && createErr?.fields?.studentId) {
        // Retry create once in case two requests raced for the same sequence
        newUser = await User.create({
          firstName,
          lastName,
          email: normalizedEmail,
          password,
          role,
          userType,
          phone,
          address,
          city,
          state,
          pincode
        });
      } else {
        throw createErr;
      }
    }

    // Log user in, send JWT
    await createSendToken(newUser, 201, res, req);

  } catch (err) {
    console.error('Registration error:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        status: 'fail',
        message: messages.join('. ')
      });
    }
    
    // Handle Sequelize validation errors
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(val => val.message);
      return res.status(400).json({
        status: 'fail',
        message: messages.join('. ')
      });
    }
    
    // Handle unique constraint violations
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }
    
    // Handle single admin rule violation
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

// Login user
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

    // 1) Check if user exists && password is correct
    const user = await User.findOne({ where: { email } });
    
    // Cache user data for future use
    if (user) {
      userCache.set(`user_${user.id}`, {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }, 2 * 60 * 1000); // 2 minutes
    }
    
    if (!user || !(await user.comparePassword(password))) {
      // Record failed login attempt and check blocking
      if (user) {
        console.log(`🔐 Failed login attempt for user: ${user.email} (ID: ${user.id})`);
        
        const loginResult = await LoginAttempt.processLoginAttempt({
          userId: user.id,
          email,
          ipAddress,
          userAgent,
          success: false
        });

        console.log(`📊 Login result:`, loginResult);

        // Check if user should be blocked (5 failed attempts in 15 minutes)
        if (loginResult.shouldBlock && user.role !== 'admin') {
          console.log(`🚫 Blocking user ${user.email} after ${loginResult.failedCount} failed attempts`);
          
          // Block the user permanently (no time limit)
          const blockedUntil = await LoginAttempt.manuallyBlockUser(user.id, email, 'Multiple failed login attempts - Account blocked for security', null);
          
          // Set user as inactive when blocked
          await user.update({ isActive: false });
          
          console.log(`✅ User ${user.email} blocked successfully and marked as inactive`);
          
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
          console.log(`⚠️ User ${user.email} has ${loginResult.failedCount || 0} failed attempts, not blocked yet`);
        }
      }

      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect email or password'
      });
    }

    // 2) Get all blocking status in single query
    const loginStatus = await LoginAttempt.getLoginStatus(user.id, email);
    
    // Check if user or email is currently blocked
    if (loginStatus.isUserBlocked || loginStatus.isEmailBlocked) {
      // Record this failed attempt
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

    // 3) Check if user is active
    if (!user.isActive) {
      // Record failed login attempt
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

    // 4) Check other active sessions and cleanup expired/idle
    let otherActiveSessions = [];
    try {
      const existingSessions = await UserSession.findUserActiveSessions(user.id);
      const now = Date.now();
      const validSessions = [];
      for (const s of existingSessions) {
        const isIdle = s.isIdle(30);
        const isExpired = s.isExpired();
        if (isIdle || isExpired) {
          await UserSession.update({ isActive: false }, { where: { sessionId: s.sessionId } });
        } else {
          validSessions.push(s);
        }
      }
      otherActiveSessions = validSessions;
      // Strict single-session enforcement for all users: block new login if any active session exists
      if (validSessions.length > 0) {
        console.log(`🚫 Admin login blocked due to existing active session(s): ${validSessions.length} for ${user.email}`);
        return res.status(409).json({
          status: 'fail',
          message: 'You are already logged in on another device. Please logout there first.',
          code: 'SESSION_ALREADY_ACTIVE',
          failedAttempt: false,
          shouldCountFailedAttempt: false,
          data: {
            activeSessions: validSessions.map(s => ({
              lastActivity: s.lastActivity,
              ipAddress: s.ipAddress,
              userAgent: s.userAgent
            })),
            count: validSessions.length
          }
        });
      }
    } catch (sessionError) {
      console.error('Active session lookup/cleanup failed (continuing):', sessionError);
    }

    // 5) Record successful login attempt
    await LoginAttempt.create({
      userId: user.id,
      email,
      ipAddress,
      userAgent,
      success: true,
      attemptTime: new Date()
    });

    // 6) No auto-deactivation on login; user must logout to free the session

    // 7) If everything ok, send token to client with session conflict meta (for alert)
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
    console.error('Login error:', err);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? err : undefined
    });
  }
};

// Get current authenticated user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user profile'
    });
  }
};

// Refresh access token using refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(401).json({
        status: 'fail',
        message: 'No refresh token provided'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token type'
      });
    }

    // Check if user still exists
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found or inactive'
      });
    }

    // Generate new access token
    const newAccessToken = signToken(user.id);
    
    // Remove password from output
    user.password = undefined;

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

// Logout user (invalidate refresh token)
exports.logout = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    // Deactivate session if sessionId is provided
    if (sessionId) {
      await deactivateSession(sessionId);
    }
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Logout failed'
    });
  }
};

// Validate session endpoint
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
      include: [{ model: User, attributes: ['id', 'email', 'role', 'userType', 'isActive'] }]
    });
    
    if (!session) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired session',
        code: 'SESSION_INVALID'
      });
    }
    
    // Check if session is idle or expired
    if (session.isIdle(30) || session.isExpired()) {
      await deactivateSession(sessionId);
      return res.status(401).json({
        status: 'fail',
        message: 'Session expired due to inactivity',
        code: 'SESSION_EXPIRED'
      });
    }
    
    // Update last activity
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
    console.error('Session validation error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Session validation failed'
    });
  }
};

// Protect middleware (already in auth.middleware.js)
// This is just for reference of what it does
exports.protect = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
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

    // 2) Verification token
    const decoded = await verifyToken(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findByPk(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'fail',
        message: 'User recently changed password! Please log in again.'
      });
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: 'Invalid token or session expired'
    });
  }
};

// Get active sessions for current user
exports.getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.headers['x-session-id'];
    
    const activeSessions = await UserSession.findUserActiveSessions(userId);
    
    // Filter out current session
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
    console.error('Get active sessions error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch active sessions'
    });
  }
};

// Force logout from all other sessions
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
    
    // Deactivate all other sessions for this user
    const result = await UserSession.deactivateUserSessions(userId, currentSessionId);
    
    console.log(`🔐 Force logged out ${result[0]} other sessions for user ${req.user.email}`);
    
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

// Temporary admin creation endpoint for initial setup (Render deployment)
exports.createInitialAdmin = async (req, res, next) => {
  try {
    // Check if admin user already exists
    const adminCount = await User.count({ where: { role: 'admin' } });
    
    if (adminCount > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Admin user already exists. Use regular login or contact support.'
      });
    }

    // Check if this is a development environment or if a special setup key is provided
    const isDevelopment = process.env.NODE_ENV === 'development';
    const setupKey = req.headers['x-setup-key'];
    const validSetupKey = process.env.SETUP_KEY || 'iiftl-setup-2024';
    
    if (!isDevelopment && setupKey !== validSetupKey) {
      return res.status(403).json({
        status: 'fail',
        message: 'Initial admin creation requires proper setup key or development environment'
      });
    }

    // Create the admin user
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

    console.log('🎉 Initial admin user created successfully:', adminUser.email);

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