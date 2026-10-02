import React, { useState, useEffect } from 'react';
import { leaveApi } from '../api/leaveApi';
import { LeaveRequest } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { CheckCircle, XCircle, Clock, User, Calendar, MessageSquare, AlertTriangle } from 'lucide-react';

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Manager Leave Approvals
        </h1>
        <p className="text-sm text-gray-500 mt-1">
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-900">
            Pending Approval Queue ({pendingRequests.length})
          </span>
          <button
            onClick={loadPendingApprovals}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Refresh Queue
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading requests...</div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900">Queue is clear!</h3>
            <p className="text-sm mt-1">No pending leave applications requiring your decision.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-6 hover:bg-gray-50/60 transition flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base text-gray-900">
                      {req.employeeName}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      ({req.employeeEmail})
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {req.leaveTypeName}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {req.startDate} &rarr; {req.endDate} ({req.totalDays} day{Number(req.totalDays) > 1 ? 's' : ''})
                    </span>
                    <span className="text-gray-400">
                      Submitted: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-w-2xl">
                    <span className="font-medium text-xs text-gray-500 block mb-0.5">
                      Employee Justification:
                    </span>
                    {req.reason}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => openDecisionModal(req, 'reject')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 rounded-lg text-sm font-medium transition"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>

                  <button
                    onClick={() => openDecisionModal(req, 'approve')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-xs transition"
                  >
                    <CheckCircle className="w-4 h-4" />
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
          <div className="text-sm text-gray-600">
            You are about to{' '}
            <strong className={decisionModal.type === 'approve' ? 'text-emerald-700' : 'text-rose-700'}>
              {decisionModal.type.toUpperCase()}
            </strong>{' '}
            the request for <strong>{decisionModal.request?.employeeName}</strong> for{' '}
            <strong>{decisionModal.request?.totalDays} days</strong> ({decisionModal.request?.startDate} to {decisionModal.request?.endDate}).
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments / Notes {decisionModal.type === 'reject' && <span className="text-red-500">*</span>}
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
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDecisionModal({ isOpen: false, type: 'approve', request: null })}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-white rounded-lg text-sm font-medium shadow-xs disabled:opacity-50 transition ${
                decisionModal.type === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
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
