import React, { useState, useEffect } from 'react';
import { leaveApi } from '../api/leaveApi';
import { LeaveRequest } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';

export const ManagerApprovalsPage: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject';
    request: LeaveRequest | null;
  }>({
    isOpen: false,
    type: 'approve',
    request: null,
  });

  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pageBanner, setPageBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const loadPendingApprovals = async () => {
    setIsLoading(true);
    try {
      const data = await leaveApi.getPendingApprovals();
      setPendingRequests(data);
    } catch (err: any) {
      setPageBanner({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch pending approval requests.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const openDecisionModal = (request: LeaveRequest, type: 'approve' | 'reject') => {
    setComments('');
    setModalError(null);
    setDecisionModal({ isOpen: true, type, request });
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModal.request) return;

    setModalError(null);
    setIsSubmitting(true);

    const requestId = decisionModal.request.id;
    const isApprove = decisionModal.type === 'approve';

    try {
      if (isApprove) {
        await leaveApi.approveRequest(requestId, comments);
        setPageBanner({
          type: 'success',
          message: `Leave request for ${decisionModal.request.employeeName} approved successfully.`,
        });
      } else {
        await leaveApi.rejectRequest(requestId, comments);
        setPageBanner({
          type: 'warning',
          message: `Leave request for ${decisionModal.request.employeeName} has been rejected.`,
        });
      }

      setDecisionModal({ isOpen: false, type: 'approve', request: null });
      await loadPendingApprovals();
    } catch (err: any) {
      // Graceful HTTP 409 Conflict Handling
      if (err.response?.status === 409) {
        setModalError(
          'Conflict: This leave request has already been acted upon or was cancelled by the employee.'
        );
        // Refresh underlying list so manager doesn't see stale state
        await loadPendingApprovals();
      } else {
        setModalError(err.response?.data?.message || err.message || 'Operation failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
          Manager Leave Approvals
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Review, approve, or reject leave applications submitted by your reporting staff.
        </p>
      </div>

      {pageBanner && (
        <Alert
          type={pageBanner.type}
          message={pageBanner.message}
          onClose={() => setPageBanner(null)}
        />
      )}

      <div className="bg-white rounded-xl border border-blue-100 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/40">
          <span className="font-bold text-slate-950 text-sm">
            Pending Approval Queue ({pendingRequests.length})
          </span>
          <button
            onClick={loadPendingApprovals}
            className="text-xs text-blue-700 hover:text-black font-semibold transition"
          >
            Refresh Queue
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading requests...</div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-bold text-slate-950 text-sm">No pending requests</p>
            <p className="text-xs text-slate-600 mt-1">Leave applications submitted by your reporting staff will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-blue-50">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-6 hover:bg-blue-50/30 transition flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base text-slate-950">
                      {req.employeeName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ({req.employeeEmail})
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="font-semibold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200/70">
                      {req.leaveTypeName}
                    </span>
                    <span className="font-medium">
                      {req.startDate} &rarr; {req.endDate} ({req.totalDays} day{Number(req.totalDays) > 1 ? 's' : ''})
                    </span>
                    <span className="text-slate-500">
                      Submitted: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div className="text-sm text-slate-800 bg-blue-50/40 p-3 rounded-lg border border-blue-100 max-w-2xl">
                    <span className="font-semibold text-xs text-slate-500 block mb-0.5">
                      Employee Justification:
                    </span>
                    {req.reason}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <button
                    onClick={() => openDecisionModal(req, 'reject')}
                    className="px-3.5 py-1.5 border border-slate-300 bg-white text-slate-800 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 rounded-lg text-sm font-semibold transition shadow-2xs"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => openDecisionModal(req, 'approve')}
                    className="px-4 py-1.5 bg-slate-950 hover:bg-black text-white rounded-lg text-sm font-semibold transition shadow-xs"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      <Modal
        isOpen={decisionModal.isOpen}
        onClose={() => setDecisionModal({ isOpen: false, type: 'approve', request: null })}
        title={decisionModal.type === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
        maxWidth="md"
      >
        {modalError && (
          <Alert
            type="error"
            message={modalError}
            className="mb-4"
            onClose={() => setModalError(null)}
          />
        )}

        <form onSubmit={handleDecisionSubmit} className="space-y-4">
          <div className="text-sm text-slate-600">
            You are about to{' '}
            <strong className={decisionModal.type === 'approve' ? 'text-emerald-700' : 'text-rose-700'}>
              {decisionModal.type.toUpperCase()}
            </strong>{' '}
            the request for <strong className="text-slate-950">{decisionModal.request?.employeeName}</strong> for{' '}
            <strong className="text-slate-950">{decisionModal.request?.totalDays} days</strong> ({decisionModal.request?.startDate} to {decisionModal.request?.endDate}).
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">
              Comments / Notes {decisionModal.type === 'reject' && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={3}
              required={decisionModal.type === 'reject'}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={
                decisionModal.type === 'approve'
                  ? 'Optional approval comments...'
                  : 'Please state the reason for rejecting this leave request...'
              }
              className="block w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-1 focus:ring-slate-950 focus:border-slate-950 bg-white text-slate-950"
            />
          </div>

          <div className="pt-4 border-t border-blue-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDecisionModal({ isOpen: false, type: 'approve', request: null })}
              className="px-4 py-2 border border-blue-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-blue-50/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition ${
                decisionModal.type === 'approve'
                  ? 'bg-slate-950 hover:bg-black'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting
                ? 'Processing...'
                : decisionModal.type === 'approve'
                ? 'Confirm Approval'
                : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
