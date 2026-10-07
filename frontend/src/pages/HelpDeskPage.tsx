import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { helpdeskApi } from '../api/helpdeskApi';
import { 
  CreateTicketDto, 
  SupportQueue, 
  Ticket, 
  TicketCategory, 
  TicketComment, 
  TicketPriority, 
  TicketStatus 
} from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';

export const HelpDeskPage: React.FC = () => {
  const { user, hasRole } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [queues, setQueues] = useState<SupportQueue[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTicketDto>({
    categoryId: '',
    queueId: '',
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tData, cData, qData] = await Promise.all([
        helpdeskApi.getMyTickets(),
        helpdeskApi.getCategories(),
        helpdeskApi.getQueues(),
      ]);
      setTickets(tData);
      setCategories(cData);
      setQueues(qData);
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
      };
      if (createForm.queueId) {
        payload.queueId = createForm.queueId;
      }

      await helpdeskApi.createTicket(payload);
      setIsCreateModalOpen(false);
      setCreateForm({
        categoryId: categories[0]?.id || '',
        queueId: '',
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

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  const canPostInternalNotes = hasRole('SUPPORT_AGENT') || hasRole('HR_ADMIN');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Help Desk
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit IT and HR requests, communicate with support agents, and monitor incident SLA.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition"
        >
          New Ticket
        </button>
      </div>

      {actionAlert && (
        <Alert
          type={actionAlert.type}
          message={actionAlert.message}
          onClose={() => setActionAlert(null)}
        />
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {['ALL', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              statusFilter === st
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-semibold text-slate-900 text-sm">No tickets found</p>
            <p className="text-xs text-slate-500 mt-1">Have an issue? Click "New Ticket" to notify the support team.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => handleOpenDetail(t)}
                className="p-5 hover:bg-gray-50/70 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {t.ticketNumber}
                    </span>
                    <h3 className="font-semibold text-gray-900 text-base">{t.title}</h3>
                    <StatusBadge status={t.status} />
                    <StatusBadge priority={t.priority} />
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-1">{t.description}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Category: <strong>{t.categoryName || 'General'}</strong></span>
                    {t.queueName && <span>Queue: <strong>{t.queueName}</strong></span>}
                    {t.assignedAgentName ? (
                      <span className="text-indigo-600">Assigned: {t.assignedAgentName}</span>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-gray-400 flex flex-col items-end gap-1 flex-shrink-0">
                  <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                  {t.slaDueAt && (
                    <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Due {new Date(t.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={createForm.categoryId}
              onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Queue (Optional)
              </label>
              <select
                value={createForm.queueId || ''}
                onChange={(e) => setCreateForm({ ...createForm, queueId: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g., Cannot access VPN network, Payroll inquiry"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Describe the issue, error messages, and steps to reproduce..."
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingTicket}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs disabled:opacity-50 transition"
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
                <span className="text-xs text-gray-500">
                  Category: <strong>{selectedTicket.categoryName}</strong>
                </span>
                {selectedTicket.queueName && (
                  <span className="text-xs text-gray-500">
                    Queue: <strong>{selectedTicket.queueName}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900">{selectedTicket.title}</h2>
              <div className="mt-2 text-sm text-gray-700 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                {selectedTicket.description}
              </div>
            </div>

            {/* Requester & Assignee Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
              <div>
                <span className="text-gray-400 block">Requester:</span>
                <span className="font-semibold text-gray-800">
                  {selectedTicket.requesterName || user?.fullName}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Assigned Agent:</span>
                <span className="font-semibold text-indigo-700">
                  {selectedTicket.assignedAgentName || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* State Actions for Requester */}
            {selectedTicket.status === 'RESOLVED' && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
                <span className="text-sm font-semibold text-teal-900 block">
                  Support marked this issue as RESOLVED.
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCloseTicket}
                    className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-md text-xs font-medium"
                  >
                    Accept &amp; Close Ticket
                  </button>
                  <button
                    onClick={handleReopenTicket}
                    className="px-3 py-1.5 bg-white border border-teal-300 text-teal-800 hover:bg-teal-100 rounded-md text-xs font-medium"
                  >
                    Reopen (Issue Not Fixed)
                  </button>
                </div>
              </div>
            )}

            {/* Comments Thread */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Conversation Thread ({selectedTicket.comments?.length || 0})
              </h3>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                  <div className="text-xs text-gray-400 italic">No comments yet.</div>
                ) : (
                  selectedTicket.comments.map((c) => {
                    const isInternal = c.isInternalNote || c.isInternal;
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-lg text-xs ${
                          isInternal
                            ? 'bg-amber-50 border border-amber-200 text-amber-900'
                            : 'bg-slate-50 border border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold mb-1">
                          <span className="flex items-center gap-1.5">
                            {c.authorName}
                            {isInternal && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-800 font-bold uppercase">
                                Internal Note
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400">
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
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />

                  <div className="flex items-center justify-between">
                    {canPostInternalNotes ? (
                      <label className="flex items-center gap-1.5 text-xs text-amber-800 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        Internal agent note (hidden from employee)
                      </label>
                    ) : <div />}

                    <button
                      type="submit"
                      disabled={isPostingComment || !commentText.trim()}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition disabled:opacity-50"
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
