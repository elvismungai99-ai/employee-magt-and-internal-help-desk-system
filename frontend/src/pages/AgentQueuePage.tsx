import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { helpdeskApi } from '../api/helpdeskApi';
import { SupportQueue, Ticket, TicketPriority, TicketStatus } from '../types';
import { Search, Clock, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { TableSkeleton } from '../components/Skeleton';

export const AgentQueuePage: React.FC = () => {
  const { user } = useAuth();

  const [queues, setQueues] = useState<SupportQueue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Detail & Action Modal state
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Resolve Modal State
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Page alert
  const [pageAlert, setPageAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadQueuesAndTickets = async () => {
    setIsLoading(true);
    try {
      const qList = await helpdeskApi.getQueues();
      setQueues(qList);

      const tList = await helpdeskApi.getQueueTickets(selectedQueueId || undefined);
      setTickets(tList);
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load support queues.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueuesAndTickets();
  }, [selectedQueueId]);

  const handleAssignToMe = async (ticket: Ticket) => {
    if (!user) return;
    try {
      const reason = ticket.assignedAgentId || ticket.assigneeId ? 'MANUAL_REASSIGN' : 'INITIAL_TRIAGE';
      await helpdeskApi.assignTicket(ticket.id, user.id, reason);
      setPageAlert({
        type: 'success',
        message: `Ticket ${ticket.ticketNumber} assigned to you.`,
      });
      await loadQueuesAndTickets();
      if (activeTicket?.id === ticket.id) {
        const updated = await helpdeskApi.getTicketById(ticket.id);
        setActiveTicket(updated);
      }
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to assign ticket.',
      });
    }
  };

  const handleOpenResolveModal = (ticket: Ticket) => {
    setActiveTicket(ticket);
    setResolutionNotes('');
    setIsResolveModalOpen(true);
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setIsResolving(true);
    try {
      await helpdeskApi.resolveTicket(activeTicket.id, resolutionNotes);
      setIsResolveModalOpen(false);
      setPageAlert({
        type: 'success',
        message: `Ticket ${activeTicket.ticketNumber} marked as RESOLVED.`,
      });
      await loadQueuesAndTickets();
      if (isDetailModalOpen) {
        const updated = await helpdeskApi.getTicketById(activeTicket.id);
        setActiveTicket(updated);
      }
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to resolve ticket.',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleOpenDetail = async (ticket: Ticket) => {
    try {
      const fullTicket = await helpdeskApi.getTicketById(ticket.id);
      setActiveTicket(fullTicket);
      setIsDetailModalOpen(true);
    } catch {
      setActiveTicket(ticket);
      setIsDetailModalOpen(true);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !commentText.trim()) return;

    setIsPostingComment(true);
    try {
      await helpdeskApi.addComment(activeTicket.id, commentText.trim(), isInternalNote);
      setCommentText('');
      setIsInternalNote(false);
      const updated = await helpdeskApi.getTicketById(activeTicket.id);
      setActiveTicket(updated);
      await loadQueuesAndTickets();
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to post comment.',
      });
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleToggleWaitOnUser = async () => {
    if (!activeTicket) return;
    const newStatus = activeTicket.status === 'PENDING_USER' ? 'IN_PROGRESS' : 'PENDING_USER';
    try {
      await helpdeskApi.updateStatus(activeTicket.id, newStatus);
      setPageAlert({
        type: 'success',
        message: newStatus === 'PENDING_USER'
          ? `Ticket ${activeTicket.ticketNumber} marked as PENDING_USER (SLA resolution clock paused).`
          : `Ticket ${activeTicket.ticketNumber} resumed to IN_PROGRESS (SLA clock running).`,
      });
      await loadQueuesAndTickets();
      const updated = await helpdeskApi.getTicketById(activeTicket.id);
      setActiveTicket(updated);
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update ticket status.',
      });
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
      Boolean(t.requesterName && t.requesterName.toLowerCase().includes(q)) ||
      Boolean(t.assignedAgentName && t.assignedAgentName.toLowerCase().includes(q));
    return matchesStatus && matchesQuery;
  });

  const renderSlaBadge = (t: Ticket) => {
    if (t.status === 'PENDING_USER') {
      return (
        <span className="text-[11px] font-bold text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>SLA PAUSED (Awaiting Requester)</span>
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
          <span>SLA BREACHED ({Math.abs(diffMinutes)}m ago)</span>
        </span>
      );
    }
    if (diffMinutes <= 120) {
      return (
        <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
          <Clock className="h-3 w-3 text-amber-600" />
          <span>Due soon ({diffMinutes}m)</span>
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold text-[#0e4a5c] bg-[#e3f4f1] border border-teal-200 px-2 py-0.5 rounded flex items-center gap-1">
        <Clock className="h-3 w-3 text-teal-700" />
        <span>Target: {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0d2836] tracking-tight">
            Support Agent Queue
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Triage incoming support requests, manage SLA timelines, post internal notes, and resolve incidents.
          </p>
        </div>

        {/* Queue Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[#0d2836] uppercase tracking-wider">
            Queue:
          </label>
          <select
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            className="px-3 py-2 border border-teal-200 rounded-xl text-xs bg-white font-semibold focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] text-[#0d2836]"
          >
            <option value="">All Assigned Queues</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pageAlert && (
        <Alert
          type={pageAlert.type}
          message={pageAlert.message}
          onClose={() => setPageAlert(null)}
        />
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {['ALL', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
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
            placeholder="Search tickets by subject, requester, or ID..."
            className="w-full sm:w-64 rounded-xl border border-teal-200/90 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
          />
        </div>
      </div>

      {/* Tickets Board */}
      <div className="bg-white rounded-2xl border border-teal-100 overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-teal-50 flex items-center justify-between bg-[#fafcfb]">
          <span className="font-bold text-[#0d2836] text-sm">
            Tickets in Queue ({filteredTickets.length})
          </span>
          <button
            onClick={loadQueuesAndTickets}
            className="inline-flex items-center gap-1 text-xs text-[#0e4a5c] hover:text-[#083543] font-bold transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-bold text-[#0d2836] text-sm">No tickets in queue</p>
            <p className="text-xs text-slate-500 mt-1">No pending tickets match the selected queue or status filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-teal-50">
            {filteredTickets.map((t) => {
              const isAssignedToMe = t.assignedAgentId === user?.id || t.assigneeId === user?.id;

              return (
                <div
                  key={t.id}
                  className="p-5 hover:bg-[#f6faf8] transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0e4a5c] bg-[#e3f4f1] px-2 py-0.5 rounded border border-teal-200/70">
                        {t.ticketNumber}
                      </span>
                      <h3
                        onClick={() => handleOpenDetail(t)}
                        className="font-bold text-[#0d2836] text-base hover:text-[#0e4a5c] cursor-pointer"
                      >
                        {t.title}
                      </h3>
                      <StatusBadge status={t.status} />
                      <StatusBadge priority={t.priority} />
                      {renderSlaBadge(t)}
                      {t.leaveRequestSummary && (
                        <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                          Linked: {t.leaveRequestSummary}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Requester: <strong className="text-slate-800">{t.requesterName || 'Employee'}</strong></span>
                      <span>Category: <strong className="text-slate-800">{t.categoryName}</strong></span>
                      {t.queueName && <span>Queue: <strong className="text-slate-800">{t.queueName}</strong></span>}
                      {t.assignedAgentName ? (
                        <span className={isAssignedToMe ? 'text-[#0e4a5c] font-bold' : 'text-slate-700'}>
                          Assigned: {t.assignedAgentName} {isAssignedToMe && '(You)'}
                        </span>
                      ) : (
                        <span className="text-amber-800 font-semibold">Unassigned</span>
                      )}
                      {(t.totalPausedMinutes ?? 0) > 0 && (
                        <span className="text-slate-500">
                          Paused Duration: {t.totalPausedMinutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isAssignedToMe && t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                      <button
                        onClick={() => handleAssignToMe(t)}
                        className="px-3 py-1.5 border border-teal-200 bg-[#e3f4f1] text-[#0e4a5c] hover:bg-teal-100 rounded-xl text-xs font-bold transition shadow-2xs"
                      >
                        Assign to Me
                      </button>
                    )}

                    {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                      <button
                        onClick={() => handleOpenResolveModal(t)}
                        className="px-3.5 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        Resolve
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenDetail(t)}
                      className="px-3 py-1.5 border border-teal-200 bg-white text-slate-700 hover:bg-[#f0f9f8] rounded-xl text-xs font-semibold transition shadow-2xs"
                    >
                      Details ({t.comments?.length || 0})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title={`Resolve Ticket ${activeTicket?.ticketNumber}`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmResolve} className="space-y-4">
          <p className="text-xs text-slate-600">
            Please provide resolution notes explaining how the issue was fixed for the employee.
          </p>

          <div>
            <label className="block text-xs font-bold text-[#0d2836] mb-1">
              Resolution Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g., VPN credentials refreshed and tested successfully."
              className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
            />
          </div>

          <div className="pt-4 border-t border-teal-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsResolveModalOpen(false)}
              className="px-4 py-2 border border-teal-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-[#f0f9f8] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResolving}
              className="px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition"
            >
              {isResolving ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal with Thread */}
      {activeTicket && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Ticket ${activeTicket.ticketNumber} - Details`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusBadge status={activeTicket.status} />
                <StatusBadge priority={activeTicket.priority} />
                <span className="text-xs text-slate-500">
                  Category: <strong className="text-slate-800">{activeTicket.categoryName}</strong>
                </span>
                {activeTicket.queueName && (
                  <span className="text-xs text-slate-500">
                    Queue: <strong className="text-slate-800">{activeTicket.queueName}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-[#0d2836]">{activeTicket.title}</h2>
              <div className="mt-2 text-xs text-slate-700 bg-[#f8fbfb] p-3.5 rounded-xl border border-teal-100 whitespace-pre-wrap leading-relaxed">
                {activeTicket.description}
              </div>
            </div>

            {/* Linked Leave Request Card */}
            {activeTicket.leaveRequestSummary && (
              <div className="rounded-xl border border-teal-200 bg-[#e3f4f1]/60 p-3.5 flex items-start gap-2">
                <div className="flex-1 text-xs">
                  <span className="font-bold text-[#0d2836]">Linked Leave Request: </span>
                  <span className="text-[#0e4a5c] font-semibold">{activeTicket.leaveRequestSummary}</span>
                  <p className="text-[11px] text-[#155b6e] mt-0.5">
                    This support ticket is tied to the requester's leave schedule and records.
                  </p>
                </div>
              </div>
            )}

            {/* SLA & Status Management Controls */}
            {activeTicket.status !== 'RESOLVED' && activeTicket.status !== 'CLOSED' && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#e3f4f1]/70 border border-teal-200 text-xs">
                <div>
                  <span className="font-bold text-[#0d2836] block">SLA Clock State:</span>
                  <span className={`text-[11px] font-semibold ${
                    activeTicket.status === 'PENDING_USER' ? 'text-amber-800' : 'text-[#0e4a5c]'
                  }`}>
                    {activeTicket.status === 'PENDING_USER'
                      ? 'Paused waiting for requester input'
                      : `Active (Target: ${activeTicket.slaDueAt ? new Date(activeTicket.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleWaitOnUser}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border ${
                    activeTicket.status === 'PENDING_USER'
                      ? 'bg-[#0e4a5c] hover:bg-[#083543] text-white border-[#0e4a5c] shadow-xs'
                      : 'bg-white hover:bg-[#eef7f6] text-[#0e4a5c] border-teal-300 shadow-2xs'
                  }`}
                >
                  {activeTicket.status === 'PENDING_USER' ? 'Resume SLA Clock' : 'Wait on Requester (Pause SLA)'}
                </button>
              </div>
            )}

            {/* Attachments Section */}
            {activeTicket.attachments && activeTicket.attachments.length > 0 && (
              <div className="space-y-2 bg-[#f8fbfb] p-3 rounded-xl border border-teal-100">
                <h3 className="text-xs font-bold text-[#0d2836] uppercase tracking-wider">
                  Attachments ({activeTicket.attachments.length})
                </h3>
                <div className="space-y-1.5">
                  {activeTicket.attachments.map((att) => (
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
                        onClick={() => helpdeskApi.downloadAttachment(activeTicket.id, att.id, att.fileName)}
                        className="text-xs text-[#0e4a5c] hover:text-[#083543] font-bold px-2 py-1 rounded-lg bg-[#e3f4f1] hover:bg-teal-100 transition"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Thread */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#0d2836] uppercase tracking-wider">
                Conversation &amp; Internal Notes
              </h3>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(!activeTicket.comments || activeTicket.comments.length === 0) ? (
                  <div className="text-xs text-slate-400 italic">No notes or comments yet.</div>
                ) : (
                  activeTicket.comments.map((c) => {
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

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="pt-2 space-y-2 border-t border-teal-100">
                <textarea
                  rows={2}
                  required
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type an update or internal memo..."
                  className="block w-full px-3 py-2 border border-teal-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-[#0d2836]"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded text-[#0e4a5c] focus:ring-[#0e4a5c]"
                    />
                    Mark as Internal Note (private to support staff)
                  </label>

                  <button
                    type="submit"
                    disabled={isPostingComment || !commentText.trim()}
                    className="px-4 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-xs"
                  >
                    {isPostingComment ? 'Posting...' : 'Post Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
