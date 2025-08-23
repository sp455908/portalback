# Session Management Setup Guide

## Overview
This guide explains how to set up and configure the comprehensive session management system for the IIFTL Backend.

## ✅ What's Been Implemented

### 1. Session Management Middleware (`middlewares/session.middleware.js`)
- **Session Configuration**: MongoDB-based session storage with `connect-mongo`
- **CSRF Protection**: Token generation, validation, and refresh
- **Session Security**: Prevention of session fixation, activity tracking, timeout management
- **Session Monitoring**: Event logging and statistics

### 2. Security Features
- **CSRF Tokens**: Automatically generated and validated for all POST/PUT/DELETE requests
- **Session Timeout**: Automatic session expiration after 30 minutes of inactivity
- **IP Tracking**: Session activity tracking with IP address and user agent
- **Secure Cookies**: HTTP-only, secure, SameSite=Strict cookies

### 3. Frontend Integration
- **CSRF Token Handling**: Automatic token inclusion in requests
- **Token Refresh**: Automatic CSRF token refresh on validation failures
- **Session Management**: Proper handling of session timeouts and errors

## 🔧 Required Environment Variables

Add these to your `.env` file:

```bash
# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-in-production
SESSION_MAX_AGE=86400000

# Security Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://iiftl-frontend.vercel.app,https://exim-portal-guardian.vercel.app

# JWT Configuration (existing)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7
```

## 📦 Dependencies Installed

```bash
npm install express-session connect-mongo
```

## 🚀 How It Works

### 1. Session Creation
- Sessions are created automatically when users visit the site
- CSRF tokens are generated for each session
- Session data is stored in MongoDB with encryption

### 2. CSRF Protection
- All non-GET requests require valid CSRF tokens
- Tokens are included in `X-CSRF-Token` header
- Tokens are refreshed after each successful validation

### 3. Security Features
- **Session Fixation Prevention**: New sessions get new IDs
- **Activity Tracking**: Monitors user activity and IP changes
- **Timeout Management**: Automatic session cleanup
- **Input Validation**: XSS and injection protection

## 🔒 Security Endpoints

### Admin-Only Security Routes
- `GET /api/security/events` - View security events
- `GET /api/security/report` - Generate security reports
- `GET /api/security/stats` - View security statistics
- `GET /api/security/config` - View security configuration
- `POST /api/security/test-csrf` - Test CSRF protection
- `POST /api/security/test-xss` - Test XSS protection
- `POST /api/security/cleanup` - Clean up old events

### Public Security Endpoints
- `GET /api/auth/csrf-refresh` - Refresh CSRF token

## 🧪 Testing the Setup

### 1. Test CSRF Protection
```bash
# This should fail without CSRF token
curl -X POST "https://your-domain.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Expected response: 403 CSRF token validation failed
```

### 2. Test Session Creation
```bash
# This should create a session and return CSRF token
curl -c cookies.txt "https://your-domain.com/api/health"
```

### 3. Test with CSRF Token
```bash
# Use the token from the previous response
curl -X POST "https://your-domain.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -b cookies.txt \
  -d '{"email":"test@example.com","password":"password"}'
```

## 🐛 Troubleshooting

### Common Issues

1. **CSRF Token Validation Failed**
   - Check if session middleware is loaded before routes
   - Verify CSRF token is being sent in headers
   - Check if session is being created properly

2. **Session Not Persisting**
   - Verify MongoDB connection
   - Check SESSION_SECRET environment variable
   - Ensure cookies are being set properly

3. **Frontend CSRF Errors**
   - Check if CSRF token meta tag exists
   - Verify axios configuration includes CSRF headers
   - Check browser console for token-related errors

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

## 📊 Monitoring

### Session Statistics
- Total active sessions
- Failed authentication attempts
- Blocked IP addresses
- Security event counts

### Security Events
- Login attempts (successful/failed)
- Suspicious input detection
- CSRF validation failures
- Session timeouts

## 🔄 Maintenance

### Automatic Cleanup
- Old sessions are automatically removed after 24 hours
- Security events older than 7 days are cleaned up
- Failed login attempts are reset after 30 minutes

### Manual Cleanup
```bash
# Clean up events older than 7 days (admin only)
POST /api/security/cleanup
Content-Type: application/json
X-CSRF-Token: YOUR_TOKEN

{
  "days": 7
}
```

## 🚨 Security Best Practices

1. **Change Default Secrets**: Always change SESSION_SECRET and JWT_SECRET
2. **Use HTTPS**: Sessions should only work over HTTPS in production
3. **Monitor Logs**: Regularly check security event logs
4. **Regular Updates**: Keep dependencies updated for security patches
5. **Access Control**: Limit admin security routes to authorized users only

## 📝 API Documentation

For detailed API documentation, see the individual route files:
- `routes/auth.routes.js` - Authentication endpoints
- `routes/security.routes.js` - Security monitoring endpoints
- `middlewares/session.middleware.js` - Session management
- `utils/securityMonitor.js` - Security monitoring utilities 