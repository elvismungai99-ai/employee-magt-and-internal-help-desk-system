import { apiClient } from './client';
import { 
  ApiResponse, 
  CreateTicketDto, 
  SupportQueue, 
  Ticket, 
  TicketCategory, 
  TicketComment 
} from '../types';

export const helpdeskApi = {
  getCategories: async (): Promise<TicketCategory[]> => {
    const res = await apiClient.get<ApiResponse<TicketCategory[]>>('/api/helpdesk/categories');
    return res.data.data;
  },

  getQueues: async (): Promise<SupportQueue[]> => {
    const res = await apiClient.get<ApiResponse<SupportQueue[]>>('/api/helpdesk/queues');
    return res.data.data;
  },

  getMyTickets: async (): Promise<Ticket[]> => {
    const res = await apiClient.get<ApiResponse<Ticket[]>>('/api/helpdesk/tickets/my-tickets');
    return res.data.data;
  },

  getQueueTickets: async (queueId?: string): Promise<Ticket[]> => {
    const url = queueId ? `/api/helpdesk/tickets/queue?queueId=${queueId}` : '/api/helpdesk/tickets/queue';
    const res = await apiClient.get<ApiResponse<Ticket[]>>(url);
    return res.data.data;
  },

  getTicketById: async (id: string): Promise<Ticket> => {
    const res = await apiClient.get<ApiResponse<Ticket>>(`/api/helpdesk/tickets/${id}`);
    return res.data.data;
  },

  createTicket: async (payload: CreateTicketDto): Promise<Ticket> => {
    const res = await apiClient.post<ApiResponse<Ticket>>('/api/helpdesk/tickets', payload);
    return res.data.data;
  },

  assignTicket: async (id: string, agentUserId: string, reason?: string): Promise<Ticket> => {
    const res = await apiClient.post<ApiResponse<Ticket>>(`/api/helpdesk/tickets/${id}/assign`, {
      agentUserId,
      reason,
    });
    return res.data.data;
  },

  addComment: async (id: string, content: string, isInternalNote: boolean): Promise<TicketComment> => {
    const res = await apiClient.post<ApiResponse<TicketComment>>(`/api/helpdesk/tickets/${id}/comments`, {
      content,
      isInternalNote,
    });
    return res.data.data;
  },

  resolveTicket: async (id: string, resolutionNotes?: string): Promise<Ticket> => {
    const res = await apiClient.post<ApiResponse<Ticket>>(`/api/helpdesk/tickets/${id}/resolve`, {
      resolutionNotes,
    });
    return res.data.data;
  },

  closeTicket: async (id: string, feedback?: string): Promise<Ticket> => {
    const res = await apiClient.post<ApiResponse<Ticket>>(`/api/helpdesk/tickets/${id}/close`, {
      feedback,
    });
    return res.data.data;
  },

  reopenTicket: async (id: string, reason?: string): Promise<Ticket> => {
    const res = await apiClient.post<ApiResponse<Ticket>>(`/api/helpdesk/tickets/${id}/reopen`, {
      reason,
    });
    return res.data.data;
  },
};
