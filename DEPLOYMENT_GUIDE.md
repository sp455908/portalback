# Backend Deployment Guide

## Issue
The student batch routes are returning 403 errors because the backend changes haven't been deployed to Vercel yet.

## Current Error
```
Forbidden: insufficient permissions, userRole: 'student', allowedRoles: Array(1)
```

## Solution
Deploy the updated backend code to Vercel.

## Deployment Steps

### Option 1: Using Vercel CLI
```bash
# Navigate to backend directory
cd "IIFTL Backend"

# Deploy to production
vercel --prod
```

### Option 2: Using Git (if connected to Vercel)
```bash
# Add all changes
git add .

# Commit changes
git commit -m "Fix batch routes authorization for students"

# Push to trigger deployment
git push origin main
```

### Option 3: Manual Deployment
1. Go to Vercel Dashboard
2. Select your backend project
3. Go to Deployments tab
4. Click "Redeploy" on the latest deployment

## What's Fixed
- Updated batch routes to allow `student`, `corporate`, and `government` roles
- Added proper authorization for student batch access
- Fixed 403 errors for student batch requests

## Verification
After deployment, test:
1. Student login
2. Access to `/dashboard/studentpractisetest`
3. Batch information should load without 403 errors

## Temporary Frontend Solution
The frontend has been updated to show fallback tests when batch data fails to load, so students can still access practice tests while the backend is being updated. 