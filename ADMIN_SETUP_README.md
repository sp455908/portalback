# IIFTL Admin User Setup

This document explains how to set up the admin user for the IIFTL system.

## Admin User Credentials

- **Email**: iiftladmin@iiftl.com
- **Password**: sunVexpress#0912

## Single Admin Rule

The system is configured to allow only **one admin user** at a time. This is a security feature to prevent multiple administrative accounts from being created.

## Setup Instructions

### 1. Run the Admin Setup Script

```bash
cd "IIFTL Backend"
node scripts/setupAdminUser.js
```

This script will:
- Create or update the admin user with the specified credentials
- Set up the single admin configuration setting
- Verify the setup was successful

### 2. Verify Setup

After running the script, you should see output similar to:

```
🔧 Setting up admin user...
✅ Admin user created successfully with ID: 1
🔧 Setting up single admin configuration...
✅ Single admin setting created

📋 Setup Summary:
==================
👤 Admin User:
   Email: iiftladmin@iiftl.com
   Role: admin
   Status: Active
   Created: [timestamp]

⚙️  Settings:
   Single Admin Only: true
   Description: Only one admin user allowed in the system

🎉 Admin user setup completed successfully!
🔐 Login credentials:
   Email: iiftladmin@iiftl.com
   Password: sunVexpress#0912
```

### 3. Test Login

You can now test the admin login using the frontend or by making a POST request to `/api/auth/login` with the credentials.

## Security Features

### Single Admin Enforcement

The system enforces the single admin rule at multiple levels:

1. **Database Level**: User model hooks prevent creating/updating multiple admin users
2. **API Level**: Registration and user update endpoints validate the rule
3. **Setting Level**: Configuration setting tracks the rule status

### API Endpoints

- `GET /api/settings/single-admin-status` - Check single admin status (public)
- `POST /api/auth/register` - User registration (enforces single admin rule)
- `PUT /api/users/:id` - Update user (enforces single admin rule)

## Troubleshooting

### If Admin User Already Exists

The script will automatically update the existing admin user with the new credentials.

### If You Need to Reset

To completely reset the admin setup:

1. Delete the admin user from the database
2. Delete the `single_admin_only` setting
3. Run the setup script again

### Database Connection Issues

Ensure your database is running and the connection string in `.env` is correct before running the script.

## Important Notes

- The admin password is hashed using bcrypt with 12 salt rounds
- The single admin setting is marked as non-editable for security
- All admin-related operations are logged for audit purposes
- The system prevents role escalation to admin when another admin exists

## Support

If you encounter any issues during setup, check:
1. Database connection
2. Environment variables
3. Database permissions
4. Log files for error messages 