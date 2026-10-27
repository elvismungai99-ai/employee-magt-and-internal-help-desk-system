import { apiClient } from './client';
import {
  ApiResponse,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  SubmitLeaveRequestDto,
  DepartmentOverlapItem,
  CompOffRequest,
  SubmitCompOffRequestDto,
  LeaveEncashmentRequest,
  SubmitEncashmentRequestDto,
  TeamCapacityDay,
} from '../types';

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

  getAllRequests: async (): Promise<LeaveRequest[]> => {
    const res = await apiClient.get<ApiResponse<LeaveRequest[]>>('/api/leave/requests/all');
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

  // 1. Leave Attachment Upload
  uploadAttachment: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ApiResponse<{ attachmentUrl: string }>>('/api/leave/requests/upload-attachment', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.attachmentUrl;
  },

  // 3. Department Overlap Check
  getDepartmentOverlap: async (startDate: string, endDate: string, departmentId?: string): Promise<DepartmentOverlapItem[]> => {
    let url = `/api/leave/requests/department-overlap?startDate=${startDate}&endDate=${endDate}`;
    if (departmentId) url += `&departmentId=${departmentId}`;
    const res = await apiClient.get<ApiResponse<DepartmentOverlapItem[]>>(url);
    return res.data.data;
  },

  // 6. External Calendar (.ics) Download
  downloadCalendarIcs: async (requestId: string): Promise<Blob> => {
    const res = await apiClient.get(`/api/leave/requests/${requestId}/calendar.ics`, {
      responseType: 'blob',
    });
    return res.data;
  },

  // 4. Compensatory Off (Comp-Off)
  submitCompOff: async (payload: SubmitCompOffRequestDto): Promise<CompOffRequest> => {
    const res = await apiClient.post<ApiResponse<CompOffRequest>>('/api/leave/comp-off/request', payload);
    return res.data.data;
  },

  getMyCompOffRequests: async (): Promise<CompOffRequest[]> => {
    const res = await apiClient.get<ApiResponse<CompOffRequest[]>>('/api/leave/comp-off/my-requests');
    return res.data.data;
  },

  getPendingCompOffRequests: async (): Promise<CompOffRequest[]> => {
    const res = await apiClient.get<ApiResponse<CompOffRequest[]>>('/api/leave/comp-off/pending');
    return res.data.data;
  },

  getAllCompOffRequests: async (): Promise<CompOffRequest[]> => {
    const res = await apiClient.get<ApiResponse<CompOffRequest[]>>('/api/leave/comp-off/all');
    return res.data.data;
  },

  approveCompOff: async (id: string, comments?: string): Promise<CompOffRequest> => {
    const res = await apiClient.post<ApiResponse<CompOffRequest>>(`/api/leave/comp-off/${id}/approve`, { comments });
    return res.data.data;
  },

  rejectCompOff: async (id: string, comments?: string): Promise<CompOffRequest> => {
    const res = await apiClient.post<ApiResponse<CompOffRequest>>(`/api/leave/comp-off/${id}/reject`, { comments });
    return res.data.data;
  },

  // 8. Leave Encashment
  submitEncashment: async (payload: SubmitEncashmentRequestDto): Promise<LeaveEncashmentRequest> => {
    const res = await apiClient.post<ApiResponse<LeaveEncashmentRequest>>('/api/leave/encashment/request', payload);
    return res.data.data;
  },

  getMyEncashmentRequests: async (): Promise<LeaveEncashmentRequest[]> => {
    const res = await apiClient.get<ApiResponse<LeaveEncashmentRequest[]>>('/api/leave/encashment/my-requests');
    return res.data.data;
  },

  getPendingEncashmentRequests: async (): Promise<LeaveEncashmentRequest[]> => {
    const res = await apiClient.get<ApiResponse<LeaveEncashmentRequest[]>>('/api/leave/encashment/pending');
    return res.data.data;
  },

  getAllEncashmentRequests: async (): Promise<LeaveEncashmentRequest[]> => {
    const res = await apiClient.get<ApiResponse<LeaveEncashmentRequest[]>>('/api/leave/encashment/all');
    return res.data.data;
  },

  approveEncashment: async (id: string, comments?: string): Promise<LeaveEncashmentRequest> => {
    const res = await apiClient.post<ApiResponse<LeaveEncashmentRequest>>(`/api/leave/encashment/${id}/approve`, { comments });
    return res.data.data;
  },

  rejectEncashment: async (id: string, comments?: string): Promise<LeaveEncashmentRequest> => {
    const res = await apiClient.post<ApiResponse<LeaveEncashmentRequest>>(`/api/leave/encashment/${id}/reject`, { comments });
    return res.data.data;
  },

  getTeamCapacity: async (startDate: string, endDate: string, departmentId?: string): Promise<TeamCapacityDay[]> => {
    const params = new URLSearchParams({ startDate, endDate });
    if (departmentId) params.append('departmentId', departmentId);
    const res = await apiClient.get<ApiResponse<TeamCapacityDay[]>>(`/api/leave/requests/team-capacity?${params.toString()}`);
    return res.data.data;
  },

  downloadMyLeavesIcs: async (): Promise<void> => {
    const res = await apiClient.get('/api/leave/calendar/my-leaves.ics', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'my_approved_leaves.ics');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  downloadDepartmentLeavesIcs: async (): Promise<void> => {
    const res = await apiClient.get('/api/leave/calendar/department.ics', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'department_leaves.ics');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
