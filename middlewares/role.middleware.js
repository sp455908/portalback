// Middleware for role-based access control

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('Role middleware - No user object found:', {
        path: req.path,
        method: req.method,
        headers: req.headers
      });
      return res.status(401).json({ 
        message: "Unauthorized: No user object found"
      });
    }
    
    // Handle both role (string) and roles (array) cases
    let userRole = req.user.role;
    if (!userRole && req.user.roles && Array.isArray(req.user.roles)) {
      userRole = req.user.roles[0]; // Use first role if roles is an array
    }
    
    if (!userRole) {
      return res.status(403).json({ 
        message: "Forbidden: User has no role defined"
      });
    }
    
    // Owner (superadmin) bypass: if request is marked as owner, allow
    if (req.user && req.user.isOwner === true) {
      return next();
    }

    // Check if user role is in allowed roles
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: "Forbidden: insufficient permissions"
      });
    }
    
    next();
  };
};