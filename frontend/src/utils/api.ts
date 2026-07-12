/**
 * Central API base URL configuration.
 *
 * In production, set the VITE_API_URL environment variable to your
 * deployed backend URL (e.g. https://insightai-backend.onrender.com).
 *
 * In local development it falls back to http://localhost:8000
 * so no .env file is needed to get started.
 */
const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default API_BASE_URL;
