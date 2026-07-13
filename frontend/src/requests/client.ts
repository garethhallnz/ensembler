// Single source of the backend origin. Configurable at build time via
// VITE_API_BASE (falls back to the local backend), and the one place a future
// auth header will attach — so callers never hardcode the URL or the transport.
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

// Thin wrapper over fetch that prepends the backend origin. Returns the raw
// Response so callers keep their own parsing/error handling.
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, init);
}
