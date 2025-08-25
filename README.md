# IIFTL Backend

A comprehensive learning platform backend built with Node.js, Express, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- PostgreSQL 13+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd "IIFTL Backend"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # Edit .env with your database credentials
   # Required variables:
   # - DATABASE_URL (PostgreSQL connection string)
   # - JWT_SECRET (at least 32 characters)
   # - SESSION_SECRET
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

## 🔐 Admin User Setup

### Local Development

For local testing, you can create an admin user directly through the API:

```bash
curl -X POST http://localhost:5000/api/auth/create-initial-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: iiftl-setup-2024"
```

### Production Setup

For production deployment (e.g., Render), use the same API endpoint:

```bash
curl -X POST https://your-app-name.onrender.com/api/auth/create-initial-admin \
  -H "Content-Type: application/json" \
  -H "x-setup-key: iiftl-setup-2024"
```

### Admin Credentials

After setup, use these credentials:
- **Email**: `iiftladmin@iiftl.com`
- **Password**: `sunVexpress#0912`
- **Role**: `admin`
- **User Type**: `corporate`

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/create-initial-admin` - Create initial admin (setup only)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### Courses
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create course (admin only)
- `GET /api/courses/:id` - Get course by ID
- `PUT /api/courses/:id` - Update course (admin only)
- `DELETE /api/courses/:id` - Delete course (admin only)

### Practice Tests
- `GET /api/practice-tests` - Get all practice tests
- `POST /api/practice-tests` - Create practice test (admin only)
- `GET /api/practice-tests/:id` - Get practice test by ID
- `PUT /api/practice-tests/:id` - Update practice test (admin only)
- `DELETE /api/practice-tests/:id` - Delete practice test (admin only)

## 🗄️ Database Models

- **User**: Authentication and user management
- **Course**: Course information and structure
- **PracticeTest**: Practice test questions and answers
- **Enrollment**: User course enrollments
- **TestAttempt**: User test attempt records
- **Material**: Course materials and resources
- **Alert**: System notifications
- **Settings**: Application configuration

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Admin, corporate, government, and student roles
- **Single Admin Rule**: Only one admin user allowed in the system
- **Password Hashing**: Bcrypt with 12 salt rounds
- **CORS Protection**: Configurable allowed origins
- **Rate Limiting**: Request throttling for API protection
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Sequelize ORM with parameterized queries

## 🚀 Deployment

### Render Deployment

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed Render deployment instructions.

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `development` |
| `PORT` | Server port | Yes | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `JWT_EXPIRES_IN` | JWT expiration time | No | `7d` |
| `ALLOWED_ORIGINS` | CORS allowed origins | Yes | - |
| `SESSION_SECRET` | Session store secret | Yes | - |
| `SETUP_KEY` | Initial admin setup key | No | `iiftl-setup-2024` |

## 📁 Project Structure

```
IIFTL Backend/
├── api/                    # API routes
├── config/                 # Configuration files
├── controllers/            # Route controllers
├── middlewares/            # Express middlewares
├── models/                 # Database models
├── routes/                 # Route definitions
├── scripts/                # Utility scripts
├── utils/                  # Utility functions
├── app.js                  # Express app configuration
├── server.js               # Server entry point
└── package.json            # Dependencies and scripts
```

## 🛠️ Development Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run force-sync` - Force database synchronization
- `npm run create-excel-template` - Create Excel template for data import

## 🧪 Testing

Test the admin login after setup:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "iiftladmin@iiftl.com",
    "password": "sunVexpress#0912"
  }'
```

## 🔧 Troubleshooting

### Common Issues

1. **"Incorrect email or password"**
   - Run the admin setup script first
   - Verify database connection
   - Check if admin user exists

2. **Database connection failed**
   - Verify DATABASE_URL in .env
   - Ensure PostgreSQL is running
   - Check database permissions

3. **Admin user creation failed**
   - Check if admin already exists
   - Verify database schema
   - Check for validation errors

### Getting Help

- Check the logs for detailed error messages
- Verify environment variables are set correctly
- Ensure database is accessible
- Check the troubleshooting section in deployment guides

## 📚 Documentation

- [Admin Setup Guide](./ADMIN_SETUP_README.md)
- [Render Deployment Guide](./RENDER_DEPLOYMENT.md)
- [PostgreSQL Migration Guide](./POSTGRESQL_MIGRATION_GUIDE.md)
- [Excel Upload Guide](./EXCEL_UPLOAD_GUIDE.md)
- [Practice Test Improvements](./PRACTICE_TEST_IMPROVEMENTS.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the troubleshooting guides
- Contact the development team

---

**Last Updated**: December 2024  
**Version**: 2.0
