// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    // Log slow requests (over 1 second)
    if (duration > 1000) {
      console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms`);
    }
    
    // Log very slow requests (over 5 seconds)
    if (duration > 5000) {
      console.error(`🚨 VERY SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms`);
    }
    
    // Add performance header
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = performanceMonitor; 