import { apiClient } from './client';
import { ApiResponse, AuthResponseData, Department, UserProfile } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
  role?: string;
  roles?: string[];
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponseData> => {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/api/auth/login', payload);
    return res.data.data;
  },

  register: async (payload: RegisterPayload) => {
    const res = await apiClient.post<ApiResponse<any>>('/api/auth/register', payload);
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<AuthResponseData> => {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/api/auth/refresh', { refreshToken });
    return res.data.data;
  },

  logout: async (refreshToken?: string | null): Promise<void> => {
    try {
      await apiClient.post<ApiResponse<void>>('/api/auth/logout', { refreshToken });
    } catch {
      // Ignored if token invalid/expired, local state will still clear
    }
  },

  getCurrentUser: async (): Promise<UserProfile> => {
    const res = await apiClient.get<ApiResponse<UserProfile>>('/api/identity/users/me');
    return res.data.data;
  },

  getDepartments: async (): Promise<Department[]> => {
    const res = await apiClient.get<ApiResponse<Department[]>>('/api/identity/departments');
    return res.data.data;
  },
};
