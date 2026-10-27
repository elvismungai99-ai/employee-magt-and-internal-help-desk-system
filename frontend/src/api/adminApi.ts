import { apiClient } from './client';
import { 
  AccrualRunResult, 
  ApiResponse, 
  EventOutboxItem, 
  PageResponse, 
  SlaMonitorRunResult, 
  UserProfile,
  AuditLogItem,
  ExecutiveAnalyticsSummary
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

  triggerSlaMonitor: async (): Promise<SlaMonitorRunResult> => {
    const res = await apiClient.post<ApiResponse<SlaMonitorRunResult>>('/api/admin/jobs/sla-monitor/trigger', {});
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

  triggerYearEndCarryover: async (year?: number): Promise<any> => {
    const payload = year ? { year } : {};
    const res = await apiClient.post<ApiResponse<any>>('/api/admin/jobs/year-end-carryover/trigger', payload);
    return res.data.data;
  },

  triggerCarryoverExpiry: async (year?: number): Promise<any> => {
    const payload = year ? { year } : {};
    const res = await apiClient.post<ApiResponse<any>>('/api/admin/jobs/carryover-expiry/trigger', payload);
    return res.data.data;
  },

  exportLeaveBalancesCsv: async (year?: number): Promise<Blob> => {
    const url = year ? `/api/admin/reports/leave-balances/export-csv?year=${year}` : '/api/admin/reports/leave-balances/export-csv';
    const res = await apiClient.get(url, { responseType: 'blob' });
    return res.data;
  },

  exportDepartmentAbsencesCsv: async (year?: number): Promise<Blob> => {
    const url = year ? `/api/admin/reports/department-absences/export-csv?year=${year}` : '/api/admin/reports/department-absences/export-csv';
    const res = await apiClient.get(url, { responseType: 'blob' });
    return res.data;
  },

  exportLeaveLiabilityCsv: async (year?: number): Promise<Blob> => {
    const url = year ? `/api/admin/reports/leave-liability/export-csv?year=${year}` : '/api/admin/reports/leave-liability/export-csv';
    const res = await apiClient.get(url, { responseType: 'blob' });
    return res.data;
  },

  exportLeaveEncashmentCsv: async (year?: number): Promise<Blob> => {
    const url = year ? `/api/admin/reports/leave-encashment/export-csv?year=${year}` : '/api/admin/reports/leave-encashment/export-csv';
    const res = await apiClient.get(url, { responseType: 'blob' });
    return res.data;
  },

  getExecutiveSummary: async (): Promise<ExecutiveAnalyticsSummary> => {
    const res = await apiClient.get<ApiResponse<ExecutiveAnalyticsSummary>>('/api/admin/analytics/summary');
    return res.data.data;
  },

  getAuditLogs: async (params?: { action?: string; entityType?: string; actorEmail?: string; page?: number; size?: number }): Promise<PageResponse<AuditLogItem>> => {
    const query = new URLSearchParams();
    if (params?.action) query.append('action', params.action);
    if (params?.entityType) query.append('entityType', params.entityType);
    if (params?.actorEmail) query.append('actorEmail', params.actorEmail);
    query.append('page', String(params?.page ?? 0));
    query.append('size', String(params?.size ?? 20));
    const res = await apiClient.get<ApiResponse<PageResponse<AuditLogItem>>>(`/api/admin/audit-logs?${query.toString()}`);
    return res.data.data;
  },
};
