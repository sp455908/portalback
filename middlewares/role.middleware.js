// Middleware for role-based access control

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    console.log('🔐 Role Middleware called for:', req.url);
    console.log('🔐 User object:', req.user);
    console.log('🔐 User role:', req.user?.role);
    console.log('🔐 User type:', req.user?.userType);
    console.log('🔐 Allowed roles:', allowedRoles);
    console.log('🔐 Request method:', req.method);
    
    if (!req.user) {
      console.log('❌ No user object found in request');
      return res.status(401).json({ 
        message: "Unauthorized: No user object found",
        url: req.url,
        method: req.method
      });
    }
    
    if (!req.user.role) {
      console.log('❌ User has no role defined');
      return res.status(403).json({ 
        message: "Forbidden: User has no role defined",
        user: req.user,
        allowedRoles: allowedRoles,
        url: req.url,
        method: req.method
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ Access denied - insufficient permissions');
      console.log('❌ User role:', req.user.role);
      console.log('❌ Allowed roles:', allowedRoles);
      return res.status(403).json({ 
        message: "Forbidden: insufficient permissions",
        userRole: req.user.role,
        allowedRoles: allowedRoles,
        url: req.url,
        method: req.method
      });
    }
    
    console.log('✅ Access granted for role:', req.user.role);
    next();
  };
};