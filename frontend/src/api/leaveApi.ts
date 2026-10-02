import { apiClient } from './client';
import { ApiResponse, LeaveBalance, LeaveRequest, LeaveType, SubmitLeaveRequestDto } from '../types';

export const leaveApi = {
  getLeaveTypes: async (): Promise<LeaveType[]> => {
    const res = await apiClient.get<ApiResponse<LeaveType[]>>('/api/leave/types');
    return res.data.data;
  },

  getMyBalances: async (year?: number): Promise<LeaveBalance[]> => {
    const url = year ? `/api/leave/balances/me?year=${year}` : '/api/leave/balances/me';
    const res = await apiClient.get<ApiResponse<LeaveBalance[]>>(url);
    return res.data.data;
  },

  getUserBalances: async (userId: string, year?: number): Promise<LeaveBalance[]> => {
    const url = year ? `/api/leave/balances/user/${userId}?year=${year}` : `/api/leave/balances/user/${userId}`;
    const res = await apiClient.get<ApiResponse<LeaveBalance[]>>(url);
    return res.data.data;
  },

  getMyRequests: async (): Promise<LeaveRequest[]> => {
    const res = await apiClient.get<ApiResponse<LeaveRequest[]>>('/api/leave/requests/my-requests');
    return res.data.data;
  },

  getRequestById: async (id: string): Promise<LeaveRequest> => {
    const res = await apiClient.get<ApiResponse<LeaveRequest>>(`/api/leave/requests/${id}`);
    return res.data.data;
  },

  submitRequest: async (payload: SubmitLeaveRequestDto): Promise<LeaveRequest> => {
    const res = await apiClient.post<ApiResponse<LeaveRequest>>('/api/leave/requests', payload);
    return res.data.data;
  },

  getPendingApprovals: async (): Promise<LeaveRequest[]> => {
    const res = await apiClient.get<ApiResponse<LeaveRequest[]>>('/api/leave/requests/pending-approvals');
    return res.data.data;
  },

  approveRequest: async (id: string, comments?: string): Promise<LeaveRequest> => {
    const res = await apiClient.post<ApiResponse<LeaveRequest>>(`/api/leave/requests/${id}/approve`, { comments });
    return res.data.data;
  },

  rejectRequest: async (id: string, comments?: string): Promise<LeaveRequest> => {
    const res = await apiClient.post<ApiResponse<LeaveRequest>>(`/api/leave/requests/${id}/reject`, { comments });
    return res.data.data;
  },

  cancelRequest: async (id: string): Promise<LeaveRequest> => {
    const res = await apiClient.post<ApiResponse<LeaveRequest>>(`/api/leave/requests/${id}/cancel`);
    return res.data.data;
  },
};
