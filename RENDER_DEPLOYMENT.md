# IIFTL Backend - Render Deployment Guide

This guide will help you deploy the IIFTL Backend to Render and set up the initial admin user.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **PostgreSQL Database**: You'll need a PostgreSQL database (Render provides this)
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, etc.)

## Step 1: Create PostgreSQL Database on Render

1. Go to your Render dashboard
2. Click "New +" and select "PostgreSQL"
3. Configure your database:
   - **Name**: `iiftl-database` (or your preferred name)
   - **Database**: `iiftl_db`
   - **User**: `iiftl_user`
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 15 or higher
4. Click "Create Database"
5. **Important**: Note down the connection details (you'll need them later)

## Step 2: Deploy Your Backend

1. In your Render dashboard, click "New +" and select "Web Service"
2. Connect your Git repository
3. Configure the service:
   - **Name**: `iiftl-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Choose based on your needs (Free tier works for testing)

## Step 3: Set Environment Variables

In your web service settings, add these environment variables:

```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-here-must-be-at-least-32-characters-long
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=your-session-secret-key-here
SETUP_KEY=iiftl-setup-2024
```

**Important Notes:**
- Replace `DATABASE_URL` with the actual connection string from your PostgreSQL service
- Generate a strong `JWT_SECRET` (at least 32 characters)
- Update `ALLOWED_ORIGINS` with your actual frontend domain
- The `SETUP_KEY` is used for initial admin creation

## Step 4: Deploy and Wait

1. Click "Create Web Service"
2. Wait for the build and deployment to complete
3. Note your service URL (e.g., `https://your-app-name.onrender.com`)

## Step 5: Set Up Initial Admin User

After deployment, you need to create the initial admin user. You have two options:

### Option A: Use the Setup Endpoint (Recommended)

Make a POST request to create the admin user:

```bash
curl -X POST https://your-app-name.onrender.com/api/auth/create-initial-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: iiftl-setup-2024"
```

### Option B: Run the Setup Script

If you have access to the Render shell:

1. Go to your web service in Render dashboard
2. Click on "Shell" tab
3. Run the setup script:

```bash
cd /opt/render/project/src
node scripts/setupAdminForRender.js
```

## Step 6: Test Admin Login

Once the admin user is created, test the login:

```bash
curl -X POST https://your-app-name.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "iiftladmin@iiftl.com",
    "password": "sunVexpress#0912"
  }'
```

You should receive a JWT token if successful.

## Step 7: Update Frontend Configuration

Update your frontend application to use the new backend URL:

```javascript
// Replace localhost:5000 with your Render URL
const API_BASE_URL = 'https://your-app-name.onrender.com/api';
```

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `production` |
| `PORT` | Port for the server | Yes | `10000` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | Secret for JWT tokens | Yes | `your-32-char-secret-here` |
| `JWT_EXPIRES_IN` | JWT token expiration | No | `7d` |
| `ALLOWED_ORIGINS` | CORS allowed origins | Yes | `https://yourdomain.com` |
| `SETUP_KEY` | Key for initial admin setup | Yes | `iiftl-setup-2024` |

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check your `DATABASE_URL` format
   - Ensure database is running
   - Verify network access

2. **Admin User Creation Failed**
   - Check if admin already exists
   - Verify `SETUP_KEY` is correct
   - Check database permissions

3. **Login Fails**
   - Ensure admin user was created
   - Check password is correct
   - Verify JWT_SECRET is set

4. **CORS Errors**
   - Update `ALLOWED_ORIGINS` with your frontend domain
   - Restart the service after changing environment variables

### Getting Help

- Check Render logs in your dashboard
- Verify environment variables are set correctly
- Ensure database is accessible from your web service

## Security Notes

1. **Change Default Password**: After first login, change the default admin password
2. **Rotate Secrets**: Regularly update JWT_SECRET and SESSION_SECRET
3. **Monitor Access**: Check Render logs for suspicious activity
4. **Database Security**: Use strong database passwords and restrict access

## Next Steps

After successful deployment:

1. Test all API endpoints
2. Set up monitoring and logging
3. Configure automatic deployments
4. Set up SSL certificates (Render provides this automatically)
5. Configure backup strategies for your database

## Support

If you encounter issues:

1. Check Render documentation
2. Review application logs
3. Verify environment configuration
4. Test database connectivity
5. Contact IIFTL development team

---

**Last Updated**: December 2024
**Version**: 2.0
