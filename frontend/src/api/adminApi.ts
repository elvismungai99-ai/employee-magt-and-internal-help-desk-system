import { apiClient } from './client';
import { 
  AccrualRunResult, 
  ApiResponse, 
  EventOutboxItem, 
  PageResponse, 
  SlaMonitorRunResult, 
  UserProfile 
} from '../types';

export const adminApi = {
  getLastAccrualRun: async (): Promise<AccrualRunResult> => {
    const res = await apiClient.get<ApiResponse<AccrualRunResult>>('/api/admin/jobs/accrual/last-run');
    return res.data.data;
  },

  getLastSlaMonitorRun: async (): Promise<SlaMonitorRunResult> => {
    const res = await apiClient.get<ApiResponse<SlaMonitorRunResult>>('/api/admin/jobs/sla-monitor/last-run');
    return res.data.data;
  },

  getOutboxEvents: async (page = 0, size = 20, status?: string): Promise<PageResponse<EventOutboxItem>> => {
    let url = `/api/admin/events?page=${page}&size=${size}`;
    if (status) {
      url += `&status=${status}`;
    }
    const res = await apiClient.get<ApiResponse<PageResponse<EventOutboxItem>>>(url);
    return res.data.data;
  },

  triggerAccrual: async (year?: number, month?: number): Promise<AccrualRunResult> => {
    const payload = (year && month) ? { year, month } : {};
    const res = await apiClient.post<ApiResponse<AccrualRunResult>>('/api/admin/jobs/accrual/trigger', payload);
    return res.data.data;
  },

  getAllUsers: async (): Promise<UserProfile[]> => {
    const res = await apiClient.get<ApiResponse<UserProfile[]>>('/api/identity/users');
    return res.data.data;
  },

  assignManager: async (employeeId: string, managerId: string, relationshipType = 'DIRECT'): Promise<any> => {
    const res = await apiClient.post<ApiResponse<any>>('/api/identity/hierarchy/assign', {
      employeeId,
      managerId,
      relationshipType,
    });
    return res.data.data;
  },

  getPendingApprovals: async (): Promise<UserProfile[]> => {
    const res = await apiClient.get<ApiResponse<UserProfile[]>>('/api/identity/users/pending-approvals');
    return res.data.data;
  },

  approveUser: async (id: string, managerId?: string, departmentId?: string): Promise<UserProfile> => {
    const res = await apiClient.post<ApiResponse<UserProfile>>(`/api/identity/users/${id}/approve`, {
      managerId,
      departmentId,
    });
    return res.data.data;
  },

  rejectUser: async (id: string, reason?: string): Promise<UserProfile> => {
    const res = await apiClient.post<ApiResponse<UserProfile>>(`/api/identity/users/${id}/reject`, {
      reason,
    });
    return res.data.data;
  },
};
