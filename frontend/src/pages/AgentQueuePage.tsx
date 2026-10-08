import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { helpdeskApi } from '../api/helpdeskApi';
import { SupportQueue, Ticket, TicketPriority, TicketStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';

export const AgentQueuePage: React.FC = () => {
  const { user } = useAuth();

  const [queues, setQueues] = useState<SupportQueue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Support Agent Queue
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Triage incoming support requests, manage SLA timelines, post internal notes, and resolve incidents.
          </p>
        </div>

        {/* Queue Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Queue:
          </label>
          <select
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white font-medium focus:ring-1 focus:ring-slate-950 focus:border-slate-950 text-slate-950"
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

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {['ALL', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === st
                ? 'bg-blue-100 text-blue-950 font-semibold border border-blue-200 shadow-2xs'
                : 'bg-white border border-blue-100 text-slate-700 hover:text-black hover:bg-blue-50/70 font-medium'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tickets Board */}
      <div className="bg-white rounded-xl border border-blue-100 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/40">
          <span className="font-bold text-slate-950 text-sm">
            Tickets in Queue ({filteredTickets.length})
          </span>
          <button
            onClick={loadQueuesAndTickets}
            className="text-xs text-blue-700 hover:text-black font-semibold transition"
          >
            Refresh Queue
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading queue tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-bold text-slate-950 text-sm">No tickets in queue</p>
            <p className="text-xs text-slate-600 mt-1">No pending tickets match the selected queue or status filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-blue-50">
            {filteredTickets.map((t) => {
              const isAssignedToMe = t.assignedAgentId === user?.id || t.assigneeId === user?.id;
              const isBreached = t.slaDueAt && new Date(t.slaDueAt) < new Date() && t.status !== 'RESOLVED' && t.status !== 'CLOSED';

              return (
                <div
                  key={t.id}
                  className="p-6 hover:bg-blue-50/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-950 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/70">
                        {t.ticketNumber}
                      </span>
                      <h3
                        onClick={() => handleOpenDetail(t)}
                        className="font-bold text-slate-950 text-base hover:text-blue-700 cursor-pointer"
                      >
                        {t.title}
                      </h3>
                      <StatusBadge status={t.status} />
                      <StatusBadge priority={t.priority} />
                      {isBreached && (
                        <span className="text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          SLA BREACHED
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Requester: <strong className="text-slate-800">{t.requesterName || 'Employee'}</strong></span>
                      <span>Category: <strong className="text-slate-800">{t.categoryName}</strong></span>
                      {t.queueName && <span>Queue: <strong className="text-slate-800">{t.queueName}</strong></span>}
                      {t.assignedAgentName ? (
                        <span className={isAssignedToMe ? 'text-blue-950 font-bold' : 'text-slate-700'}>
                          Assigned: {t.assignedAgentName} {isAssignedToMe && '(You)'}
                        </span>
                      ) : (
                        <span className="text-amber-800 font-semibold">Unassigned</span>
                      )}
                      {t.slaDueAt && (
                        <span className="text-slate-500">
                          SLA Target: {new Date(t.slaDueAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isAssignedToMe && t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                      <button
                        onClick={() => handleAssignToMe(t)}
                        className="px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-950 hover:bg-blue-100 rounded-lg text-xs font-semibold transition shadow-2xs"
                      >
                        Assign to Me
                      </button>
                    )}

                    {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                      <button
                        onClick={() => handleOpenResolveModal(t)}
                        className="px-3.5 py-1.5 bg-slate-950 hover:bg-black text-white rounded-lg text-xs font-semibold transition shadow-xs"
                      >
                        Resolve
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenDetail(t)}
                      className="px-3 py-1.5 border border-slate-300 bg-white text-slate-800 hover:bg-blue-50/50 rounded-lg text-xs font-semibold transition shadow-2xs"
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
            <label className="block text-sm font-semibold text-slate-900 mb-1">
              Resolution Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g., VPN credentials refreshed and tested successfully."
              className="block w-full px-3 py-2 border border-blue-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-950 focus:border-slate-950 bg-white text-slate-950"
            />
          </div>

          <div className="pt-4 border-t border-blue-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsResolveModalOpen(false)}
              className="px-4 py-2 border border-blue-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-blue-50/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResolving}
              className="px-4 py-2 bg-slate-950 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
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
              <h2 className="text-base font-bold text-slate-950">{activeTicket.title}</h2>
              <div className="mt-2 text-xs text-slate-800 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 whitespace-pre-wrap">
                {activeTicket.description}
              </div>
            </div>

            {/* Attachments Section */}
            {activeTicket.attachments && activeTicket.attachments.length > 0 && (
              <div className="space-y-2 bg-slate-50/70 p-3 rounded-xl border border-blue-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Attachments ({activeTicket.attachments.length})
                </h3>
                <div className="space-y-1.5">
                  {activeTicket.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-slate-800 truncate">{att.fileName}</span>
                        <span className="text-[10px] text-slate-400">
                          ({Math.round(att.fileSizeBytes / 1024)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => helpdeskApi.downloadAttachment(activeTicket.id, att.id, att.fileName)}
                        className="text-xs text-blue-700 hover:text-blue-900 font-semibold px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition"
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
              <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
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
                            : 'bg-white border border-blue-100 text-slate-900 shadow-2xs'
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
              <form onSubmit={handleAddComment} className="pt-2 space-y-2 border-t border-blue-100">
                <textarea
                  rows={2}
                  required
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type an update or internal memo..."
                  className="block w-full px-3 py-2 border border-blue-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-950 focus:border-slate-950 bg-white text-slate-950"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded text-slate-900 focus:ring-slate-950"
                    />
                    Mark as Internal Note (private to support staff)
                  </label>

                  <button
                    type="submit"
                    disabled={isPostingComment || !commentText.trim()}
                    className="px-3.5 py-1.5 bg-slate-950 hover:bg-black text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow-xs"
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
