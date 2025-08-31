// Middleware for role-based access control

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    console.log('Role middleware called with allowed roles:', allowedRoles);
    console.log('User object:', req.user ? { id: req.user.id, role: req.user.role, roles: req.user.roles } : 'No user');
    
    if (!req.user) {
      console.log('No user object found');
      return res.status(401).json({ 
        message: "Unauthorized: No user object found"
      });
    }
    
    // Handle both role (string) and roles (array) cases
    let userRole = req.user.role;
    if (!userRole && req.user.roles && Array.isArray(req.user.roles)) {
      userRole = req.user.roles[0]; // Use first role if roles is an array
    }
    
    console.log('User role determined:', userRole);
    
    if (!userRole) {
      console.log('No user role found');
      return res.status(403).json({ 
        message: "Forbidden: User has no role defined"
      });
    }
    
    if (!allowedRoles.includes(userRole)) {
      console.log('User role not in allowed roles:', userRole, 'not in', allowedRoles);
      return res.status(403).json({ 
        message: "Forbidden: insufficient permissions"
      });
    }
    
    console.log('Role check passed, proceeding');
    next();
  };
};