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
}

interface ImportMeta {
  env: ImportMetaEnv;
}
