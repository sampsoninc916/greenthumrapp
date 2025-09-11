import { Amplify } from 'aws-amplify';

// Use environment variables for sensitive configuration
// These MUST be set in your .env file
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_AWS_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_AWS_USER_POOL_CLIENT_ID,
      region: import.meta.env.VITE_AWS_REGION,
    }
  }
};

// Validate required environment variables
if (!import.meta.env.VITE_AWS_USER_POOL_ID || !import.meta.env.VITE_AWS_USER_POOL_CLIENT_ID) {
  console.error('Missing required AWS Cognito configuration. Please check your .env file.');
}

// Configure Amplify once at app initialization
export const configureAmplify = () => {
  Amplify.configure(amplifyConfig);
};

// API endpoints configuration
export const API_ENDPOINTS = {
  PLANTS_READ: import.meta.env.VITE_API_PLANTS_READ,
  PLANTS_WRITE: import.meta.env.VITE_API_PLANTS_WRITE,
  PLANTS_UPDATE: import.meta.env.VITE_API_PLANTS_UPDATE,
  USERS_READ: import.meta.env.VITE_API_USERS_READ,
  USERS_WRITE: import.meta.env.VITE_API_USERS_WRITE,
  USERS_UPDATE: import.meta.env.VITE_API_USERS_UPDATE,
};

// Validate API endpoints
const requiredEndpoints = [
  'VITE_API_PLANTS_READ',
  'VITE_API_PLANTS_WRITE',
  'VITE_API_USERS_READ',
  'VITE_API_USERS_WRITE'
];

const missingEndpoints = requiredEndpoints.filter(key => !import.meta.env[key]);
if (missingEndpoints.length > 0) {
  console.error(`Missing required API endpoints: ${missingEndpoints.join(', ')}. Please check your .env file.`);
}

// Security configuration
export const SECURITY_CONFIG = {
  // Use sessionStorage for better security (clears on tab close)
  TOKEN_STORAGE: 'session', // 'session' or 'local'
  // Token refresh buffer time (in seconds before expiry)
  TOKEN_REFRESH_BUFFER: 300, // 5 minutes
  // Password requirements
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SPECIAL: true,
};