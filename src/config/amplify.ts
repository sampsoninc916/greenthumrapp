import { Amplify } from 'aws-amplify';
import { loadEnvConfig } from './env';

let amplifyConfigured = false;

export const configureAmplify = async () => {
  if (amplifyConfigured) return;
  const env = await loadEnvConfig();

  if (!env.AWS_USER_POOL_ID || !env.AWS_USER_POOL_CLIENT_ID) {
    console.error('Missing required AWS Cognito configuration.');
  }

  const amplifyConfig = {
    Auth: {
      Cognito: {
        userPoolId: env.AWS_USER_POOL_ID,
        userPoolClientId: env.AWS_USER_POOL_CLIENT_ID,
        region: env.AWS_REGION,
      }
    }
  };

  Amplify.configure(amplifyConfig);
  amplifyConfigured = true;
};

let apiEndpoints: {
  PLANTS_READ: string;
  PLANTS_WRITE: string;
  PLANTS_UPDATE: string;
  USERS_READ: string;
  USERS_WRITE: string;
  USERS_UPDATE: string;
} | null = null;

export const getApiEndpoints = async () => {
  if (!apiEndpoints) {
    const env = await loadEnvConfig();
    const requiredEndpoints = [
      'API_PLANTS_READ',
      'API_PLANTS_WRITE',
      'API_USERS_READ',
      'API_USERS_WRITE'
    ];
    const missing = requiredEndpoints.filter(key => !(env as any)[key]);
    if (missing.length > 0) {
      console.error(`Missing required API endpoints: ${missing.join(', ')}`);
    }

    apiEndpoints = {
      PLANTS_READ: env.API_PLANTS_READ,
      PLANTS_WRITE: env.API_PLANTS_WRITE,
      PLANTS_UPDATE: env.API_PLANTS_UPDATE,
      USERS_READ: env.API_USERS_READ,
      USERS_WRITE: env.API_USERS_WRITE,
      USERS_UPDATE: env.API_USERS_UPDATE,
    };
  }
  return apiEndpoints;
};

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
