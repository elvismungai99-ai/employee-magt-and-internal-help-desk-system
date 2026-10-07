import React, { useState, useEffect } from 'react';
import { leaveApi } from '../api/leaveApi';
import { LeaveBalance, LeaveRequest, LeaveType } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';

export const LeavePortalPage: React.FC = () => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Application Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback alerts
  const [pageAlert, setPageAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [balData, reqData, typesData] = await Promise.all([
        leaveApi.getMyBalances(),
        leaveApi.getMyRequests(),
        leaveApi.getLeaveTypes(),
      ]);
      setBalances(balData);
      setRequests(reqData);
      setLeaveTypes(typesData);
      if (typesData.length > 0 && !applyForm.leaveTypeId) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: typesData[0].id }));
      }
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load leave records.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to calculate working days (excluding Saturdays and Sundays)
  const calculateWorkingDays = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const [sYear, sMonth, sDay] = startStr.split('-').map(Number);
    const [eYear, eMonth, eDay] = endStr.split('-').map(Number);
    if (!sYear || !eYear) return 0;

    const start = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);
    if (start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay(); // 0 = Sun, 6 = Sat
      if (day !== 0 && day !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const selectedBalance = balances.find((b) => b.leaveTypeId === applyForm.leaveTypeId);
  const availableDays = selectedBalance ? Number(selectedBalance.availableDays) || 0 : 0;
  const requestedWorkingDays = calculateWorkingDays(applyForm.startDate, applyForm.endDate);
  const remainingDays = availableDays - requestedWorkingDays;
  const hasDates = Boolean(applyForm.startDate && applyForm.endDate);
  const isInsufficient = hasDates && requestedWorkingDays > availableDays;

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError(null);

    if (new Date(applyForm.endDate) < new Date(applyForm.startDate)) {
      setApplyError('End date cannot precede the start date.');
      return;
    }

    if (requestedWorkingDays === 0) {
      setApplyError('Leave request must include at least one working day (weekends are excluded).');
      return;
    }

    if (isInsufficient) {
      setApplyError(`Insufficient balance. You requested ${requestedWorkingDays} days but only have ${availableDays.toFixed(1)} days available.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await leaveApi.submitRequest({
        leaveTypeId: applyForm.leaveTypeId,
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        reason: applyForm.reason,
      });

      setIsApplyModalOpen(false);
      setApplyForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: '',
        endDate: '',
        reason: '',
      });
      setPageAlert({
        type: 'success',
        message: 'Leave application submitted successfully for manager approval.',
      });
      await loadData();
    } catch (err: any) {
      setApplyError(err.response?.data?.message || 'Submission failed. Check balance or dates.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this leave application?')) {
      return;
    }

    try {
      await leaveApi.cancelRequest(id);
      setPageAlert({
        type: 'success',
        message: 'Leave application cancelled.',
      });
      await loadData();
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to cancel leave request.',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Leave Portal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Check your current leave balances, apply for paid time off, and track approval status.
          </p>
        </div>

        <button
          onClick={() => {
            setApplyError(null);
            setIsApplyModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition"
        >
          Apply for Leave
        </button>
      </div>

      {pageAlert && (
        <Alert
          type={pageAlert.type}
          message={pageAlert.message}
          onClose={() => setPageAlert(null)}
        />
      )}

      {/* Balance Cards Grid */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Leave Balances ({new Date().getFullYear()})
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        ) : balances.length === 0 ? (
          <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
            No active leave balance allocations found for this calendar year.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {balances.map((bal) => {
              const available = Number(bal.availableDays) || 0;
              const entitled = Number(bal.entitledDays) || 0;
              const used = Number(bal.usedDays) || 0;
              const pending = Number(bal.pendingDays) || 0;
              const accrued = Number(bal.accruedDays) || 0;

              return (
                <div
                  key={bal.id}
                  className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900">
                        {bal.leaveTypeName}
                      </span>
                      <span className="text-xs font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        {bal.leaveTypeCode}
                      </span>
                    </div>

                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold tracking-tight text-slate-900">
                        {available.toFixed(1)}
                      </span>
                      <span className="text-xs font-medium text-slate-500">days available</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Accrued:</span>
                      <span className="font-medium text-slate-800">{accrued.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Entitled:</span>
                      <span className="font-medium text-slate-800">{entitled.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Used:</span>
                      <span className="font-medium text-slate-800">{used.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending:</span>
                      <span className="font-medium text-amber-700">{pending.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Leave Application History Table */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Application History
        </h2>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              You have not submitted any leave applications yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-6 py-3 text-left">Leave Type</th>
                    <th className="px-6 py-3 text-left">Period</th>
                    <th className="px-6 py-3 text-center">Days</th>
                    <th className="px-6 py-3 text-left">Reason</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((req) => {
                    const isCancelable = ['DRAFT', 'SUBMITTED', 'PENDING'].includes(req.status);

                    return (
                      <tr key={req.id} className="hover:bg-gray-50/70 transition">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {req.leaveTypeName}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {req.startDate} &rarr; {req.endDate}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-800">
                          {req.totalDays}
                        </td>
                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isCancelable ? (
                            <button
                              onClick={() => handleCancelRequest(req.id)}
                              className="text-xs font-medium text-rose-600 hover:text-rose-800 hover:underline"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Apply Leave Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Apply for Leave"
        maxWidth="lg"
      >
        {applyError && (
          <Alert
            type="error"
            message={applyError}
            className="mb-4"
            onClose={() => setApplyError(null)}
          />
        )}

        <form onSubmit={handleApplySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={applyForm.leaveTypeId}
              onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}) - {t.defaultDaysPerYear} days/yr
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Balance & Calculation Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
              <span>LEAVE BALANCE CALCULATION</span>
              <span className="font-mono text-slate-700">{selectedBalance?.leaveTypeName || 'Selected Type'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="block text-xs text-gray-500">Available</span>
                <span className="text-base font-bold text-blue-600">
                  {availableDays.toFixed(1)} <span className="text-2xs font-normal text-gray-400">days</span>
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="block text-xs text-gray-500">Requested</span>
                <span className={`text-base font-bold ${requestedWorkingDays > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {requestedWorkingDays} <span className="text-2xs font-normal text-gray-400">days</span>
                </span>
              </div>
              <div className={`p-2.5 rounded-lg border ${
                !hasDates 
                  ? 'bg-white border-slate-200 text-gray-400'
                  : isInsufficient 
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <span className="block text-xs text-gray-500">Remaining</span>
                <span className="text-base font-bold">
                  {hasDates ? remainingDays.toFixed(1) : '--'} <span className="text-2xs font-normal opacity-70">days</span>
                </span>
              </div>
            </div>

            {hasDates && requestedWorkingDays === 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                Selected dates fall exclusively on weekends. Leave requests must include at least one working day (Monday to Friday).
              </p>
            )}

            {isInsufficient && (
              <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                Insufficient balance. You are requesting {requestedWorkingDays} days, which exceeds your current balance of {availableDays.toFixed(1)} days.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={applyForm.startDate}
                onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={applyForm.endDate}
                onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason / Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              placeholder="State purpose of leave (e.g. annual vacation, personal obligations)"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInsufficient || (hasDates && requestedWorkingDays === 0)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
