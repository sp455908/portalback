# IIFTL Backend

A comprehensive Node.js backend for the IIFTL (Indian Institute of Foreign Trade and Logistics) portal, built with Express.js, PostgreSQL, and Sequelize ORM.

## 🚀 **Quick Start**

### **1. Environment Setup**
```bash
# Copy environment template
cp env.example .env

# Edit .env with your configuration
# See ENVIRONMENT_SETUP.md for detailed instructions
```

### **2. Install Dependencies**
```bash
npm install
```

### **3. Database Setup**
```bash
# Start PostgreSQL service
# Update DATABASE_URL in .env

# Run database sync
npm run force-sync
```

### **4. Create Admin User**
```bash
# Use the API endpoint (recommended for production)
curl -X POST https://your-domain.com/api/auth/create-initial-admin \
  -H "Content-Type: application/json" \
  -d '{"setupKey":"your-setup-key"}'

# Or use the script (local development only)
npm run setup-admin
```

### **5. Start Server**
```bash
# Development
npm run dev

# Production
npm start
```

## 🔑 **Authentication & Session Management**

### **JWT Token System**
- **Access Token**: 7-day validity, stored in localStorage
- **Refresh Token**: 30-day validity, stored as HTTP-only cookie
- **Automatic Refresh**: Tokens refresh automatically on expiration
- **Session Persistence**: Users stay logged in across page refreshes

### **Key Endpoints**
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### **Frontend Integration**
See `JWT_TOKEN_MANAGEMENT.md` for complete frontend implementation guide.

## 📚 **API Endpoints**

### **Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/create-initial-admin` - Create initial admin

### **Users**
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/stats` - Get user statistics

### **Batches**
- `GET /api/batches` - Get all batches
- `POST /api/batches` - Create new batch
- `GET /api/batches/:id` - Get batch by ID
- `PUT /api/batches/:id` - Update batch
- `DELETE /api/batches/:id` - Delete batch
- `GET /api/batches/health` - Batch system health check

### **Courses**
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create new course
- `GET /api/courses/:id` - Get course by ID
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### **Practice Tests**
- `GET /api/practice-tests` - Get all practice tests
- `POST /api/practice-tests` - Create new practice test
- `GET /api/practice-tests/:id` - Get practice test by ID
- `PUT /api/practice-tests/:id` - Update practice test
- `DELETE /api/practice-tests/:id` - Delete practice test

## 🗄️ **Database Models**

### **Core Models**
- **User** - User accounts with roles (admin, student, corporate, government)
- **Batch** - Student batches with many-to-many relationships
- **Course** - Educational courses
- **PracticeTest** - Assessment tests
- **Enrollment** - Student course enrollments
- **TestAttempt** - Student test attempts

### **Association Models**
- **BatchStudent** - Junction table for batch-student relationships
- **BatchAssignedTest** - Junction table for batch-test assignments

### **Security Models**
- **SecurityViolation** - Track security violations
- **UserTestCooldown** - Manage test cooldown periods

## 🛡️ **Security Features**

### **Authentication & Authorization**
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Session management with PostgreSQL store
- CSRF protection
- Rate limiting

### **Data Protection**
- Password hashing with bcrypt
- Input validation and sanitization
- SQL injection prevention via Sequelize
- XSS protection via helmet

### **Monitoring**
- Security violation tracking
- Session activity monitoring
- Request logging and analytics

## 🚀 **Deployment**

### **Render Platform**
See `RENDER_DEPLOYMENT.md` for complete deployment guide.

### **Environment Variables**
See `ENVIRONMENT_SETUP.md` for required environment variables.

### **Database Migration**
See `POSTGRESQL_MIGRATION_GUIDE.md` for database setup.

## 🧪 **Testing**

### **JWT Token Testing**
```bash
# Test JWT token refresh functionality
node test-jwt-refresh.js
```

### **API Testing**
```bash
# Test authentication endpoints
node test-auth.js

# Test JWT verification
node test-jwt.js
```

## 📁 **Project Structure**

```
IIFTL Backend/
├── api/                    # API versioning
├── config/                 # Configuration files
├── controllers/            # Route controllers
├── middlewares/            # Custom middleware
├── models/                 # Database models
├── routes/                 # API routes
├── scripts/                # Utility scripts
├── utils/                  # Helper utilities
├── app.js                  # Express app configuration
├── server.js               # Server entry point
└── README.md               # This file
```

## 🔧 **Development Scripts**

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run force-sync` - Force database synchronization
- `npm run create-excel-template` - Create Excel template for data import

## 🚨 **Troubleshooting**

### **Common Issues**
1. **Session Lost on Refresh**: Check JWT token management implementation
2. **Database Connection**: Verify DATABASE_URL and PostgreSQL service
3. **CORS Errors**: Check CORS configuration and allowed origins
4. **Authentication Failures**: Verify JWT_SECRET and token expiration

### **Debug Mode**
Set `NODE_ENV=development` in `.env` for detailed error messages.

## 📚 **Documentation**

- [Environment Setup](ENVIRONMENT_SETUP.md) - Complete environment configuration
- [Render Deployment](RENDER_DEPLOYMENT.md) - Production deployment guide
- [JWT Token Management](JWT_TOKEN_MANAGEMENT.md) - Frontend authentication guide
- [PostgreSQL Migration](POSTGRESQL_MIGRATION_GUIDE.md) - Database setup guide
- [Excel Upload Guide](EXCEL_UPLOAD_GUIDE.md) - Data import instructions

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 **License**

This project is proprietary software for IIFTL.

---

**Note**: For production deployment, ensure all environment variables are properly configured and security measures are in place.
