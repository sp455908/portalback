const jwt = require('jsonwebtoken');
const { User } = require('../models');

exports.protect = async (req, res, next) => {
  console.log('🔐 Auth middleware called for:', req.url);
  console.log('🔐 Headers:', req.headers.authorization ? 'Bearer token present' : 'No auth header');
  console.log('🔐 Full authorization header:', req.headers.authorization);
  console.log('🔐 All headers:', Object.keys(req.headers));
  
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    console.log('🔐 Token extracted, length:', token.length);
    console.log('🔐 Token preview:', token.substring(0, 50) + '...');
    console.log('🔐 Token ends with:', token.substring(token.length - 20));
    console.log('🔐 Token contains spaces:', token.includes(' '));
    console.log('🔐 Token contains newlines:', token.includes('\n'));
  }
  
  if (!token) {
    console.log('❌ No token provided for:', req.url);
    return res.status(401).json({ 
      status: 'fail',
      message: 'Not authorized - No token provided' 
    });
  }

  try {
    console.log('🔐 Verifying JWT token...');
    console.log('🔐 JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('🔐 JWT_SECRET length:', process.env.JWT_SECRET?.length);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 Token verified, decoded payload:', { 
      id: decoded.id, 
      exp: decoded.exp,
      iat: decoded.iat,
      fullPayload: decoded
    });
    console.log('🔐 Token expiration check:', new Date(decoded.exp * 1000));
    console.log('🔐 Current time:', new Date());
    console.log('🔐 Token expired:', Date.now() > decoded.exp * 1000);
    
    // Find user using Sequelize (PostgreSQL)
    console.log('🔐 Looking up user with ID:', decoded.id);
    console.log('🔐 User ID type:', typeof decoded.id);
    
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      console.log('❌ User not found with ID:', decoded.id);
      console.log('❌ Attempting to find user with different methods...');
      
      // Try to find user by email if available
      if (decoded.email) {
        const userByEmail = await User.findOne({ where: { email: decoded.email } });
        if (userByEmail) {
          console.log('🔍 Found user by email:', userByEmail.id);
        }
      }
      
      return res.status(401).json({ 
        status: 'fail',
        message: 'User not found' 
      });
    }
    
    console.log('🔐 User found:', { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      userType: user.userType,
      isActive: user.isActive
    });
    
    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User account is disabled:', user.id);
      return res.status(403).json({ 
        status: 'fail',
        message: 'Account is disabled' 
      });
    }
    
    // Attach user to request
    req.user = user;
    
    console.log('✅ Auth middleware - user authenticated successfully:', { 
      userId: user.id, 
      userRole: user.role,
      userType: user.userType,
      url: req.url 
    });
    
    next();
  } catch (err) {
    console.error('❌ Auth middleware - token verification failed:', err);
    console.error('❌ Error name:', err.name);
    console.error('❌ Error message:', err.message);
    console.error('❌ Error stack:', err.stack);
    
    if (err.name === 'TokenExpiredError') {
      console.log('❌ Token expired error');
      return res.status(401).json({ 
        status: 'fail',
        message: 'Token expired' 
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      console.log('❌ Invalid JWT token error');
      return res.status(401).json({ 
        status: 'fail',
        message: 'Invalid token' 
      });
    }
    
    console.log('❌ Unknown token verification error');
    res.status(401).json({ 
      status: 'fail',
      message: 'Token verification failed' 
    });
  }
};