/// <reference types="vite/client" />

// Type augmentation for Vite's import.meta.env
interface ImportMetaEnv {
  VITE_AWS_USER_POOL_ID: string;
  VITE_AWS_USER_POOL_CLIENT_ID: string;
  VITE_AWS_REGION: string;
  VITE_API_PLANTS_READ: string;
  VITE_API_PLANTS_WRITE: string;
  VITE_API_PLANTS_UPDATE: string;
  VITE_API_USERS_READ: string;
  VITE_API_USERS_WRITE: string;
  VITE_API_USERS_UPDATE: string;
  VITE_TELEMETRY_DSN?: string;
  VITE_TELEMETRY_ENVIRONMENT?: string;
  VITE_APP_RELEASE?: string;
  VITE_APP_VERSION?: string;
  VITE_TELEMETRY_ALERT_TOKEN?: string;
  VITE_TELEMETRY_ALERT_ORG?: string;
  VITE_TELEMETRY_ALERT_PROJECT?: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}
