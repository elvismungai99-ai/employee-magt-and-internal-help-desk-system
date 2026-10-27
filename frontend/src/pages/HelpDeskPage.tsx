import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { helpdeskApi } from '../api/helpdeskApi';
import { leaveApi } from '../api/leaveApi';
import { kbApi } from '../api/kbApi';
import { 
  CreateTicketDto, 
  LeaveRequest,
  SupportQueue, 
  Ticket, 
  TicketCategory, 
  TicketComment, 
  TicketPriority, 
  TicketStatus,
  KnowledgeBaseArticle
} from '../types';
import { Search, Clock, AlertTriangle, Plus, Paperclip, RefreshCw, BookOpen, ThumbsUp, Star, Sparkles, ExternalLink } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { TableSkeleton } from '../components/Skeleton';

export const HelpDeskPage: React.FC = () => {
  const { user, hasRole } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [queues, setQueues] = useState<SupportQueue[]>([]);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTicketDto>({
    categoryId: '',
    queueId: '',
    leaveRequestId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Ticket Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Close/Reopen modal state
  const [feedbackText, setFeedbackText] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Attachment upload state
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Tab & Knowledge Base (KB) State
  const [activeTab, setActiveTab] = useState<'TICKETS' | 'KB'>('TICKETS');
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [kbCategoryFilter, setKbCategoryFilter] = useState<string>('ALL');
  const [kbSearch, setKbSearch] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [suggestedDeflections, setSuggestedDeflections] = useState<KnowledgeBaseArticle[]>([]);

  // CSAT Rating State
  const [csatRating, setCsatRating] = useState<number>(5);
  const [csatFeedback, setCsatFeedback] = useState<string>('');
  const [isSubmittingCsat, setIsSubmittingCsat] = useState(false);

  const loadArticles = async () => {
    setIsLoadingArticles(true);
    try {
      const data = await kbApi.getArticles(
        kbSearch.trim() || undefined,
        kbCategoryFilter === 'ALL' ? undefined : kbCategoryFilter
      );
      setArticles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load KB articles', err);
      setArticles([]);
    } finally {
      setIsLoadingArticles(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tData, cData, qData, lData] = await Promise.all([
        helpdeskApi.getMyTickets(),
        helpdeskApi.getCategories(),
        helpdeskApi.getQueues(),
        leaveApi.getMyRequests().catch(() => []),
      ]);
      setTickets(tData);
      setCategories(cData);
      setQueues(qData);
      setMyLeaveRequests(lData);
      if (cData.length > 0 && !createForm.categoryId) {
        setCreateForm((prev) => ({ ...prev, categoryId: cData[0].id }));
      }
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load tickets.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadArticles();
  }, []);

  useEffect(() => {
    if (activeTab === 'KB') {
      loadArticles();
    }
  }, [kbCategoryFilter, kbSearch, activeTab]);

  // Real-time deflection suggestion search when user types ticket title
  useEffect(() => {
    const query = createForm.title.trim();
    if (query.length >= 3) {
      const timeout = setTimeout(async () => {
        try {
          const suggestions = await kbApi.getSuggestions(query);
          setSuggestedDeflections(suggestions.slice(0, 3));
        } catch {
          setSuggestedDeflections([]);
        }
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      setSuggestedDeflections([]);
    }
  }, [createForm.title]);

  const handleOpenDetail = async (ticket: Ticket) => {
    try {
      const fullTicket = await helpdeskApi.getTicketById(ticket.id);
      setSelectedTicket(fullTicket);
      setCsatRating(fullTicket.csatRating || 5);
      setCsatFeedback(fullTicket.csatFeedback || '');
      setIsDetailModalOpen(true);
    } catch {
      setSelectedTicket(ticket);
      setCsatRating(ticket.csatRating || 5);
      setCsatFeedback(ticket.csatFeedback || '');
      setIsDetailModalOpen(true);
    }
  };

  const handleVoteArticle = async (articleId: string) => {
    try {
      const updated = await kbApi.voteHelpful(articleId);
      setSelectedArticle(updated);
      setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActionAlert({ type: 'success', message: 'Thank you for your feedback!' });
    } catch (err: any) {
      setActionAlert({ type: 'error', message: 'Failed to record helpful vote.' });
    }
  };

  const handleSubmitCsat = async () => {
    if (!selectedTicket) return;
    setIsSubmittingCsat(true);
    try {
      const updated = await helpdeskApi.submitCsat(selectedTicket.id, csatRating, csatFeedback.trim());
      setSelectedTicket(updated);
      setActionAlert({
        type: 'success',
        message: 'Thank you! Your feedback helps us improve support quality.',
      });
      await loadData();
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit satisfaction rating.',
      });
    } finally {
      setIsSubmittingCsat(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsSubmittingTicket(true);

    try {
      const payload: CreateTicketDto = {
        categoryId: createForm.categoryId,
        title: createForm.title,
        description: createForm.description,
        priority: createForm.priority,
        leaveRequestId: createForm.leaveRequestId || undefined,
      };
      if (createForm.queueId) {
        payload.queueId = createForm.queueId;
      }

      await helpdeskApi.createTicket(payload);
      setIsCreateModalOpen(false);
      setCreateForm({
        categoryId: categories[0]?.id || '',
        queueId: '',
        leaveRequestId: '',
        title: '',
        description: '',
        priority: 'MEDIUM',
      });
      setActionAlert({
        type: 'success',
        message: 'Support ticket opened successfully. A confirmation event was dispatched.',
      });
      await loadData();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to open ticket.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !commentText.trim()) return;

    setIsPostingComment(true);
    try {
      await helpdeskApi.addComment(selectedTicket.id, commentText.trim(), isInternalNote);
      setCommentText('');
      setIsInternalNote(false);
      // Refresh detailed ticket comments
      const updated = await helpdeskApi.getTicketById(selectedTicket.id);
      setSelectedTicket(updated);
      await loadData();
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.message || 'Could not post comment.',
      });
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      const updated = await helpdeskApi.closeTicket(selectedTicket.id, feedbackText || undefined);
      setSelectedTicket(updated);
      setFeedbackText('');
      setActionAlert({ type: 'success', message: 'Ticket closed successfully.' });
      await loadData();
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to close ticket.',
      });
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;
    try {
      const updated = await helpdeskApi.reopenTicket(selectedTicket.id, reopenReason || undefined);
      setSelectedTicket(updated);
      setReopenReason('');
      setActionAlert({ type: 'success', message: 'Ticket reopened successfully.' });
      await loadData();
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to reopen ticket.',
      });
    }
  };

  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !attachmentFile) return;
    setIsUploadingAttachment(true);
    try {
      await helpdeskApi.uploadAttachment(selectedTicket.id, attachmentFile);
      setAttachmentFile(null);
      const refreshed = await helpdeskApi.getTicketById(selectedTicket.id);
      setSelectedTicket(refreshed);
      setActionAlert({ type: 'success', message: 'Attachment uploaded successfully.' });
    } catch (err: any) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload attachment.',
      });
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const filteredTickets = (Array.isArray(tickets) ? tickets : []).filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesStatus;
    const matchesQuery =
      t.title.toLowerCase().includes(q) ||
      t.ticketNumber.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      Boolean(t.categoryName && t.categoryName.toLowerCase().includes(q)) ||
      Boolean(t.assignedAgentName && t.assignedAgentName.toLowerCase().includes(q));
    return matchesStatus && matchesQuery;
  });

  const renderSlaBadge = (t: Ticket) => {
    if (t.status === 'PENDING_USER') {
      return (
        <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>SLA Paused (Waiting for Your Reply)</span>
        </span>
      );
    }
    if (!t.slaDueAt || t.status === 'RESOLVED' || t.status === 'CLOSED') {
      return null;
    }
    const dueDate = new Date(t.slaDueAt);
    const now = new Date();
    const diffMinutes = Math.round((dueDate.getTime() - now.getTime()) / 60000);

    if (diffMinutes < 0) {
      return (
        <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-2 py-0.5 rounded flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
          <span>SLA Breached ({Math.abs(diffMinutes)}m ago)</span>
        </span>
      );
    }
    if (diffMinutes <= 120) {
      return (
        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1">
          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>Due Soon ({diffMinutes}m)</span>
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold text-[#0e4a5c] dark:text-[#38bdf8] bg-[#e3f4f1] dark:bg-[rgba(14,74,92,0.4)] border border-teal-200 dark:border-[#1e3845] px-2 py-0.5 rounded flex items-center gap-1">
        <Clock className="h-3 w-3 text-teal-700 dark:text-[#38bdf8]" />
        <span>Due {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
    );
  };

  const canPostInternalNotes = hasRole('SUPPORT_AGENT') || hasRole('HR_ADMIN');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0d2836] dark:text-slate-100 tracking-tight">
            Help Desk
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Submit IT and HR requests, communicate with support agents, and monitor incident SLA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-teal-200 dark:border-[#1e3845] text-slate-800 dark:text-slate-200 bg-white dark:bg-[#11222b] hover:bg-[#f0f9f8] dark:hover:bg-[#162b36] rounded-xl text-xs font-bold transition shadow-2xs disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#0e4a5c] dark:text-[#38bdf8] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl font-bold text-xs transition shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {actionAlert && (
        <Alert
          type={actionAlert.type}
          message={actionAlert.message}
          onClose={() => setActionAlert(null)}
        />
      )}

      {/* Top View Selector: Tickets vs Knowledge Base */}
      <div className="flex items-center gap-3 border-b border-teal-100 dark:border-[#1e3845] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('TICKETS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'TICKETS'
              ? 'bg-[#0e4a5c] text-white shadow-xs'
              : 'bg-white dark:bg-[#11222b] text-slate-700 dark:text-slate-300 border border-teal-200/80 dark:border-[#1e3845] hover:bg-[#f0f9f8] dark:hover:bg-[#162b36]'
          }`}
        >
          <span>Support Tickets</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'TICKETS' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
            {tickets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('KB')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'KB'
              ? 'bg-[#0e4a5c] text-white shadow-xs'
              : 'bg-white dark:bg-[#11222b] text-slate-700 dark:text-slate-300 border border-teal-200/80 dark:border-[#1e3845] hover:bg-[#f0f9f8] dark:hover:bg-[#162b36]'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Knowledge Base &amp; Self-Service</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'KB' ? 'bg-white/20 text-white' : 'bg-[#e3f4f1] text-[#0e4a5c] dark:bg-[rgba(14,74,92,0.4)] dark:text-[#38bdf8] font-bold'}`}>
            {articles.length}
          </span>
        </button>
      </div>

      {activeTab === 'TICKETS' ? (
        <>
          {/* Filter Tabs and Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl transition text-xs cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#0e4a5c] text-white font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#11222b] border border-teal-200/90 dark:border-[#1e3845] text-slate-700 dark:text-slate-300 hover:text-[#0d2836] dark:hover:text-white hover:bg-[#f0f9f8] dark:hover:bg-[#162b36] font-medium'
                  }`}
                >
                  {(st || '').replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets by title, ID, or agent..."
                className="w-full sm:w-64 rounded-xl border border-teal-200/90 dark:border-[#1e3845] bg-white dark:bg-[#0d1b22] py-1.5 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8]"
              />
            </div>
          </div>

          {/* Tickets List */}
          <div className="bg-white dark:bg-[#11222b] rounded-2xl border border-teal-100 dark:border-[#1e3845] overflow-hidden shadow-2xs">
            {isLoading ? (
              <div className="p-6">
                <TableSkeleton rows={4} cols={5} />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <p className="font-bold text-[#0d2836] dark:text-slate-100 text-sm">No tickets found</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Have an issue? Click "New Ticket" to notify the support team.</p>
              </div>
            ) : (
              <div className="divide-y divide-teal-50 dark:divide-[#1e3845]">
                {filteredTickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleOpenDetail(t)}
                    className="p-5 hover:bg-[#f6faf8] dark:hover:bg-[#162b36] transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#0e4a5c] dark:text-[#38bdf8] bg-[#e3f4f1] dark:bg-[rgba(14,74,92,0.4)] px-2 py-0.5 rounded border border-teal-200/70 dark:border-[#1e3845]">
                          {t.ticketNumber}
                        </span>
                        <h3 className="font-bold text-[#0d2836] dark:text-slate-100 text-base">{t.title}</h3>
                        <StatusBadge status={t.status} />
                        <StatusBadge priority={t.priority} />
                        {renderSlaBadge(t)}
                        {t.csatRating && (
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                            <span>CSAT: {t.csatRating}/5</span>
                          </span>
                        )}
                        {t.leaveRequestSummary && (
                          <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 px-2 py-0.5 rounded">
                            Linked: {t.leaveRequestSummary}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">{t.description}</p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>Category: <strong className="text-slate-800 dark:text-slate-200">{t.categoryName || 'General'}</strong></span>
                        {t.queueName && <span>Queue: <strong className="text-slate-800 dark:text-slate-200">{t.queueName}</strong></span>}
                        {t.assignedAgentName ? (
                          <span className="text-[#0e4a5c] dark:text-[#38bdf8] font-semibold">Assigned: {t.assignedAgentName}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                        )}
                        {(t.totalPausedMinutes ?? 0) > 0 && (
                          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Paused time: {t.totalPausedMinutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400 dark:text-slate-500 flex flex-col items-end gap-1 shrink-0">
                      <span className="font-medium text-slate-500 dark:text-slate-400">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                      {t.slaDueAt && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-50 dark:bg-[#0e1c24] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#1e3845]">
                          Target: {new Date(t.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Knowledge Base View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'LEAVE_POLICY', 'BENEFITS', 'IT_SUPPORT', 'PAYROLL'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setKbCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl transition text-xs cursor-pointer ${
                    kbCategoryFilter === cat
                      ? 'bg-[#0e4a5c] text-white font-bold shadow-2xs'
                      : 'bg-white dark:bg-[#11222b] border border-teal-200/90 dark:border-[#1e3845] text-slate-700 dark:text-slate-300 hover:text-[#0d2836] dark:hover:text-white hover:bg-[#f0f9f8] dark:hover:bg-[#162b36] font-medium'
                  }`}
                >
                  {(cat || '').replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                placeholder="Search articles & guides..."
                className="w-full sm:w-64 rounded-xl border border-teal-200/90 dark:border-[#1e3845] bg-white dark:bg-[#0d1b22] py-1.5 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8]"
              />
            </div>
          </div>

          {isLoadingArticles ? (
            <div className="p-8 bg-white dark:bg-[#11222b] rounded-2xl border border-teal-100 dark:border-[#1e3845]">
              <TableSkeleton rows={3} cols={3} />
            </div>
          ) : articles.length === 0 ? (
            <div className="bg-white dark:bg-[#11222b] rounded-2xl border border-teal-100 dark:border-[#1e3845] p-12 text-center text-slate-500 dark:text-slate-400">
              <BookOpen className="h-8 w-8 mx-auto text-teal-600 mb-2 opacity-50" />
              <p className="font-bold text-[#0d2836] dark:text-slate-100 text-sm">No articles match your criteria</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try another search keyword or select ALL categories.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((art) => (
                <div
                  key={art.id}
                  onClick={() => {
                    setSelectedArticle(art);
                    setIsArticleModalOpen(true);
                  }}
                  className="bg-white dark:bg-[#11222b] rounded-2xl border border-teal-100 dark:border-[#1e3845] p-5 hover:border-teal-400 dark:hover:border-teal-600 transition shadow-2xs hover:shadow-sm cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#0e4a5c] dark:text-[#38bdf8] bg-[#e3f4f1] dark:bg-[rgba(14,74,92,0.4)] px-2 py-0.5 rounded border border-teal-200/70 dark:border-[#1e3845]">
                        {((art.categoryName || (art as any).category || 'General') as string).replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {art.helpfulCount || (art as any).helpfulVotes || 0}
                      </span>
                    </div>
                    <h3 className="font-bold text-[#0d2836] dark:text-slate-100 text-sm line-clamp-1">
                      {art.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                      {art.content}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-teal-50 dark:border-[#1e3845] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {art.viewCount || 0} views
                    </span>
                    <span className="text-xs font-bold text-[#0e4a5c] dark:text-[#38bdf8] hover:underline flex items-center gap-1">
                      Read Guide &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Open Support Ticket"
        maxWidth="lg"
      >
        {createError && (
          <Alert
            type="error"
            message={createError}
            className="mb-4"
            onClose={() => setCreateError(null)}
          />
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={createForm.categoryId}
              onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
              className="block w-full px-3 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8] focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0d2836] dark:text-slate-100 mb-1">
                Queue (Optional)
              </label>
              <select
                value={createForm.queueId || ''}
                onChange={(e) => setCreateForm({ ...createForm, queueId: e.target.value })}
                className="block w-full px-3 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8] focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100"
              >
                <option value="">Auto-Route via Taxonomy</option>
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0d2836] dark:text-slate-100 mb-1">
                Priority
              </label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })}
                className="block w-full px-3 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8] focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {/* Optional Link to Leave Request */}
          {myLeaveRequests.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-[#0d2836] dark:text-slate-100 mb-1">
                Link to Leave Request <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">(Optional &mdash; for leave or balance inquiries)</span>
              </label>
              <select
                value={createForm.leaveRequestId || ''}
                onChange={(e) => setCreateForm({ ...createForm, leaveRequestId: e.target.value })}
                className="block w-full px-3 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8] focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100"
              >
                <option value="">-- No linked leave request --</option>
                {myLeaveRequests.map((lr) => (
                  <option key={lr.id} value={lr.id}>
                    {lr.leaveTypeName || lr.leaveTypeCode || 'Leave'} ({lr.startDate} to {lr.endDate}) &mdash; {lr.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#0d2836] dark:text-slate-100 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g., Cannot access VPN network, Payroll inquiry"
              className="block w-full px-3 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] dark:focus:border-[#38bdf8] focus:border-[#0e4a5c] dark:focus:ring-[#38bdf8] bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Real-time Pre-submission Self-Service Deflection */}
          {suggestedDeflections.length > 0 && (
            <div className="rounded-xl border border-teal-300 dark:border-teal-700 bg-[#f0f9f8] dark:bg-[rgba(14,74,92,0.3)] p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0e4a5c] dark:text-[#38bdf8]">
                <Sparkles className="h-4 w-4" />
                <span>Instant Self-Help: Do any of these articles solve your issue?</span>
              </div>
              <div className="space-y-1.5">
                {suggestedDeflections.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => {
                      setSelectedArticle(art);
                      setIsArticleModalOpen(true);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-white dark:bg-[#11222b] hover:bg-teal-50 dark:hover:bg-[#162b36] border border-teal-200 dark:border-[#1e3845] text-xs transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex-1 pr-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-[#0e4a5c] dark:group-hover:text-[#38bdf8]">
                        {art.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {art.content}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#0e4a5c] dark:text-[#38bdf8] shrink-0 flex items-center gap-1">
                      Read <ExternalLink className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#0d2836] dark:text-slate-100 mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Describe the issue, error messages, and steps to reproduce..."
              className="block w-full px-3 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8] focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="pt-4 border-t border-teal-100 dark:border-[#1e3845] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#f0f9f8] dark:hover:bg-[#162b36] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingTicket}
              className="px-5 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition"
            >
              {isSubmittingTicket ? 'Opening...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Ticket ${selectedTicket.ticketNumber}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Header info */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusBadge status={selectedTicket.status} />
                <StatusBadge priority={selectedTicket.priority} />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Category: <strong className="text-slate-800 dark:text-slate-200">{selectedTicket.categoryName}</strong>
                </span>
                {selectedTicket.queueName && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Queue: <strong className="text-slate-800 dark:text-slate-200">{selectedTicket.queueName}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-[#0d2836] dark:text-slate-100">{selectedTicket.title}</h2>
              <div className="mt-2 text-xs text-slate-700 dark:text-slate-200 bg-[#f8fbfb] dark:bg-[#0e1c24] p-3.5 rounded-xl border border-teal-100 dark:border-[#1e3845] whitespace-pre-wrap leading-relaxed">
                {selectedTicket.description}
              </div>
            </div>

            {/* Requester & Assignee Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300 bg-[#f8fbfb] dark:bg-[#0e1c24] border border-teal-100 dark:border-[#1e3845] p-3 rounded-xl">
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Requester:</span>
                <span className="font-bold text-[#0d2836] dark:text-slate-100">
                  {selectedTicket.requesterName || user?.fullName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Assigned Agent:</span>
                <span className="font-bold text-[#0e4a5c] dark:text-[#38bdf8]">
                  {selectedTicket.assignedAgentName || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Linked Leave Request Card */}
            {selectedTicket.leaveRequestSummary && (
              <div className="rounded-xl border border-teal-200 dark:border-[#1e3845] bg-[#e3f4f1]/60 dark:bg-[rgba(14,74,92,0.4)] p-3.5 flex items-start gap-2">
                <div className="flex-1 text-xs">
                  <span className="font-bold text-[#0d2836] dark:text-slate-100">Linked Leave Request: </span>
                  <span className="text-[#0e4a5c] dark:text-[#38bdf8] font-semibold">{selectedTicket.leaveRequestSummary}</span>
                  <p className="text-[11px] text-[#155b6e] dark:text-teal-300 mt-0.5">
                    This support ticket is tied to your leave records for seamless HR coordination.
                  </p>
                </div>
              </div>
            )}

            {/* Waiting on Requester Banner */}
            {selectedTicket.status === 'PENDING_USER' && (
              <div className="rounded-xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 p-3.5 space-y-1">
                <span className="text-xs font-bold text-sky-900 dark:text-sky-200 block">
                  Action Required: Support is waiting on your response
                </span>
                <p className="text-xs text-sky-800 dark:text-sky-300">
                  The SLA clock is currently paused. Replying below with the requested info will automatically resume work.
                </p>
              </div>
            )}

            {/* State Actions for Requester */}
            {selectedTicket.status === 'RESOLVED' && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 space-y-3">
                <span className="text-sm font-semibold text-emerald-950 dark:text-emerald-200 block">
                  Support marked this issue as RESOLVED.
                </span>
                <input
                  type="text"
                  value={feedbackText || reopenReason}
                  onChange={(e) => {
                    setFeedbackText(e.target.value);
                    setReopenReason(e.target.value);
                  }}
                  placeholder="Optional feedback or reason if reopening..."
                  className="block w-full px-3 py-1.5 border border-emerald-200 dark:border-emerald-700/60 rounded-lg text-xs bg-white dark:bg-[#0d1b22] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#0e4a5c] dark:focus:border-[#38bdf8]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseTicket}
                    className="px-3.5 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    Accept &amp; Close Ticket
                  </button>
                  <button
                    type="button"
                    onClick={handleReopenTicket}
                    className="px-3.5 py-1.5 bg-white dark:bg-[#11222b] border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Reopen (Issue Not Fixed)
                  </button>
                </div>
              </div>
            )}

            {/* Customer Satisfaction (CSAT) Survey */}
            {(selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED') && (
              <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider">
                      Support Satisfaction (CSAT)
                    </span>
                  </div>
                  {selectedTicket.csatRating && (
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                      Rating Submitted
                    </span>
                  )}
                </div>

                {selectedTicket.csatRating ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= (selectedTicket.csatRating || 0)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-[#0d2836] dark:text-slate-100 ml-1.5">
                        {selectedTicket.csatRating} / 5
                      </span>
                    </div>
                    {selectedTicket.csatFeedback && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                        "{selectedTicket.csatFeedback}"
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      How satisfied are you with the resolution of this issue?
                    </p>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setCsatRating(rating)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            csatRating >= rating
                              ? 'border-amber-400 bg-amber-100/60 dark:bg-amber-900/40 text-amber-500'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11222b] text-slate-300 dark:text-slate-600 hover:text-amber-400'
                          }`}
                        >
                          <Star className={`h-4 w-4 ${csatRating >= rating ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">
                        {csatRating === 5 ? 'Excellent (5/5)' : csatRating === 4 ? 'Good (4/5)' : csatRating === 3 ? 'Average (3/5)' : csatRating === 2 ? 'Poor (2/5)' : 'Very Poor (1/5)'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={csatFeedback}
                        onChange={(e) => setCsatFeedback(e.target.value)}
                        placeholder="Optional feedback on agent response or resolution..."
                        className="flex-1 px-3 py-1.5 border border-amber-200 dark:border-amber-700/60 rounded-xl text-xs bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#0e4a5c]"
                      />
                      <button
                        type="button"
                        onClick={handleSubmitCsat}
                        disabled={isSubmittingCsat}
                        className="px-3.5 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingCsat ? 'Submitting...' : 'Submit Rating'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attachments Section */}
            <div className="space-y-3 bg-[#f8fbfb] dark:bg-[#0e1c24] p-3.5 rounded-xl border border-teal-100 dark:border-[#1e3845]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#0d2836] dark:text-slate-200 uppercase tracking-wider">
                  Attachments ({selectedTicket.attachments?.length || 0})
                </h3>
              </div>

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedTicket.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#11222b] border border-teal-100 dark:border-[#1e3845] text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.fileName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          ({Math.round(att.fileSizeBytes / 1024)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => helpdeskApi.downloadAttachment(selectedTicket.id, att.id, att.fileName)}
                        className="text-xs text-[#0e4a5c] dark:text-[#38bdf8] hover:text-[#083543] dark:hover:text-[#7dd3fc] font-bold px-2 py-1 rounded-lg bg-[#e3f4f1] dark:bg-[rgba(14,74,92,0.4)] hover:bg-teal-100 dark:hover:bg-[rgba(14,74,92,0.6)] transition"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 italic">No attachments uploaded.</div>
              )}

              {selectedTicket.status !== 'CLOSED' && (
                <form onSubmit={handleUploadAttachment} className="flex items-center gap-2 pt-2 border-t border-teal-100 dark:border-[#1e3845]">
                  <input
                    type="file"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-[#192f3b] file:text-slate-800 dark:file:text-slate-200 hover:file:bg-slate-300 dark:hover:file:bg-[#244655]"
                  />
                  <button
                    type="submit"
                    disabled={isUploadingAttachment || !attachmentFile}
                    className="px-3 py-1 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-bold rounded-xl disabled:opacity-50 transition shrink-0 shadow-xs"
                  >
                    {isUploadingAttachment ? 'Uploading...' : 'Upload'}
                  </button>
                </form>
              )}
            </div>

            {/* Comments Thread */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#0d2836] dark:text-slate-100">
                Conversation Thread ({selectedTicket.comments?.length || 0})
              </h3>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic">No comments yet.</div>
                ) : (
                  selectedTicket.comments.map((c) => {
                    const isInternal = c.isInternalNote || c.isInternal;
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-xl text-xs ${
                          isInternal
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
                            : 'bg-white dark:bg-[#11222b] border border-teal-100 dark:border-[#1e3845] text-slate-900 dark:text-slate-100 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold mb-1">
                          <span className="flex items-center gap-1.5">
                            {c.authorName}
                            {isInternal && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold uppercase">
                                Internal Note
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{c.content}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment Input */}
              {selectedTicket.status !== 'CLOSED' && (
                <form onSubmit={handleAddComment} className="pt-2 space-y-2 border-t border-teal-100 dark:border-[#1e3845]">
                  <textarea
                    rows={2}
                    required
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type a response or update..."
                    className="block w-full px-3 py-2 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] dark:focus:ring-[#38bdf8] focus:border-[#0e4a5c] dark:focus:border-[#38bdf8] bg-white dark:bg-[#0d1b22] text-[#0d2836] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />

                  <div className="flex items-center justify-between">
                    {canPostInternalNotes ? (
                      <label className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-300 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded text-[#0e4a5c] focus:ring-[#0e4a5c]"
                        />
                        Internal agent note (hidden from employee)
                      </label>
                    ) : <div />}

                    <button
                      type="submit"
                      disabled={isPostingComment || !commentText.trim()}
                      className="px-4 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-xs"
                    >
                      {isPostingComment ? 'Posting...' : 'Send Message'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Knowledge Base Article Modal */}
      {selectedArticle && (
        <Modal
          isOpen={isArticleModalOpen}
          onClose={() => setIsArticleModalOpen(false)}
          title={selectedArticle.title}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs pb-3 border-b border-teal-100 dark:border-[#1e3845]">
              <span className="font-bold text-[#0e4a5c] dark:text-[#38bdf8] bg-[#e3f4f1] dark:bg-[rgba(14,74,92,0.4)] px-2.5 py-0.5 rounded border border-teal-200/70 dark:border-[#1e3845]">
                {((selectedArticle.categoryName || (selectedArticle as any).category || 'General') as string).replace(/_/g, ' ')}
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                {selectedArticle.viewCount || 0} views
              </span>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto pr-2 bg-[#fafcfb] dark:bg-[#0d1b22] p-4 rounded-xl border border-teal-100/70 dark:border-[#1e3845]">
              {selectedArticle.content}
            </div>

            <div className="pt-3 border-t border-teal-100 dark:border-[#1e3845] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Was this article helpful?</span>
                <button
                  type="button"
                  onClick={() => handleVoteArticle(selectedArticle.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e3f4f1] dark:bg-[rgba(14,74,92,0.4)] hover:bg-teal-100 dark:hover:bg-[rgba(14,74,92,0.6)] text-[#0e4a5c] dark:text-[#38bdf8] border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span>Yes ({selectedArticle.helpfulVotes || 0})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsArticleModalOpen(false)}
                className="px-4 py-1.5 border border-teal-200 dark:border-[#1e3845] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#f0f9f8] dark:hover:bg-[#162b36] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
