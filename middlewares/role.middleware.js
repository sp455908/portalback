// Middleware for role-based access control

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: "Unauthorized: No user object found"
      });
    }
    
    if (!req.user.role) {
      return res.status(403).json({ 
        message: "Forbidden: User has no role defined"
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Forbidden: insufficient permissions"
      });
    }
    
    next();
  };
};