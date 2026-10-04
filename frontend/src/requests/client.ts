// Single source of the backend origin, and the one place a future auth header
// will attach — so callers never hardcode the URL or the transport. In order:
// a build-time VITE_API_BASE override, the port the desktop app chose at launch
// (exposed by preload.js), then the browser-dev backend's fixed port.
const desktopBackendOrigin = (window as unknown as { electronAPI?: { backendOrigin?: string } }).electronAPI
  ?.backendOrigin;

export const API_BASE = import.meta.env.VITE_API_BASE ?? desktopBackendOrigin ?? 'http://localhost:3001';

// Thin wrapper over fetch that prepends the backend origin. Returns the raw
// Response so callers keep their own parsing/error handling.
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, init);
}
