const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 * Implements Double Submit Cookie pattern for CSRF protection
 */
class CSRFProtection {
  constructor() {
    this.secret = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-secret-change-in-production';
    this.tokenLength = 32;
    this.cookieName = 'csrf-token';
    this.headerName = 'x-csrf-token';
  }

  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken() {
    return crypto.randomBytes(this.tokenLength).toString('hex');
  }

  /**
   * Create a signed token using HMAC
   */
  signToken(token) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(token)
      .digest('hex');
  }

  /**
   * Verify a signed token
   */
  verifyToken(token, signature) {
    const expectedSignature = this.signToken(token);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Middleware to generate and set CSRF token
   */
  generateTokenMiddleware() {
    return (req, res, next) => {
      // Skip CSRF for safe methods and public endpoints
      if (this.isSafeMethod(req.method) || this.isPublicEndpoint(req.path)) {
        return next();
      }

      // Generate new token
      const token = this.generateToken();
      const signature = this.signToken(token);
      const signedToken = `${token}.${signature}`;

      // Set HTTP-only cookie with signed token
      res.cookie(this.cookieName, signedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        domain: process.env.NODE_ENV === 'production' ? undefined : undefined
      });

      // Also send token in response header for frontend to read
      res.setHeader('X-CSRF-Token', token);

      req.csrfToken = token;
      next();
    };
  }

  /**
   * Middleware to verify CSRF token
   */
  verifyTokenMiddleware() {
    return (req, res, next) => {
      // Skip CSRF for safe methods and public endpoints
      if (this.isSafeMethod(req.method) || this.isPublicEndpoint(req.path)) {
        return next();
      }

      // Get token from header
      const headerToken = req.headers[this.headerName];
      if (!headerToken) {
        return res.status(403).json({
          status: 'fail',
          message: 'CSRF token missing from request header',
          code: 'CSRF_TOKEN_MISSING'
        });
      }

      // Get signed token from cookie
      const cookieToken = req.cookies[this.cookieName];
      if (!cookieToken) {
        return res.status(403).json({
          status: 'fail',
          message: 'CSRF token missing from cookie',
          code: 'CSRF_COOKIE_MISSING'
        });
      }

      // Parse signed token
      const [token, signature] = cookieToken.split('.');
      if (!token || !signature) {
        return res.status(403).json({
          status: 'fail',
          message: 'Invalid CSRF token format',
          code: 'CSRF_TOKEN_INVALID'
        });
      }

      // Verify tokens match
      if (token !== headerToken) {
        return res.status(403).json({
          status: 'fail',
          message: 'CSRF token mismatch',
          code: 'CSRF_TOKEN_MISMATCH'
        });
      }

      // Verify signature
      if (!this.verifyToken(token, signature)) {
        return res.status(403).json({
          status: 'fail',
          message: 'CSRF token signature invalid',
          code: 'CSRF_SIGNATURE_INVALID'
        });
      }

      next();
    };
  }

  /**
   * Check if HTTP method is safe (doesn't modify data)
   */
  isSafeMethod(method) {
    return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }

  /**
   * Check if endpoint is public (doesn't require CSRF protection)
   */
  isPublicEndpoint(path) {
    const publicPaths = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/security/public-key'
    ];
    
    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  /**
   * Get CSRF token for frontend
   */
  getToken(req) {
    return req.csrfToken;
  }
}

const csrfProtection = new CSRFProtection();

module.exports = {
  csrfProtection,
  generateCSRFToken: csrfProtection.generateTokenMiddleware(),
  verifyCSRFToken: csrfProtection.verifyTokenMiddleware(),
  getCSRFToken: csrfProtection.getToken.bind(csrfProtection)
};