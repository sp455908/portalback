# Authentication Fix Guide

## Issue Summary
The frontend was unable to receive authentication tokens after login attempts, showing errors like:
- "No stored auth data found"
- "No token found in cookies after login"
- "Authentication token not received. Please try again."

## Root Cause
The issue was with cookie settings in the authentication controller. The cookies were being set with `sameSite: 'none'` and `secure: true` in production, but there were potential CORS issues preventing proper cookie handling.

## Changes Made

### 1. Fixed Cookie Settings in `controllers/auth.controller.js`
- Updated cookie settings to use `sameSite: 'lax'` in development and `sameSite: 'none'` in production
- Added proper domain handling
- Added debugging logs to track cookie setting

### 2. Enhanced CORS Configuration in `app.js`
- Added detailed logging for login requests
- Improved CORS headers for better cookie support
- Added debugging for cookie-related headers

### 3. Added Test Endpoint
- Created `/api/auth/test-cookies` endpoint to verify cookie setting
- Helps debug cookie issues in production

## Deployment Steps

### 1. Deploy Backend Changes
```bash
cd "IIFTL Backend"
git add .
git commit -m "Fix authentication cookie settings and CORS configuration"
git push origin main
```

### 2. Redeploy on Render
- Go to Render dashboard
- Find your backend service
- Click "Manual Deploy" → "Deploy latest commit"

### 3. Test the Fix

#### Test Cookie Setting
```bash
curl -H "Origin: https://iiftl-portal.vercel.app" \
     -H "Content-Type: application/json" \
     -c cookies.txt \
     https://portalback-8tth.onrender.com/api/auth/test-cookies
```

#### Test Login
```bash
curl -X POST \
     -H "Origin: https://iiftl-portal.vercel.app" \
     -H "Content-Type: application/json" \
     -c cookies.txt \
     -d '{"email":"your-email@example.com","password":"your-password"}' \
     https://portalback-8tth.onrender.com/api/auth/login
```

### 4. Verify Frontend
1. Visit https://iiftl-portal.vercel.app/signin
2. Try logging in with valid credentials
3. Check browser developer tools:
   - Network tab: Look for successful login response
   - Application tab: Check if cookies are being set
   - Console: Should not show authentication errors

## Expected Results

After deployment, you should see:
- ✅ Successful login without authentication errors
- ✅ Cookies being set properly in the browser
- ✅ No "No token found in cookies" errors
- ✅ Proper session management

## Debugging

If issues persist:

1. **Check Backend Logs**: Look for cookie setting logs
2. **Test Cookie Endpoint**: Visit `/api/auth/test-cookies` directly
3. **Check CORS Headers**: Verify `Access-Control-Allow-Credentials: true`
4. **Browser Console**: Check for CORS or cookie-related errors

## Cookie Settings Explained

- `httpOnly: true` - Prevents JavaScript access (security)
- `secure: true` - Only sent over HTTPS in production
- `sameSite: 'none'` - Allows cross-site requests (production)
- `sameSite: 'lax'` - More restrictive, works for same-site (development)
- `maxAge` - Cookie expiration time

## Support

If authentication still fails:
1. Check that the backend is properly deployed
2. Verify CORS configuration is working
3. Test with the provided curl commands
4. Check browser developer tools for specific error messages