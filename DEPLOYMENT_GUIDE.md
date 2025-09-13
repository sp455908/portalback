# IIFTL Backend Deployment Guide

## CORS Issue Fix

This guide helps you deploy the updated backend with the CORS fix to resolve the frontend communication issues.

## Changes Made

1. **Updated CORS Configuration** in `app.js`:
   - Added comprehensive origin validation
   - Included localhost origins for development
   - Added detailed logging for debugging
   - Enhanced CORS headers for better compatibility

2. **Added CORS Test Script** (`test-cors.js`):
   - Tests CORS configuration against your backend
   - Validates allowed and blocked origins
   - Helps debug CORS issues

## Deployment Steps

### For Render.com Deployment:

1. **Commit and Push Changes**:
   ```bash
   git add .
   git commit -m "Fix CORS configuration for frontend communication"
   git push origin main
   ```

2. **Redeploy on Render**:
   - Go to your Render dashboard
   - Find your backend service
   - Click "Manual Deploy" → "Deploy latest commit"
   - Wait for deployment to complete

3. **Verify Deployment**:
   ```bash
   # Test the CORS configuration
   node test-cors.js https://portalback-8tth.onrender.com
   ```

### For Local Testing:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables**:
   ```bash
   # Copy your .env file with proper DATABASE_URL and JWT_SECRET
   cp .env.example .env
   ```

3. **Start the Server**:
   ```bash
   npm run dev
   ```

4. **Test CORS Locally**:
   ```bash
   node test-cors.js http://localhost:5000
   ```

## Verification

After deployment, test the following:

1. **Frontend Login**: Try logging in at https://iiftl-portal.vercel.app/signin
2. **API Endpoints**: Test these endpoints directly:
   - `https://portalback-8tth.onrender.com/api/auth/me`
   - `https://portalback-8tth.onrender.com/api/captcha/id`
   - `https://portalback-8tth.onrender.com/health`

3. **Browser Console**: Check that CORS errors are resolved

## Troubleshooting

If CORS issues persist:

1. **Check Backend Logs**: Look for CORS-related log messages
2. **Verify Origin**: Ensure the frontend origin matches exactly
3. **Test with curl**:
   ```bash
   curl -H "Origin: https://iiftl-portal.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://portalback-8tth.onrender.com/api/auth/me
   ```

## Expected CORS Headers

After the fix, you should see these headers in successful responses:
- `Access-Control-Allow-Origin: https://iiftl-portal.vercel.app`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, ...`

## Support

If you continue to experience issues:
1. Check the backend logs for CORS-related messages
2. Verify the frontend is making requests to the correct backend URL
3. Ensure the backend is properly deployed and accessible