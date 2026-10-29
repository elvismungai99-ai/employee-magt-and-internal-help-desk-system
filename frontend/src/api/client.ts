import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse, AuthResponseData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const ACCESS_TOKEN_KEY = 'auth_access_token';

let inMemoryAccessToken: string | null = null;
let logoutCallback: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

export const getAccessToken = (): string | null => {
  if (!inMemoryAccessToken) {
    inMemoryAccessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return inMemoryAccessToken;
};

// Refresh token helper: uses localStorage for persistent "remember me" sessions, falling back to sessionStorage
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export const getStoredRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setStoredRefreshToken = (token: string | null, persistent: boolean = false) => {
  if (token) {
    if (persistent) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const registerLogoutCallback = (cb: () => void) => {
  logoutCallback = cb;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 with Token Refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    // Handle backend cold-boot / transient 502/503 gateway errors from Vercel frontend
    const isNetworkOrGatewayError =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.response?.status === 502 ||
      error.response?.status === 503 ||
      error.response?.status === 504;

    const method = originalRequest?.method?.toLowerCase();
    const isRetryableEndpoint =
      method === 'get' ||
      originalRequest?.url?.includes('/api/auth/') ||
      originalRequest?.url?.includes('/api/admin/jobs/');

    if (originalRequest && isNetworkOrGatewayError && isRetryableEndpoint) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount <= 3) {
        const backoffMs = originalRequest._retryCount * 3000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return apiClient(originalRequest);
      }
    }

    // Avoid infinite loop if refresh endpoint itself failed or request already retried
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/refresh') &&
      !originalRequest.url?.includes('/api/auth/login')
    ) {
      const refreshToken = getStoredRefreshToken();

      if (!refreshToken) {
        setAccessToken(null);
        setStoredRefreshToken(null);
        if (logoutCallback) logoutCallback();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=true';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<ApiResponse<AuthResponseData>>(
          `${API_BASE_URL}/api/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const newAuth = refreshResponse.data.data;
        const wasPersistent = !!localStorage.getItem(REFRESH_TOKEN_KEY);
        setAccessToken(newAuth.accessToken);
        setStoredRefreshToken(newAuth.refreshToken, wasPersistent);

        processQueue(null, newAuth.accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAuth.accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        setStoredRefreshToken(null);
        if (logoutCallback) logoutCallback();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=true';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
