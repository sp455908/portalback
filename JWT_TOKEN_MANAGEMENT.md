# JWT Token Management Guide for Frontend

## 🚀 **Overview**
This guide explains how to properly handle JWT tokens in the frontend to prevent session loss on page refresh.

## 🔑 **Token Types**

### **1. Access Token (Short-lived)**
- **Purpose**: Authenticate API requests
- **Lifetime**: 7 days (configurable)
- **Storage**: localStorage or sessionStorage
- **Usage**: Include in Authorization header

### **2. Refresh Token (Long-lived)**
- **Purpose**: Get new access tokens without re-logging in
- **Lifetime**: 30 days
- **Storage**: HTTP-only cookie (automatic)
- **Usage**: Automatically sent with requests

## 💾 **Frontend Implementation**

### **1. Token Storage Strategy**
```javascript
// Store access token in localStorage for persistence
const storeToken = (token) => {
  localStorage.setItem('accessToken', token);
};

// Retrieve access token
const getToken = () => {
  return localStorage.getItem('accessToken');
};

// Remove token on logout
const removeToken = () => {
  localStorage.removeItem('accessToken');
};
```

### **2. API Request Interceptor**
```javascript
// Axios interceptor to add token to all requests
axios.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

### **3. Response Interceptor for Token Refresh**
```javascript
// Axios interceptor to handle token expiration
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const response = await axios.post('/api/auth/refresh-token');
        const newToken = response.data.token;
        
        // Store new token
        storeToken(newToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        removeToken();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### **4. Login Handler**
```javascript
const handleLogin = async (credentials) => {
  try {
    const response = await axios.post('/api/auth/login', credentials);
    
    if (response.data.status === 'success') {
      const { token, user } = response.data.data;
      
      // Store access token
      storeToken(token);
      
      // Store user data
      localStorage.setItem('user', JSON.stringify(user));
      
      // Redirect to dashboard
      navigate('/dashboard');
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

### **5. Logout Handler**
```javascript
const handleLogout = async () => {
  try {
    // Call logout endpoint to clear refresh token cookie
    await axios.post('/api/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage
    removeToken();
    localStorage.removeItem('user');
    
    // Redirect to login
    navigate('/login');
  }
};
```

### **6. App Initialization (Check Authentication)**
```javascript
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      
      if (token) {
        try {
          // Verify token is still valid
          const response = await axios.get('/api/auth/me');
          setIsAuthenticated(true);
        } catch (error) {
          if (error.response?.status === 401) {
            // Token invalid, try to refresh
            try {
              const refreshResponse = await axios.post('/api/auth/refresh-token');
              const newToken = refreshResponse.data.token;
              storeToken(newToken);
              setIsAuthenticated(true);
            } catch (refreshError) {
              // Refresh failed, clear everything
              removeToken();
              localStorage.removeItem('user');
              setIsAuthenticated(false);
            }
          }
        }
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <Router>
      {isAuthenticated ? <Dashboard /> : <Login />}
    </Router>
  );
};
```

## 🛡️ **Security Best Practices**

### **1. Token Storage**
- ✅ Use `localStorage` for access tokens (persists across sessions)
- ✅ Use HTTP-only cookies for refresh tokens (automatic)
- ❌ Never store sensitive data in localStorage
- ❌ Never expose refresh tokens to JavaScript

### **2. Token Validation**
- ✅ Always validate tokens on app startup
- ✅ Implement automatic token refresh
- ✅ Handle 401 responses gracefully
- ✅ Clear tokens on logout

### **3. CORS Configuration**
- ✅ Ensure `credentials: true` in axios config
- ✅ Backend must allow credentials in CORS
- ✅ Use same domain for API calls when possible

## 🔧 **Backend Configuration**

### **1. Environment Variables**
```bash
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret
```

### **2. CORS Settings**
```javascript
const corsOptions = {
  origin: ['https://yourdomain.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## 🧪 **Testing Token Persistence**

### **1. Test Steps**
1. Login to the application
2. Verify token is stored in localStorage
3. Refresh the page
4. Check if user remains authenticated
5. Verify API calls still work

### **2. Common Issues**
- **CORS errors**: Check backend CORS configuration
- **Token not stored**: Check localStorage implementation
- **Refresh fails**: Check cookie settings and domain
- **401 on refresh**: Check JWT secret and expiration

## 📱 **Mobile Considerations**

### **1. React Native**
- Use `AsyncStorage` instead of localStorage
- Handle token refresh in background
- Implement secure storage for sensitive data

### **2. PWA/SPA**
- Implement service worker for offline support
- Cache tokens for offline authentication
- Handle network errors gracefully

## 🚨 **Troubleshooting**

### **1. Session Still Lost**
- Check if refresh token endpoint is working
- Verify CORS credentials are enabled
- Check browser console for errors
- Verify token storage implementation

### **2. Token Refresh Fails**
- Check refresh token cookie
- Verify JWT secret configuration
- Check user account status
- Review server logs for errors

## 📚 **Additional Resources**

- [JWT.io](https://jwt.io/) - JWT token debugger
- [Axios Documentation](https://axios-http.com/) - HTTP client setup
- [React Router](https://reactrouter.com/) - Navigation handling
- [Local Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) - Browser storage

---

**Note**: This implementation ensures that users remain logged in across page refreshes while maintaining security through proper token management and automatic refresh mechanisms. 