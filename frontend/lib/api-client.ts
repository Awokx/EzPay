import config from '@/lib/config';

const TOKEN_KEY = 'ezpay.accessToken';
const MAX_GET_RETRIES = 2;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
}

async function readError(response: Response): Promise<ApiError> {
  const payload = await readResponse<Record<string, unknown>>(response).catch(() => undefined);
  const message = typeof payload?.message === 'string'
    ? payload.message
    : typeof payload?.error === 'string'
      ? payload.error
      : `Request failed with status ${response.status}`;
  return new ApiError(message, response.status, payload);
}

class ApiClient {
  private readonly baseURL: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseURL = config.api.baseUrl) {
    this.baseURL = baseURL.replace(/\/$/, '');
  }

  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, token);
  }

  getAuthToken(): string | null {
    return readStoredToken();
  }

  removeAuthToken(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
  }

  private async refreshAuthToken(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const token = readStoredToken();
      if (!token) return false;

      try {
        const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return false;

        const result = await readResponse<{ token?: string; access_token?: string }>(response);
        const refreshedToken = result?.token ?? result?.access_token;
        if (!refreshedToken) return false;
        this.setAuthToken(refreshedToken);
        return true;
      } catch (error) {
        console.error('API token refresh failed', error);
        return false;
      }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const url = `${this.baseURL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const token = readStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let attempt = 0;
    let refreshed = false;
    while (true) {
      try {
        const response = await fetch(url, { ...options, method, headers });
        if (response.status === 401 && !refreshed && !endpoint.includes('/auth/')) {
          refreshed = true;
          if (await this.refreshAuthToken()) {
            const newToken = readStoredToken();
            if (newToken) headers.set('Authorization', `Bearer ${newToken}`);
            continue;
          }
          this.removeAuthToken();
        }

        if (!response.ok) throw await readError(response);
        return await readResponse<T>(response);
      } catch (error) {
        const retryable = !(error instanceof ApiError) || error.status >= 500;
        if (method === 'GET' && retryable && attempt < MAX_GET_RETRIES) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
          continue;
        }

        if (error instanceof ApiError) throw error;
        console.error('API request failed', { endpoint, method, error });
        throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, error);
      }
    }
  }

  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }

  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export { ApiClient };