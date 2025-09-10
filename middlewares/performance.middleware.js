// Performance monitoring middleware (non-intrusive)
const performanceMonitor = (req, res, next) => {
  const start = Date.now();

  // Safely inject header before headers are sent by wrapping writeHead
  const originalWriteHead = res.writeHead;
  res.writeHead = function(statusCode, reasonPhrase, headers) {
    try {
      if (!res.headersSent && !res.getHeader('X-Response-Time')) {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}ms`);
      }
    } catch (_) {
      // noop - avoid any header errors
    }
    return originalWriteHead.apply(this, arguments);
  };

  // Log on finish; do not modify headers here
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 5000) {
      console.error(`🚨 VERY SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    } else if (duration > 1000) {
      console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });

  next();
};

module.exports = performanceMonitor; 