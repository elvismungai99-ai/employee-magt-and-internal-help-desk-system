import { apiClient } from './client';
import { ApiResponse, KnowledgeBaseArticle, CreateArticleDto } from '../types';

export const kbApi = {
  getArticles: async (query?: string, categoryId?: string): Promise<KnowledgeBaseArticle[]> => {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (categoryId) params.append('categoryId', categoryId);
    const res = await apiClient.get<ApiResponse<KnowledgeBaseArticle[]>>(`/api/helpdesk/kb?${params.toString()}`);
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },

  getDeflectionSuggestions: async (query: string): Promise<KnowledgeBaseArticle[]> => {
    if (!query || query.trim().length < 3) return [];
    const res = await apiClient.get<ApiResponse<KnowledgeBaseArticle[]>>(`/api/helpdesk/kb/deflection?query=${encodeURIComponent(query)}`);
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },

  getSuggestions: async (query: string): Promise<KnowledgeBaseArticle[]> => {
    return kbApi.getDeflectionSuggestions(query);
  },

  getArticleById: async (id: string, incrementView: boolean = true): Promise<KnowledgeBaseArticle> => {
    const res = await apiClient.get<ApiResponse<KnowledgeBaseArticle>>(`/api/helpdesk/kb/${id}?incrementView=${incrementView}`);
    return res.data.data;
  },

  voteHelpful: async (id: string): Promise<KnowledgeBaseArticle> => {
    const res = await apiClient.post<ApiResponse<KnowledgeBaseArticle>>(`/api/helpdesk/kb/${id}/vote`);
    return res.data.data;
  },

  createArticle: async (dto: CreateArticleDto): Promise<KnowledgeBaseArticle> => {
    const res = await apiClient.post<ApiResponse<KnowledgeBaseArticle>>('/api/helpdesk/kb', dto);
    return res.data.data;
  },

  updateArticle: async (id: string, dto: CreateArticleDto): Promise<KnowledgeBaseArticle> => {
    const res = await apiClient.put<ApiResponse<KnowledgeBaseArticle>>(`/api/helpdesk/kb/${id}`, dto);
    return res.data.data;
  },

  deleteArticle: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/helpdesk/kb/${id}`);
  },
};
