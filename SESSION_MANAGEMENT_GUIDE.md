# Session Management Implementation Guide

## Overview

This document explains the session management system implemented to prevent users from logging in from multiple browsers or devices simultaneously. The system enforces single-session-per-user policy for enhanced security.

## Key Features

### 1. Single Session Enforcement
- **Automatic Session Deactivation**: When a user logs in from a new device/browser, all existing sessions for that user are automatically deactivated
- **Session Validation**: Every protected request validates both JWT token and session ID
- **Idle Timeout**: Sessions expire after 30 minutes of inactivity
- **Absolute Timeout**: Sessions expire after 30 minutes regardless of activity

### 2. Session Tracking
- **Database Storage**: All sessions are stored in the `UserSessions` table
- **Device Information**: Tracks IP address, user agent, and device info
- **Activity Monitoring**: Last activity timestamp is updated on each request
- **Session Metadata**: Stores access tokens, refresh tokens, and expiration times

### 3. Security Features
- **Session ID Validation**: Each request must include a valid session ID
- **Token-Session Binding**: JWT tokens are bound to specific sessions
- **Automatic Cleanup**: Expired and idle sessions are automatically deactivated
- **Conflict Detection**: System logs when multiple sessions are detected

## Implementation Details

### Database Schema

The `UserSessions` table includes:
```sql
- id: Primary key
- userId: Foreign key to Users table
- sessionId: Unique session identifier
- accessToken: JWT access token
- refreshToken: JWT refresh token
- ipAddress: Client IP address
- userAgent: Browser/client information
- lastActivity: Last activity timestamp
- expiresAt: Session expiration time
- isActive: Session status flag
- deviceInfo: JSON metadata about the device
```

### API Endpoints

#### Authentication
- `POST /api/auth/login` - Login with automatic session deactivation
- `POST /api/auth/logout` - Logout and deactivate current session
- `POST /api/auth/refresh-token` - Refresh access token

#### Session Management
- `GET /api/auth/active-sessions` - Get all active sessions for current user
- `POST /api/auth/logout-all-other-sessions` - Force logout from all other sessions
- `GET /api/auth/validate-session` - Validate current session

### Request Headers

All protected requests must include:
```
Authorization: Bearer <jwt_token>
x-session-id: <session_id>
```

### Middleware Stack

1. **Auth Middleware** (`auth.middleware.js`)
   - Validates JWT token
   - Validates session ID
   - Checks session expiration and idle timeout
   - Updates session activity

2. **Session Management** (`sessionManagement.middleware.js`)
   - Creates new sessions
   - Deactivates existing sessions
   - Tracks session activity
   - Cleans up expired sessions

## Usage Examples

### Frontend Integration

#### Login Process
```javascript
// Login request
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { token, sessionId } = await loginResponse.json();

// Store session ID for future requests
localStorage.setItem('sessionId', sessionId);
```

#### Making Authenticated Requests
```javascript
// Include session ID in all requests
const response = await fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-session-id': sessionId
  }
});
```

#### Handling Session Conflicts
```javascript
// Check for active sessions
const sessionsResponse = await fetch('/api/auth/active-sessions', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-session-id': sessionId
  }
});

const { activeSessions } = await sessionsResponse.json();

// Force logout from other sessions
if (activeSessions.length > 1) {
  await fetch('/api/auth/logout-all-other-sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-session-id': sessionId
    }
  });
}
```

### Error Handling

#### Common Error Codes
- `SESSION_INVALID` - Session ID is invalid or expired
- `SESSION_EXPIRED` - Session has reached absolute timeout
- `SESSION_IDLE_TIMEOUT` - Session expired due to inactivity
- `SESSION_CONFLICT` - Multiple active sessions detected

#### Error Response Format
```json
{
  "status": "fail",
  "message": "Session expired due to inactivity. Please login again.",
  "code": "SESSION_IDLE_TIMEOUT"
}
```

## Configuration

### Environment Variables
```env
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
SESSION_TIMEOUT_MINUTES=30
IDLE_TIMEOUT_MINUTES=30
```

### Session Timeout Settings
- **Idle Timeout**: 30 minutes of inactivity
- **Absolute Timeout**: 30 minutes from login
- **Refresh Token**: 30 days validity

## Testing

### Manual Testing
1. Login from Browser A
2. Login from Browser B (should deactivate Browser A session)
3. Try to access protected resource from Browser A (should fail)
4. Access protected resource from Browser B (should work)

### Automated Testing
Run the test script:
```bash
node test-session-management.js
```

## Security Considerations

### Benefits
- **Prevents Account Sharing**: Users cannot share accounts across devices
- **Enhanced Security**: Reduces risk of unauthorized access
- **Session Control**: Users can see and manage their active sessions
- **Automatic Cleanup**: Expired sessions are automatically removed

### Limitations
- **User Experience**: Users must re-login when switching devices
- **Legitimate Multi-Device Use**: May inconvenience users who legitimately use multiple devices
- **Session Recovery**: No automatic session recovery if browser crashes

## Troubleshooting

### Common Issues

1. **Session Not Found Error**
   - Ensure `x-session-id` header is included in requests
   - Check if session has expired or been deactivated

2. **Multiple Sessions Detected**
   - This is expected behavior - new login deactivates old sessions
   - Use `/api/auth/active-sessions` to see all sessions

3. **Session Expires Too Quickly**
   - Check `SESSION_TIMEOUT_MINUTES` configuration
   - Ensure session activity is being updated

### Debug Mode
Enable detailed logging by setting:
```env
NODE_ENV=development
```

## Migration Notes

### Existing Users
- Existing users will need to re-login to get session IDs
- No data migration required
- Sessions are created automatically on next login

### Frontend Updates Required
- Add `x-session-id` header to all authenticated requests
- Handle session-related error codes
- Implement session management UI (optional)

## Future Enhancements

### Planned Features
- **Session Management UI**: Allow users to view and manage sessions
- **Device Trust**: Remember trusted devices
- **Session Notifications**: Notify users of new logins
- **Session Analytics**: Track session patterns and security events

### Configuration Options
- **Multi-Session Support**: Allow multiple sessions per user
- **Device-Specific Timeouts**: Different timeouts for different device types
- **Geographic Restrictions**: Block sessions from certain locations