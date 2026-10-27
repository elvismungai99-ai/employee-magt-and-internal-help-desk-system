import { apiClient } from './client';
import { ApiResponse, CannedResponse, CreateCannedResponseDto } from '../types';

export const cannedResponseApi = {
  getAll: async (): Promise<CannedResponse[]> => {
    const res = await apiClient.get<ApiResponse<CannedResponse[]>>('/api/helpdesk/canned-responses');
    return res.data.data;
  },

  create: async (dto: CreateCannedResponseDto): Promise<CannedResponse> => {
    const res = await apiClient.post<ApiResponse<CannedResponse>>('/api/helpdesk/canned-responses', dto);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/helpdesk/canned-responses/${id}`);
  },
};
