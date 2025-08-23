# Render Deployment Guide for IIFTL Backend

## 🚀 Quick Deploy

1. **Connect your GitHub repository** to Render
2. **Create a new Web Service**
3. **Configure the service** with the settings below
4. **Set environment variables** from the template
5. **Deploy!**

## ⚙️ Service Configuration

- **Name**: `iiftl-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: `Starter` (or your preferred plan)

## 🔑 Environment Variables

Copy these variables to your Render dashboard:

```bash
# Database Configuration
MONGO_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/iiftl_portal?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7

# Server Configuration
NODE_ENV=production
PORT=10000

# Security Configuration
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=your_session_secret_here
```

## 📝 Important Notes

1. **MongoDB Atlas**: Ensure your MongoDB cluster allows connections from Render's IP addresses
2. **CORS**: Update `allowedOrigins` in `server.js` with your frontend domain
3. **Health Check**: The app includes a health check endpoint at `/api/health`
4. **Port**: Render will automatically set the PORT environment variable

## 🔍 Troubleshooting

### Common Issues:

1. **"Application exited early"**
   - Check MongoDB connection string
   - Verify environment variables are set
   - Check logs for specific error messages

2. **"MongoDB connection error"**
   - Verify MONGO_URI is correct
   - Check MongoDB Atlas network access
   - Ensure database user has proper permissions

3. **"Port already in use"**
   - Render handles this automatically
   - Use `process.env.PORT` in your code

## 📊 Health Check

Your app includes a health check endpoint at `/api/health` that returns:

```json
{
  "status": "success",
  "message": "API is running",
  "timestamp": "2025-01-XX...",
  "uptime": 123.45,
  "environment": "production",
  "port": 10000
}
```

## 🔄 Auto-Deploy

- **Branch**: `main` (or your preferred branch)
- **Auto-Deploy**: Enabled
- **Pull Request Previews**: Optional

## 📁 File Structure

```
IIFTL Backend/
├── server.js          # Main server file
├── app.js            # Express app configuration
├── package.json      # Dependencies and scripts
├── .env.example      # Environment variables template
└── models/           # Database models
```

## 🚨 Security Notes

1. **Never commit `.env` files** to Git
2. **Use strong JWT secrets** in production
3. **Enable MongoDB authentication**
4. **Set up proper CORS origins**

## 📞 Support

If you encounter issues:
1. Check Render logs in the dashboard
2. Verify environment variables
3. Test MongoDB connection locally
4. Check the health endpoint: `/api/health`
