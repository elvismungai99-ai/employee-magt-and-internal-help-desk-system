import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse, AuthResponseData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Strictly In-Memory Access Token (never written to localStorage)
let inMemoryAccessToken: string | null = null;
let logoutCallback: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
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
    if (inMemoryAccessToken && config.headers) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
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

    // Handle Render free-tier cold-boot / network timeouts on login and auth requests
    const isNetworkOrTimeout = !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
    if (
      originalRequest &&
      isNetworkOrTimeout &&
      (originalRequest.url?.includes('/api/auth/login') || originalRequest.url?.includes('/api/auth/register'))
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount <= 2) {
        // Wait 3.5s for the sleeping Render container to finish waking up, then retry seamlessly
        await new Promise((resolve) => setTimeout(resolve, 3500));
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
        setAccessToken(newAuth.accessToken);
        setStoredRefreshToken(newAuth.refreshToken);

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
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
