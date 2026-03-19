/**
 * The base URL for the backend API.
 *
 * In development, set the `VITE_BACKEND_URL` env-var (e.g. `http://localhost:8000`).
 * In production the frontend and backend share the same origin, so we
 * default to `window.location.origin`.
 */
export const backendUrl: string = import.meta.env.VITE_BACKEND_URL ?? window.location.origin;
