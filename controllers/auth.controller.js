const { User } = require('../models');
// D:\IIFTL Backend\controllers\auth.controller.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { promisify } = require('util');
const crypto = require('crypto');

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
const createSendToken = (user, statusCode, res) => {
  const accessToken = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  
  // Remove password from output
  user.password = undefined;

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
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    data: {
      user
    }
  });
};

// Register a new user
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, userType, phone, address } = req.body;

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

    // Check single admin rule
    if (role === 'admin') {
      const adminCount = await User.count({ where: { role: 'admin' } });
      if (adminCount > 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Only one admin user is allowed in the system. Admin user already exists.'
        });
      }
    }

    // 1) Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }

    // 2) Create new user
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      userType,
      phone,
      address
    });

    // 3) Log user in, send JWT
    createSendToken(newUser, 201, res);

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

    // 1) Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
    }

    // 2) Check if user exists && password is correct
    const user = await User.findOne({ where: { email } });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect email or password'
      });
    }

    // 3) Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        status: 'fail',
        message: 'Your account has been disabled. Please contact an administrator.'
      });
    }

    // 3) If everything ok, send token to client
    createSendToken(user, 200, res);

  } catch (err) {
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
    // Clear refresh token cookie
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