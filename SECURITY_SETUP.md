# Security and Authentication Setup

## Overview
This document outlines the security improvements and JWT authentication implementation for the Thumr application.

## What's Been Implemented

### 1. Environment Variables
All sensitive credentials have been moved to environment variables in `.env` file:
- AWS Cognito configuration (User Pool ID, Client ID, Region)
- API Gateway endpoints for all operations

**Important**: The `.env` file is gitignored and should NEVER be committed to version control.

### 2. JWT Authentication System
- **AuthContext**: Manages user sessions, JWT tokens, and authentication state
- **ProtectedRoute**: Component wrapper for routes requiring authentication
- **Token Management**: 
  - Automatic token refresh 5 minutes before expiry
  - Tokens stored in sessionStorage (more secure than localStorage)
  - Token attached to all authenticated API requests

### 3. User Access Control
**Public Access (No Login Required):**
- Browse all plant listings
- Search and filter plants
- View plant details
- View the main marketplace

**Authenticated Access (Login Required):**
- Create new plant listings
- Edit/update plant listings
- Access user profile
- Contact sellers
- Save favorite listings

### 4. Security Improvements
- Password strength validation (8+ chars, uppercase, lowercase, numbers, special chars)
- Email format validation
- Input validation on all forms
- Secure token storage using sessionStorage
- Automatic logout on token expiry
- No hardcoded credentials in source code

## Configuration Files

### `.env` (Production Credentials)
```env
VITE_AWS_USER_POOL_ID=your_actual_pool_id
VITE_AWS_USER_POOL_CLIENT_ID=your_actual_client_id
VITE_AWS_REGION=us-east-1
VITE_API_PLANTS_READ=https://your-api-gateway/readPlantsData
# ... other endpoints
```


### `src/config/amplify.ts`
Central configuration file that:
- Loads environment variables
- Validates required configuration
- Exports API endpoints and security settings

## API Security Considerations

### Current Implementation
- JWT tokens are sent in Authorization header
- Public endpoints (read operations) don't require authentication
- Write/update operations require valid JWT token

### Recommended Backend Improvements
1. **API Gateway**: Configure to validate JWT tokens
2. **Lambda Functions**: Verify token claims and user permissions
3. **CORS**: Configure proper CORS headers
4. **Rate Limiting**: Implement to prevent abuse
5. **HTTPS**: Ensure all endpoints use HTTPS only

## Testing the Authentication Flow

1. **Signup Flow**:
   - Navigate to `/signup`
   - Enter valid credentials
   - Receive confirmation code via email
   - Enter code to complete registration
   - Auto-login after successful confirmation

2. **Login Flow**:
   - Navigate to `/login`
   - Enter credentials
   - JWT token stored in sessionStorage
   - Redirected to home page or intended destination

3. **Protected Routes**:
   - Try accessing `/profile` without login → redirected to `/login`
   - After login → can access profile page

4. **Creating Listings**:
   - Click "Sell Plant" without login → redirected to `/login`
   - After login → modal opens for creating listing

## Deployment Checklist

- [ ] Create production `.env` file with real credentials
- [ ] Ensure `.env` is in `.gitignore`
- [ ] Configure API Gateway to validate JWT tokens
- [ ] Enable HTTPS on all endpoints
- [ ] Test authentication flow in production
- [ ] Monitor for any security issues

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Rotate credentials regularly**
3. **Monitor for suspicious activity**
4. **Keep dependencies updated**
5. **Use HTTPS everywhere**
6. **Implement proper error handling** without exposing sensitive info
7. **Log security events** for auditing

## Support

For questions or issues related to authentication, check:
- AWS Cognito console for user pool configuration
- API Gateway console for endpoint configuration
- CloudWatch logs for Lambda function errors