import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { helpdeskApi } from '../api/helpdeskApi';
import { leaveApi } from '../api/leaveApi';
import { 
  CreateTicketDto, 
  LeaveRequest,
  SupportQueue, 
  Ticket, 
  TicketCategory, 
  TicketComment, 
  TicketPriority, 
  TicketStatus 
} from '../types';
import { Search, Clock, AlertTriangle, Plus, Paperclip } from 'lucide-react';
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
  }, []);

  const handleOpenDetail = async (ticket: Ticket) => {
    try {
      const fullTicket = await helpdeskApi.getTicketById(ticket.id);
      setSelectedTicket(fullTicket);
      setIsDetailModalOpen(true);
    } catch {
      setSelectedTicket(ticket);
      setIsDetailModalOpen(true);
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

  const filteredTickets = tickets.filter((t) => {
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
        <span className="text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-rose-600" />
          <span>SLA Breached ({Math.abs(diffMinutes)}m ago)</span>
        </span>
      );
    }
    if (diffMinutes <= 120) {
      return (
        <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
          <Clock className="h-3 w-3 text-amber-600" />
          <span>Due Soon ({diffMinutes}m)</span>
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold text-[#0e4a5c] bg-[#e3f4f1] border border-teal-200 px-2 py-0.5 rounded flex items-center gap-1">
        <Clock className="h-3 w-3 text-teal-700" />
        <span>Due {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
    );
  };

  const canPostInternalNotes = hasRole('SUPPORT_AGENT') || hasRole('HR_ADMIN');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0d2836] tracking-tight">
            Help Desk
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit IT and HR requests, communicate with support agents, and monitor incident SLA.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl font-bold text-xs transition shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>New Ticket</span>
        </button>
      </div>

      {actionAlert && (
        <Alert
          type={actionAlert.type}
          message={actionAlert.message}
          onClose={() => setActionAlert(null)}
        />
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {['ALL', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl transition text-xs ${
                statusFilter === st
                  ? 'bg-[#0e4a5c] text-white font-bold shadow-2xs'
                  : 'bg-white border border-teal-200/90 text-slate-700 hover:text-[#0d2836] hover:bg-[#f0f9f8] font-medium'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by title, ID, or agent..."
            className="w-full sm:w-64 rounded-xl border border-teal-200/90 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-2xl border border-teal-100 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-bold text-[#0d2836] text-sm">No tickets found</p>
            <p className="text-xs text-slate-500 mt-1">Have an issue? Click "New Ticket" to notify the support team.</p>
          </div>
        ) : (
          <div className="divide-y divide-teal-50">
            {filteredTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => handleOpenDetail(t)}
                className="p-5 hover:bg-[#f6faf8] transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#0e4a5c] bg-[#e3f4f1] px-2 py-0.5 rounded border border-teal-200/70">
                      {t.ticketNumber}
                    </span>
                    <h3 className="font-bold text-[#0d2836] text-base">{t.title}</h3>
                    <StatusBadge status={t.status} />
                    <StatusBadge priority={t.priority} />
                    {renderSlaBadge(t)}
                    {t.leaveRequestSummary && (
                      <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                        Linked: {t.leaveRequestSummary}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-1">{t.description}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Category: <strong className="text-slate-800">{t.categoryName || 'General'}</strong></span>
                    {t.queueName && <span>Queue: <strong className="text-slate-800">{t.queueName}</strong></span>}
                    {t.assignedAgentName ? (
                      <span className="text-[#0e4a5c] font-semibold">Assigned: {t.assignedAgentName}</span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                    {(t.totalPausedMinutes ?? 0) > 0 && (
                      <span className="text-slate-500 text-[11px]">
                        Paused time: {t.totalPausedMinutes}m
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400 flex flex-col items-end gap-1 shrink-0">
                  <span className="font-medium text-slate-500">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                  {t.slaDueAt && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                      Target: {new Date(t.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <label className="block text-sm font-semibold text-slate-900 mb-1">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={createForm.categoryId}
              onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
              className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
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
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Queue (Optional)
              </label>
              <select
                value={createForm.queueId || ''}
                onChange={(e) => setCreateForm({ ...createForm, queueId: e.target.value })}
                className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
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
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Priority
              </label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })}
                className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
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
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Link to Leave Request <span className="text-slate-400 font-normal text-xs">(Optional &mdash; for leave or balance inquiries)</span>
              </label>
              <select
                value={createForm.leaveRequestId || ''}
                onChange={(e) => setCreateForm({ ...createForm, leaveRequestId: e.target.value })}
                className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
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
            <label className="block text-xs font-bold text-[#0d2836] mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g., Cannot access VPN network, Payroll inquiry"
              className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0d2836] mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Describe the issue, error messages, and steps to reproduce..."
              className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
            />
          </div>

          <div className="pt-4 border-t border-teal-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-teal-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-[#f0f9f8] transition"
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
                <span className="text-xs text-slate-500">
                  Category: <strong className="text-slate-800">{selectedTicket.categoryName}</strong>
                </span>
                {selectedTicket.queueName && (
                  <span className="text-xs text-slate-500">
                    Queue: <strong className="text-slate-800">{selectedTicket.queueName}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-[#0d2836]">{selectedTicket.title}</h2>
              <div className="mt-2 text-xs text-slate-700 bg-[#f8fbfb] p-3.5 rounded-xl border border-teal-100 whitespace-pre-wrap leading-relaxed">
                {selectedTicket.description}
              </div>
            </div>

            {/* Requester & Assignee Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 bg-[#f8fbfb] border border-teal-100 p-3 rounded-xl">
              <div>
                <span className="text-slate-400 text-[11px] block">Requester:</span>
                <span className="font-bold text-[#0d2836]">
                  {selectedTicket.requesterName || user?.fullName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Assigned Agent:</span>
                <span className="font-bold text-[#0e4a5c]">
                  {selectedTicket.assignedAgentName || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Linked Leave Request Card */}
            {selectedTicket.leaveRequestSummary && (
              <div className="rounded-xl border border-teal-200 bg-[#e3f4f1]/60 p-3.5 flex items-start gap-2">
                <div className="flex-1 text-xs">
                  <span className="font-bold text-[#0d2836]">Linked Leave Request: </span>
                  <span className="text-[#0e4a5c] font-semibold">{selectedTicket.leaveRequestSummary}</span>
                  <p className="text-[11px] text-[#155b6e] mt-0.5">
                    This support ticket is tied to your leave records for seamless HR coordination.
                  </p>
                </div>
              </div>
            )}

            {/* Waiting on Requester Banner */}
            {selectedTicket.status === 'PENDING_USER' && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 space-y-1">
                <span className="text-xs font-bold text-sky-900 block">
                  Action Required: Support is waiting on your response
                </span>
                <p className="text-xs text-sky-800">
                  The SLA clock is currently paused. Replying below with the requested info will automatically resume work.
                </p>
              </div>
            )}

            {/* State Actions for Requester */}
            {selectedTicket.status === 'RESOLVED' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <span className="text-sm font-semibold text-emerald-950 block">
                  Support marked this issue as RESOLVED.
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCloseTicket}
                    className="px-3.5 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    Accept &amp; Close Ticket
                  </button>
                  <button
                    onClick={handleReopenTicket}
                    className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition"
                  >
                    Reopen (Issue Not Fixed)
                  </button>
                </div>
              </div>
            )}

            {/* Attachments Section */}
            <div className="space-y-3 bg-[#f8fbfb] p-3.5 rounded-xl border border-teal-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#0d2836] uppercase tracking-wider">
                  Attachments ({selectedTicket.attachments?.length || 0})
                </h3>
              </div>

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedTicket.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-teal-100 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-slate-800 truncate">{att.fileName}</span>
                        <span className="text-[10px] text-slate-400">
                          ({Math.round(att.fileSizeBytes / 1024)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => helpdeskApi.downloadAttachment(selectedTicket.id, att.id, att.fileName)}
                        className="text-xs text-[#0e4a5c] hover:text-[#083543] font-bold px-2 py-1 rounded-lg bg-[#e3f4f1] hover:bg-teal-100 transition"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No attachments uploaded.</div>
              )}

              {selectedTicket.status !== 'CLOSED' && (
                <form onSubmit={handleUploadAttachment} className="flex items-center gap-2 pt-2 border-t border-teal-100">
                  <input
                    type="file"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300"
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
              <h3 className="text-sm font-bold text-[#0d2836]">
                Conversation Thread ({selectedTicket.comments?.length || 0})
              </h3>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                  <div className="text-xs text-slate-400 italic">No comments yet.</div>
                ) : (
                  selectedTicket.comments.map((c) => {
                    const isInternal = c.isInternalNote || c.isInternal;
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-xl text-xs ${
                          isInternal
                            ? 'bg-amber-50/80 border border-amber-200 text-amber-950'
                            : 'bg-white border border-teal-100 text-slate-900 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold mb-1">
                          <span className="flex items-center gap-1.5">
                            {c.authorName}
                            {isInternal && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 font-bold uppercase">
                                Internal Note
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400">
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
                <form onSubmit={handleAddComment} className="pt-2 space-y-2">
                  <textarea
                    rows={2}
                    required
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type a response or update..."
                    className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
                  />

                  <div className="flex items-center justify-between">
                    {canPostInternalNotes ? (
                      <label className="flex items-center gap-1.5 text-xs text-amber-900 font-medium cursor-pointer">
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
    </div>
  );
};
