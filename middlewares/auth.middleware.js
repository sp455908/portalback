const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    console.log('Auth middleware - user authenticated:', { 
      userId: req.user?._id, 
      userRole: req.user?.role,
      userType: req.user?.userType,
      url: req.url 
    });
    next();
  } catch (err) {
    console.error('Auth middleware - token verification failed:', err);
    res.status(401).json({ message: 'Token failed' });
  }
};