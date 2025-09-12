/**
 * Security logging middleware
 * Logs security-relevant events for monitoring
 */

const securityLogging = (req, res, next) => {
  const originalSend = res.send;
  
  // Log security events
  res.send = function(data) {
    // Log failed authentication attempts
    if (res.statusCode === 401) {
      console.warn(`[SECURITY] Authentication failed:`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log authorization failures
    if (res.statusCode === 403) {
      console.warn(`[SECURITY] Authorization failed:`, {
        ip: req.ip,
        userId: req.user?.id,
        userRole: req.user?.role,
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log rate limit violations
    if (res.statusCode === 429) {
      console.warn(`[SECURITY] Rate limit exceeded:`, {
        ip: req.ip,
        userId: req.user?.id,
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log practice test access attempts
    if (req.originalUrl.includes('/practice-tests/') && req.method === 'GET') {
      console.info(`[AUDIT] Practice test access:`, {
        ip: req.ip,
        userId: req.user?.id,
        userRole: req.user?.role,
        endpoint: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log test submission attempts
    if (req.originalUrl.includes('/submit') && req.method === 'POST') {
      console.info(`[AUDIT] Test submission:`, {
        ip: req.ip,
        userId: req.user?.id,
        userRole: req.user?.role,
        testAttemptId: req.params.testAttemptId,
        timestamp: new Date().toISOString()
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  securityLogging
};