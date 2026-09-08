import { useAppStore } from '../stores/useAppStore';

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends RequestInit {
  retries?: number;
  timeout?: number;
}

export async function fetchWithRetry(
  path: string,
  options: RequestOptions = {},
  customRetries?: number,
  customTimeout?: number
): Promise<Response> {
  const { activeDomain } = useAppStore.getState();
  if (!activeDomain || !activeDomain.url) {
    throw new ApiError('API_DOMAIN_NOT_SET');
  }

  const { retries: optionRetries, timeout: optionTimeout, ...fetchOptions } = options;
  const retries = customRetries ?? optionRetries ?? 0;
  const timeout = customTimeout ?? optionTimeout ?? 4000;

  const headers = {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  let attempts = 0;
  let lastError: any;

  while (attempts <= retries) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const url = `${activeDomain.url.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(id);
      return response;
    } catch (err: any) {
      lastError = err;
      attempts++;
      if (attempts <= retries) {
        await new Promise((res) => setTimeout(res, 300 * attempts));
      }
    }
  }

  throw new ApiError(lastError?.message || 'FETCH_FAILED');
}

export const apiClient = {
  async get<T>(path: string, options?: { retries?: number; timeout?: number }): Promise<T> {
    const res = await fetchWithRetry(path, { method: 'GET' }, options?.retries, options?.timeout);
    if (!res.ok) throw new ApiError(`HTTP Error ${res.status}`, res.status);
    return await res.json();
  },

  async post<T>(path: string, body?: any, options?: { retries?: number; timeout?: number }): Promise<T> {
    const res = await fetchWithRetry(
      path,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      options?.retries,
      options?.timeout
    );
    if (!res.ok) throw new ApiError(`HTTP Error ${res.status}`, res.status);
    return await res.json();
  },

  async put<T>(path: string, body?: any, options?: { retries?: number; timeout?: number }): Promise<T> {
    const res = await fetchWithRetry(
      path,
      {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      },
      options?.retries,
      options?.timeout
    );
    if (!res.ok) throw new ApiError(`HTTP Error ${res.status}`, res.status);
    return await res.json();
  },

  async delete<T>(path: string, body?: any, options?: { retries?: number; timeout?: number }): Promise<T> {
    const res = await fetchWithRetry(
      path,
      {
        method: 'DELETE',
        body: body ? JSON.stringify(body) : undefined,
      },
      options?.retries,
      options?.timeout
    );
    if (!res.ok) throw new ApiError(`HTTP Error ${res.status}`, res.status);
    return await res.json();
  },
};

