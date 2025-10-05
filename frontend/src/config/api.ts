interface ApiConfig {
  primary: string;
  fallback: string;
}

export const API_CONFIG: ApiConfig = {
  primary: import.meta.env.VITE_API_URL_PRIMARY,
  fallback: import.meta.env.VITE_API_URL_FALLBACK
};