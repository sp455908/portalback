# IIFTL Backend - Environment Setup Guide

This guide will help you set up the environment variables and configuration needed to run the IIFTL Backend.

## 🚨 Important: Environment Variables

The IIFTL Backend requires several environment variables to function properly. **Never commit your `.env` file to version control** as it contains sensitive information.

## 📋 Required Environment Variables

### 1. Database Configuration

```bash
# PostgreSQL Connection String (Required)
DATABASE_URL=postgresql://username:password@host:port/database

# Alternative: Individual Database Variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iiftl_db
DB_USER=your_username
DB_PASSWORD=your_password
```

### 2. JWT Configuration

```bash
# JWT Secret Key (Required - Must be at least 32 characters)
JWT_SECRET=your-super-secret-jwt-key-here-must-be-at-least-32-characters-long

# JWT Expiration Time (Optional)
JWT_EXPIRES_IN=7d
```

### 3. Server Configuration

```bash
# Environment Mode
NODE_ENV=development

# Server Port
PORT=5000
```

### 4. Security Configuration

```bash
# Session Secret
SESSION_SECRET=your-session-secret-key-here

# CORS Allowed Origins (comma-separated)
ALLOWED_ORIGINS=https://iiftl-portal.vercel.app,http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Initial Admin Setup Key
SETUP_KEY=iiftl-setup-2024
```

## 🔧 Setup Instructions

### Step 1: Create Environment File

1. **Copy the example file:**
   ```bash
   cp env.example .env
   ```

2. **Edit the `.env` file** with your actual values

### Step 2: Database Setup

#### Option A: Local PostgreSQL

1. **Install PostgreSQL** on your system
2. **Create a database:**
   ```sql
   CREATE DATABASE iiftl_db;
   CREATE USER iiftl_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE iiftl_db TO iiftl_user;
   ```

3. **Set DATABASE_URL:**
   ```bash
   DATABASE_URL=postgresql://iiftl_user:your_password@localhost:5432/iiftl_db
   ```

#### Option B: Cloud PostgreSQL (Recommended for Production)

1. **Use a cloud provider** like:
   - Render PostgreSQL
   - Supabase
   - Railway
   - Neon
   - AWS RDS

2. **Get the connection string** from your provider

3. **Set DATABASE_URL** with the provided connection string

### Step 3: Generate Secrets

#### JWT Secret

Generate a strong JWT secret (at least 32 characters):

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

#### Session Secret

Generate a session secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: CORS Configuration

Update `ALLOWED_ORIGINS` with your frontend domains:

```bash
# Development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Multiple environments
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000,https://staging.yourdomain.com
```

## 📝 Complete Example

Here's a complete `.env` file example:

```bash
# IIFTL Backend Environment Variables
NODE_ENV=development
PORT=5000

# PostgreSQL Connection
DATABASE_URL=postgresql://iiftl_user:your_secure_password@localhost:5432/iiftl_db

# JWT Configuration
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_EXPIRES_IN=7d

# CORS Origins
ALLOWED_ORIGINS=https://iiftl-portal.vercel.app,http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Session Store
SESSION_SECRET=b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7

# Initial Admin Setup
SETUP_KEY=iiftl-setup-2024
```

## 🔍 Validation

### Environment Check

The server will validate required environment variables on startup:

```bash
npm run dev
```

You should see:
```
✅ Environment variables validated successfully
🔐 JWT Secret: Set (64 chars)
🗄️  Database URL: Set
```

### Database Connection Test

Test database connectivity:

```bash
# The server will automatically test the connection
# Look for: "PostgreSQL database connection established successfully."
```

## 🚨 Common Issues

### 1. Missing Environment Variables

**Error:** `❌ Missing required environment variables: [JWT_SECRET, DATABASE_URL]`

**Solution:** Ensure all required variables are set in your `.env` file

### 2. Weak JWT Secret

**Error:** `❌ JWT_SECRET is too short. Must be at least 32 characters long`

**Solution:** Generate a longer secret (at least 32 characters)

### 3. Database Connection Failed

**Error:** `Unable to connect to PostgreSQL database`

**Solutions:**
- Check DATABASE_URL format
- Ensure PostgreSQL is running
- Verify database credentials
- Check network access

### 4. CORS Errors

**Error:** `CORS policy: Origin is not allowed`

**Solution:** Add your frontend domain to `ALLOWED_ORIGINS`

## 🔒 Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for each environment
3. **Rotate secrets regularly** in production
4. **Limit database access** to only necessary permissions
5. **Use HTTPS** in production
6. **Monitor access logs** for suspicious activity

## 🌍 Environment-Specific Configurations

### Development

```bash
NODE_ENV=development
PORT=5000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Staging

```bash
NODE_ENV=staging
PORT=5000
ALLOWED_ORIGINS=https://staging.yourdomain.com
```

### Production

```bash
NODE_ENV=production
PORT=10000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## 📚 Next Steps

After setting up your environment:

1. **Start the server:** `npm run dev`
2. **Setup admin user:** `npm run quick-admin-setup`
3. **Test the API:** Use the provided curl commands
4. **Deploy to production:** Follow the deployment guides

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs** for specific error messages
2. **Verify environment variables** are set correctly
3. **Test database connectivity** manually
4. **Review the troubleshooting guides**
5. **Contact the development team**

---

**Last Updated**: December 2024  
**Version**: 1.0 