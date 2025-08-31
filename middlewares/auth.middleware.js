const jwt = require('jsonwebtoken');
const { User } = require('../models');

exports.protect = async (req, res, next) => {
  console.log('Auth middleware called');
  console.log('Authorization header:', req.headers.authorization);
  
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extracted:', token ? 'Present' : 'Missing');
  }
  
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