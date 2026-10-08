import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/adminApi';
import { AccrualRunResult, EventOutboxItem, PageResponse, SlaMonitorRunResult, UserProfile } from '../types';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { ConfirmModal } from '../components/ConfirmModal';
import { TableSkeleton } from '../components/Skeleton';
import { Search } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [lastAccrual, setLastAccrual] = useState<AccrualRunResult | null>(null);
  const [lastSla, setLastSla] = useState<SlaMonitorRunResult | null>(null);
  const [outboxPage, setOutboxPage] = useState<PageResponse<EventOutboxItem> | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Generic Confirmation Dialog State
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'primary';
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  // Pending Employee Registrations
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [selectedPendingUser, setSelectedPendingUser] = useState<UserProfile | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalManagerId, setApprovalManagerId] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Hierarchy Assignment State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [adminUserSearch, setAdminUserSearch] = useState<string>('');
  const [adminUserStatusFilter, setAdminUserStatusFilter] = useState<string>('');
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    managerId: '',
  });
  const [isAssigning, setIsAssigning] = useState(false);

  // Manual Trigger Modal
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [triggerYear, setTriggerYear] = useState<number>(new Date().getFullYear());
  const [triggerMonth, setTriggerMonth] = useState<number>(new Date().getMonth() + 1);
  const [isTriggering, setIsTriggering] = useState(false);

  // Payload Viewer Modal
  const [selectedEvent, setSelectedEvent] = useState<EventOutboxItem | null>(null);

  // Feedback Alert
  const [pageAlert, setPageAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAdminData = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [accrualRes, slaRes, outboxRes, usersRes, pendingRes] = await Promise.all([
        adminApi.getLastAccrualRun().catch(() => null),
        adminApi.getLastSlaMonitorRun().catch(() => null),
        adminApi.getOutboxEvents(currentPage, 15, statusFilter || undefined).catch(() => null),
        adminApi.getAllUsers().catch(() => []),
        adminApi.getPendingApprovals().catch(() => []),
      ]);

      if (accrualRes) setLastAccrual(accrualRes);
      if (slaRes) setLastSla(slaRes);
      if (outboxRes) setOutboxPage(outboxRes);
      if (usersRes) setUsers(usersRes);
      if (pendingRes) setPendingUsers(pendingRes);
    } catch (err: any) {
      if (!silent) {
        setPageAlert({
          type: 'error',
          message: err.response?.data?.message || 'Failed to load admin telemetry.',
        });
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAdminData();

    // Automatically poll every 10 seconds so newly registered users appear immediately
    const pollInterval = setInterval(() => {
      loadAdminData(true);
    }, 10000);

    // Refresh immediately when HR Admin refocuses or switches to the tab
    const handleFocus = () => {
      loadAdminData(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentPage, statusFilter]);

  const handleTriggerAccrual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTriggering(true);
    try {
      const res = await adminApi.triggerAccrual(Number(triggerYear), Number(triggerMonth));
      setLastAccrual(res);
      setIsTriggerModalOpen(false);
      setPageAlert({
        type: 'success',
        message: `Accrual calculation completed: ${res.successCount} employee balances updated (${res.failureCount} failed).`,
      });
      await loadAdminData();
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to trigger accrual calculation.',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleTriggerCarryover = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Run Annual Carryover Job',
      message: `Execute annual year-end carryover for ${triggerYear}? This will calculate unused balances and rollover eligible days into ${triggerYear + 1}.`,
      variant: 'primary',
      confirmLabel: 'Run Carryover',
      onConfirm: async () => {
        setIsConfirmLoading(true);
        try {
          const res = await adminApi.triggerYearEndCarryover(Number(triggerYear));
          setPageAlert({
            type: 'success',
            message: `Year-end carryover executed: ${res.carriedOverCount ?? res.processedCount ?? 0} employee balance(s) processed.`,
          });
          setIsTriggerModalOpen(false);
          setConfirmAction(null);
          await loadAdminData();
        } catch (err: any) {
          setPageAlert({
            type: 'error',
            message: err.response?.data?.message || 'Failed to trigger year-end carryover.',
          });
        } finally {
          setIsConfirmLoading(false);
        }
      },
    });
  };

  const handleTriggerCarryoverExpiry = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Run Carryover Expiry Job',
      message: `Execute carryover expiry job for ${triggerYear}? Any expired unused carry-over days will be lapsed immediately.`,
      variant: 'warning',
      confirmLabel: 'Run Expiry Job',
      onConfirm: async () => {
        setIsConfirmLoading(true);
        try {
          const res = await adminApi.triggerCarryoverExpiry(Number(triggerYear));
          setPageAlert({
            type: 'success',
            message: `Carryover expiry executed: ${res.expiredCount ?? res.processedCount ?? 0} record(s) evaluated and reset.`,
          });
          setIsTriggerModalOpen(false);
          setConfirmAction(null);
          await loadAdminData();
        } catch (err: any) {
          setPageAlert({
            type: 'error',
            message: err.response?.data?.message || 'Failed to trigger carryover expiry.',
          });
        } finally {
          setIsConfirmLoading(false);
        }
      },
    });
  };

  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.employeeId || !assignForm.managerId) {
      setPageAlert({ type: 'error', message: 'Please select both an employee and a manager.' });
      return;
    }
    if (assignForm.employeeId === assignForm.managerId) {
      setPageAlert({ type: 'error', message: 'An employee cannot be assigned as their own manager.' });
      return;
    }

    setIsAssigning(true);
    try {
      await adminApi.assignManager(assignForm.employeeId, assignForm.managerId, 'DIRECT');
      setPageAlert({
        type: 'success',
        message: 'Reporting hierarchy updated: Line manager assigned successfully.',
      });
      setAssignForm({ employeeId: '', managerId: '' });
      await loadAdminData();
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to assign manager.',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenApproveModal = (user: UserProfile) => {
    setSelectedPendingUser(user);
    setApprovalManagerId('');
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendingUser) return;

    setIsProcessingApproval(true);
    try {
      await adminApi.approveUser(
        selectedPendingUser.id,
        approvalManagerId || undefined
      );
      setPageAlert({
        type: 'success',
        message: `Employee ${selectedPendingUser.fullName || (selectedPendingUser.firstName + ' ' + selectedPendingUser.lastName)} has been approved and activated! Direct manager hierarchy and leave balances were successfully initialized.`,
      });
      setIsApproveModalOpen(false);
      setSelectedPendingUser(null);
      setApprovalManagerId('');
      await loadAdminData();
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to approve employee registration.',
      });
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleRejectRegistration = (user: UserProfile) => {
    setConfirmAction({
      isOpen: true,
      title: 'Reject Employee Registration',
      message: `Are you sure you want to reject registration for ${user.fullName || user.email}? They will not be able to log in to the system.`,
      variant: 'danger',
      confirmLabel: 'Reject Registration',
      onConfirm: async () => {
        setIsConfirmLoading(true);
        try {
          await adminApi.rejectUser(user.id, 'Registration rejected by HR administrator');
          setPageAlert({
            type: 'success',
            message: `Registration for ${user.fullName || user.email} has been rejected.`,
          });
          setConfirmAction(null);
          await loadAdminData();
        } catch (err: any) {
          setPageAlert({
            type: 'error',
            message: err.response?.data?.message || 'Failed to reject employee registration.',
          });
        } finally {
          setIsConfirmLoading(false);
        }
      },
    });
  };

  const eligibleManagers = users.filter((u) =>
    u.roles.some((r) =>
      ['LINE_MANAGER', 'HR_ADMIN', 'ROLE_LINE_MANAGER', 'ROLE_HR_ADMIN', 'MANAGER'].includes(r)
    )
  );

  const filteredAdminUsers = users.filter((u) => {
    const matchesStatus = !adminUserStatusFilter || u.status === adminUserStatusFilter;
    const q = adminUserSearch.toLowerCase().trim();
    const matchesQuery = !q || (
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.employeeCode && u.employeeCode.toLowerCase().includes(q)) ||
      (u.department?.name && u.department.name.toLowerCase().includes(q)) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(q))
    );
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            System Administration
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage employee registrations, reporting hierarchies, leave accrual schedules, and event transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAdminData}
            className="px-3.5 py-2 border border-teal-200 text-slate-800 bg-white hover:bg-[#f8fbfb] rounded-lg text-sm font-semibold transition shadow-2xs"
          >
            Refresh
          </button>
          <button
            onClick={() => setIsTriggerModalOpen(true)}
            className="px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-sm font-semibold transition shadow-xs"
          >
            Run Accrual
          </button>
        </div>
      </div>

      {pageAlert && (
        <Alert
          type={pageAlert.type}
          message={pageAlert.message}
          onClose={() => setPageAlert(null)}
        />
      )}

      {/* Pending Employee Registrations Card */}
      <div className="bg-white rounded-xl border border-teal-100 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafcfb]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-950">Pending Employee Registrations</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${
                pendingUsers.length > 0 
                  ? 'bg-amber-50 text-amber-900 border-amber-200' 
                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
              }`}>
                {pendingUsers.length} awaiting approval
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Verify identity of newly registered users before granting organizational portal access and leave quotas.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={3} cols={5} />
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            <p className="font-bold text-[#0d2836]">No Pending Approvals</p>
            <p className="text-xs text-slate-500 mt-0.5">All registered employees are verified and active.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-teal-100 text-xs">
              <thead className="bg-[#f8fbfb] text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-teal-100">
                <tr>
                  <th className="px-6 py-3 text-left">Employee</th>
                  <th className="px-6 py-3 text-left">Code</th>
                  <th className="px-6 py-3 text-left">Department</th>
                  <th className="px-6 py-3 text-left">Roles</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50 bg-white">
                {pendingUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f8fbfb] transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-950">{u.fullName || `${u.firstName} ${u.lastName}`}</div>
                      <div className="text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-800 font-medium">
                      {u.employeeCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                      {u.department?.name || <span className="text-slate-400 italic">None assigned</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r} className="px-2 py-0.5 rounded-md bg-[#e3f4f1] text-[#0d2836] border border-teal-200/60 font-semibold text-[10px]">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => handleOpenApproveModal(u)}
                        className="px-3 py-1 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-md font-semibold transition text-xs shadow-xs"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectRegistration(u)}
                        className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 hover:border-rose-300 rounded-md font-semibold transition text-xs shadow-2xs"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Background Engines Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Accrual Engine Card */}
        <div className="bg-white rounded-xl border border-teal-100 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-teal-100">
            <h2 className="text-sm font-bold text-slate-950">Monthly Accrual Schedule</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              Active Schedule (0 0 1 * *)
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs text-slate-600">
            {lastAccrual ? (
              <>
                <div className="flex justify-between items-center">
                  <span>Last Executed Period:</span>
                  <span className="font-semibold text-slate-950">
                    Month {lastAccrual.month}, {lastAccrual.year}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Triggered By:</span>
                  <span className="font-mono text-slate-900 font-medium">{lastAccrual.triggeredBy}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Run Timestamp:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(lastAccrual.runAt).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-teal-50 text-center">
                  <div className="bg-[#fafcfb] border border-teal-100 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-500 font-medium">Processed</span>
                    <strong className="text-sm text-slate-950">{lastAccrual.processedCount}</strong>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-emerald-700 font-medium">Success</span>
                    <strong className="text-sm text-emerald-800">{lastAccrual.successCount}</strong>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-rose-700 font-medium">Failed</span>
                    <strong className="text-sm text-rose-800">{lastAccrual.failureCount}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 italic">
                No recorded accrual runs yet. Click "Run Accrual" to execute.
              </div>
            )}
          </div>
        </div>

        {/* SLA Monitor Engine Card */}
        <div className="bg-white rounded-xl border border-teal-100 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-teal-100">
            <h2 className="text-sm font-bold text-slate-950">SLA Breach Monitor</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-[#e3f4f1] text-[#0e4a5c] font-semibold border border-teal-200">
              Active Poller (0 */5 * * *)
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs text-slate-600">
            {lastSla ? (
              <>
                <div className="flex justify-between items-center">
                  <span>Last Inspection Timestamp:</span>
                  <span className="font-semibold text-slate-900">
                    {new Date(lastSla.runAt).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-teal-50 text-center">
                  <div className="bg-[#fafcfb] border border-teal-100 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-500 font-medium">Tickets Checked</span>
                    <strong className="text-sm text-slate-950">{lastSla.ticketsChecked}</strong>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-amber-700 font-medium">Breaches Detected</span>
                    <strong className="text-sm text-amber-800">{lastSla.breachesDetected}</strong>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-rose-700 font-medium">Events Flagged</span>
                    <strong className="text-sm text-rose-800">{lastSla.breachesFlagged}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 italic">
                Awaiting first scheduled SLA monitoring cycle.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Organizational Hierarchy: Assign Direct Manager */}
      <div className="bg-white rounded-xl border border-teal-100 p-6 shadow-xs">
        <div className="pb-4 border-b border-teal-100">
          <h2 className="text-sm font-bold text-slate-950">Reporting Hierarchy Assignment</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Assign or update an employee's direct line manager for leave approvals.
          </p>
        </div>

        <form onSubmit={handleAssignManager} className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              Select Employee <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={assignForm.employeeId}
              onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
              className="block w-full px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-slate-950"
            >
              <option value="">-- Choose Employee --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email}) - {u.roles.join(', ')}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-slate-900 mb-1">
              Select Direct Manager <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={assignForm.managerId}
              onChange={(e) => setAssignForm({ ...assignForm, managerId: e.target.value })}
              className="block w-full px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-slate-950"
            >
              <option value="">-- Choose Manager --</option>
              {eligibleManagers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} ({m.email}) - {m.roles.join(', ')}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isAssigning}
              className="w-full px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition shadow-xs"
            >
              {isAssigning ? 'Saving...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>

      {/* Organization Employees & Staff Directory */}
      <div className="bg-white rounded-xl border border-teal-100 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafcfb]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-950">Organization Employees</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-lg font-semibold border bg-[#e3f4f1] text-[#0d2836] border-teal-200/80">
                {users.length} Total Users
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Full personnel directory across departments with reporting managers and active permissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 text-xs">
              {['', 'ACTIVE', 'PENDING_APPROVAL', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setAdminUserStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition text-xs ${
                    adminUserStatusFilter === st
                      ? 'bg-[#0e4a5c] text-white border border-[#0e4a5c] shadow-2xs'
                      : 'bg-white border border-teal-100 text-slate-700 hover:text-black hover:bg-[#f0f9f8]'
                  }`}
                >
                  {st || 'ALL'}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff, code, department..."
                value={adminUserSearch}
                onChange={(e) => setAdminUserSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-teal-200 rounded-lg text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] w-52 sm:w-60 bg-white text-slate-950 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-teal-100 text-xs">
            <thead className="bg-[#f8fbfb] text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-teal-100">
              <tr>
                <th className="px-6 py-3 text-left">Employee</th>
                <th className="px-6 py-3 text-left">Code</th>
                <th className="px-6 py-3 text-left">Department</th>
                <th className="px-6 py-3 text-left">Job Title &amp; Roles</th>
                <th className="px-6 py-3 text-left">Direct Line Manager</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50 bg-white">
              {filteredAdminUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">
                    No employees matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredAdminUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f8fbfb] transition">
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-950">{u.fullName || `${u.firstName} ${u.lastName}`}</div>
                      <div className="text-slate-500 text-[11px]">{u.email}</div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-mono text-slate-800 font-medium">
                      {u.employeeCode}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-slate-700">
                      {u.department?.name || <span className="text-slate-400 italic">None assigned</span>}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="font-medium text-slate-950">{u.jobTitle || 'Employee'}</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {u.roles.map((r) => (
                          <span key={r} className="px-1.5 py-0.2 rounded bg-[#e3f4f1] text-[#0d2836] border border-teal-200/50 font-semibold text-[9px]">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-slate-700">
                      {u.manager ? (
                        <span className="font-semibold text-slate-900">
                          {u.manager.fullName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : u.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right">
                      {u.status === 'PENDING_APPROVAL' ? (
                        <button
                          onClick={() => handleOpenApproveModal(u)}
                          className="px-2.5 py-1 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded text-xs font-semibold transition shadow-xs"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setAssignForm((prev) => ({ ...prev, employeeId: u.id }));
                            window.scrollTo({ top: 400, behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-[#f0f9f8] text-slate-800 rounded text-xs font-semibold border border-teal-200 transition shadow-2xs"
                        >
                          Set Manager
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactional Event Outbox Inspector */}
      <div className="bg-white rounded-xl border border-teal-100 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafcfb]">
          <h2 className="text-sm font-bold text-slate-950">Transactional Event Outbox</h2>

          {/* Outbox Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            {['', 'PENDING', 'PROCESSED', 'FAILED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(0);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  statusFilter === st
                    ? 'bg-[#0e4a5c] text-white border border-[#0e4a5c] shadow-2xs'
                    : 'bg-white border border-teal-100 text-slate-700 hover:text-black hover:bg-[#f0f9f8]'
                }`}
              >
                {st || 'ALL'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={6} />
          </div>
        ) : !outboxPage || outboxPage.content.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No events found in outbox matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-teal-100 text-xs">
              <thead className="bg-[#f8fbfb] text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-teal-100">
                <tr>
                  <th className="px-6 py-3 text-left">Event Type</th>
                  <th className="px-6 py-3 text-left">Aggregate</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-center">Retries</th>
                  <th className="px-6 py-3 text-left">Created At</th>
                  <th className="px-6 py-3 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50 bg-white">
                {outboxPage.content.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#f8fbfb] transition">
                    <td className="px-6 py-3 font-mono font-semibold text-[#0d2836]">
                      {ev.eventType}
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-mono">
                      {ev.aggregateType} &bull; {ev.aggregateId?.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ev.status === 'PROCESSED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : ev.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center font-medium text-slate-800">
                      {ev.retryCount}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="text-xs text-[#0e4a5c] hover:text-black font-semibold transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {outboxPage && outboxPage.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-teal-100 flex items-center justify-between text-xs text-slate-600 bg-[#fafcfb]">
            <span>
              Page {outboxPage.number + 1} of {outboxPage.totalPages} ({outboxPage.totalElements} total entries)
            </span>
            <div className="flex gap-2">
              <button
                disabled={outboxPage.number === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1 border border-teal-200 rounded-lg bg-white disabled:opacity-40 hover:bg-[#f8fbfb] font-medium text-slate-800 transition"
              >
                Previous
              </button>
              <button
                disabled={outboxPage.number + 1 >= outboxPage.totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1 border border-teal-200 rounded-lg bg-white disabled:opacity-40 hover:bg-[#f8fbfb] font-medium text-slate-800 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trigger Accrual Modal */}
      <Modal
        isOpen={isTriggerModalOpen}
        onClose={() => setIsTriggerModalOpen(false)}
        title="Trigger Monthly Leave Accrual"
        maxWidth="md"
      >
        <form onSubmit={handleTriggerAccrual} className="space-y-4">
          <p className="text-xs text-slate-600">
            Manually executing the accrual engine calculates active policy allocations for all eligible employees and generates balance transactions.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Year
              </label>
              <input
                type="number"
                required
                value={triggerYear}
                onChange={(e) => setTriggerYear(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Month (1-12)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                required
                value={triggerMonth}
                onChange={(e) => setTriggerMonth(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-slate-950"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-teal-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isTriggering}
                onClick={handleTriggerCarryover}
                className="px-3 py-1.5 border border-teal-200 bg-[#e3f4f1] text-[#0d2836] hover:bg-teal-100 rounded-lg text-xs font-semibold disabled:opacity-50 transition"
              >
                Year-End Carryover
              </button>
              <button
                type="button"
                disabled={isTriggering}
                onClick={handleTriggerCarryoverExpiry}
                className="px-3 py-1.5 border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-semibold disabled:opacity-50 transition"
              >
                Expire Carryover
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsTriggerModalOpen(false)}
                className="px-3 py-1.5 border border-teal-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-[#f8fbfb] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isTriggering}
                className="px-4 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition shadow-xs"
              >
                {isTriggering ? 'Running...' : 'Run Accrual'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Payload Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={`Event Payload: ${selectedEvent.eventType}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-[#fafcfb] border border-teal-100 p-3 rounded-xl text-slate-800">
              <div>Aggregate Type: <strong>{selectedEvent.aggregateType}</strong></div>
              <div>Aggregate ID: <strong className="font-mono">{selectedEvent.aggregateId}</strong></div>
              <div>Status: <strong>{selectedEvent.status}</strong></div>
              <div>Retry Count: <strong>{selectedEvent.retryCount}</strong></div>
            </div>

            <div>
              <span className="font-semibold text-slate-900 block mb-1">Payload JSON:</span>
              <pre className="bg-slate-950 text-slate-100 p-3.5 rounded-xl overflow-x-auto text-[11px] font-mono whitespace-pre-wrap border border-slate-800">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedEvent.payload), null, 2);
                  } catch {
                    return selectedEvent.payload;
                  }
                })()}
              </pre>
            </div>

            {selectedEvent.lastError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl">
                <span className="font-semibold block mb-0.5">Last Delivery Error:</span>
                <p>{selectedEvent.lastError}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approve Employee Modal */}
      {isApproveModalOpen && selectedPendingUser && (
        <Modal
          isOpen={isApproveModalOpen}
          onClose={() => {
            if (!isProcessingApproval) {
              setIsApproveModalOpen(false);
              setSelectedPendingUser(null);
            }
          }}
          title="Approve Employee Registration"
          maxWidth="md"
        >
          <form onSubmit={handleConfirmApprove} className="space-y-4">
            <div className="bg-[#fafcfb] p-4 rounded-xl border border-teal-100 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Applicant:</span>
                <span className="font-semibold text-slate-950">{selectedPendingUser.fullName || `${selectedPendingUser.firstName} ${selectedPendingUser.lastName}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-800 font-medium">{selectedPendingUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Employee Code:</span>
                <span className="font-mono text-slate-800 font-medium">{selectedPendingUser.employeeCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="text-slate-800">{selectedPendingUser.department?.name || 'None'}</span>
              </div>
            </div>

            <div className="bg-[#e3f4f1] border border-teal-200 text-[#0d2836] p-3.5 rounded-xl text-xs">
              <p className="font-semibold mb-1">What happens upon approval?</p>
              <ul className="list-disc list-inside space-y-0.5 text-[#0e4a5c]">
                <li>Account status changes from <strong>PENDING_APPROVAL</strong> to <strong>ACTIVE</strong>.</li>
                <li>Employee can immediately log in to the portal.</li>
                <li>Current-year leave balances are automatically allocated for all active leave types.</li>
                <li>Direct reporting line manager hierarchy is established.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Assign Direct Line Manager (Optional, Recommended)
              </label>
              <select
                value={approvalManagerId}
                onChange={(e) => setApprovalManagerId(e.target.value)}
                className="block w-full px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-slate-950"
              >
                <option value="">-- Assign Manager Later --</option>
                {eligibleManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.email}) - {m.roles.join(', ')}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Assigning a line manager now ensures the employee can submit leave requests immediately without routing delays.
              </p>
            </div>

            <div className="pt-4 border-t border-teal-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isProcessingApproval}
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setSelectedPendingUser(null);
                }}
                className="px-4 py-2 border border-teal-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-[#f8fbfb] disabled:opacity-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingApproval}
                className="px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition shadow-xs"
              >
                {isProcessingApproval ? 'Activating Employee...' : 'Approve & Activate'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Enterprise Confirmation Dialog */}
      {confirmAction && (
        <ConfirmModal
          isOpen={confirmAction.isOpen}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.onConfirm}
          title={confirmAction.title}
          message={confirmAction.message}
          variant={confirmAction.variant}
          confirmLabel={confirmAction.confirmLabel}
          cancelLabel="Cancel"
          isLoading={isConfirmLoading}
        />
      )}
    </div>
  );
};
