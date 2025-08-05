// Middleware for role-based access control

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    console.log('Role Middleware:', { 
      user: req.user, 
      userRole: req.user?.role,
      allowedRoles,
      url: req.url,
      method: req.method
    });
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      console.log('Access denied:', { 
        userRole: req.user?.role, 
        allowedRoles,
        user: req.user,
        url: req.url,
        method: req.method
      });
      return res.status(403).json({ 
        message: "Forbidden: insufficient permissions",
        userRole: req.user?.role,
        allowedRoles: allowedRoles
      });
    }
    console.log('Access granted for role:', req.user.role);
    next();
  };
};