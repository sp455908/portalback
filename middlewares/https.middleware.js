// ✅ ADD: HTTPS enforcement middleware
const httpsRedirect = (req, res, next) => {
  // Only redirect in production
  if (process.env.NODE_ENV === 'production') {
    // Check if request is HTTP
    if (req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      return res.redirect(301, httpsUrl);
    }
  }
  next();
};

// ✅ ADD: Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // ✅ FIX: Allow frontend to embed backend while maintaining security
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // ✅ ADD: Cache control for sensitive pages
  if (req.path.includes('/signin') || req.path.includes('/signup') || req.path.includes('/dashboard')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // ✅ ADD: Content Security Policy for additional protection
  // Allow frontend to embed backend
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://iiftl-portal.vercel.app");
  
  // Strict Transport Security (HSTS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

module.exports = {
  httpsRedirect,
  securityHeaders
};
