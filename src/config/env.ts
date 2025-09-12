export interface EnvConfig {
  AWS_USER_POOL_ID: string;
  AWS_USER_POOL_CLIENT_ID: string;
  AWS_REGION: string;
  API_PLANTS_READ: string;
  API_PLANTS_WRITE: string;
  API_PLANTS_UPDATE: string;
  API_USERS_READ: string;
  API_USERS_WRITE: string;
  API_USERS_UPDATE: string;
}

let cachedConfig: EnvConfig | null = null;

export const loadEnvConfig = async (): Promise<EnvConfig> => {
  if (!cachedConfig) {
    const response = await fetch('/env-config');
    if (!response.ok) {
      throw new Error('Failed to load environment configuration');
    }
    cachedConfig = await response.json();
  }
  return cachedConfig;
};
