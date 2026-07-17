export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = {
  get: (endpoint: string, options?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...options, method: 'GET' }),

  post: (endpoint: string, body?: any, options?: RequestInit) => {
    const headers: Record<string, string> = {};
    if (!(body instanceof FormData) && body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(`${API_URL}${endpoint}`, {
      ...options,
      method: 'POST',
      headers: { ...headers, ...options?.headers },
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    });
  },

  delete: (endpoint: string, options?: RequestInit) =>
    fetch(`${API_URL}${endpoint}`, { ...options, method: 'DELETE' }),

  patch: (endpoint: string, body?: any, options?: RequestInit) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(`${API_URL}${endpoint}`, {
      ...options,
      method: 'PATCH',
      headers: { ...headers, ...options?.headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
};
