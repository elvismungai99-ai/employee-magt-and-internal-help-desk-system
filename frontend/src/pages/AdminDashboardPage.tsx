import React, { useState, useEffect, useRef } from 'react';
import { adminApi } from '../api/adminApi';
import { leaveApi } from '../api/leaveApi';
import {
  AccrualRunResult,
  EventOutboxItem,
  PageResponse,
  SlaMonitorRunResult,
  UserProfile,
  CompOffRequest,
  LeaveEncashmentRequest,
  ExecutiveAnalyticsSummary,
  AuditLogItem,
} from '../types';
import { Modal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { ConfirmModal } from '../components/ConfirmModal';
import { TableSkeleton } from '../components/Skeleton';
import {
  Search,
  RefreshCw,
  Download,
  Check,
  X,
  Briefcase,
  Coins,
  FileSpreadsheet,
  Activity,
  TrendingUp,
  Star,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [lastAccrual, setLastAccrual] = useState<AccrualRunResult | null>(null);
  const [lastSla, setLastSla] = useState<SlaMonitorRunResult | null>(null);
  const [outboxPage, setOutboxPage] = useState<PageResponse<EventOutboxItem> | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCheckingSla, setIsCheckingSla] = useState<boolean>(false);

  const hierarchyFormRef = useRef<HTMLDivElement>(null);
  const managerSelectRef = useRef<HTMLSelectElement>(null);

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

  // Pending Comp-Off & Encashment claims (Step 4 & Step 8)
  const [pendingCompOffs, setPendingCompOffs] = useState<CompOffRequest[]>([]);
  const [pendingEncashments, setPendingEncashments] = useState<LeaveEncashmentRequest[]>([]);
  const [isExportingCsv, setIsExportingCsv] = useState<string | null>(null);

  // Decision Modal State for Comp-Off & Encashment
  const [compOffDecision, setCompOffDecision] = useState<{ id: string; action: 'APPROVE' | 'REJECT'; employeeName: string } | null>(null);
  const [encashDecision, setEncashDecision] = useState<{ id: string; action: 'APPROVE' | 'REJECT'; employeeName: string } | null>(null);
  const [decisionComments, setDecisionComments] = useState<string>('');
  const [isProcessingDecision, setIsProcessingDecision] = useState<boolean>(false);

  // Executive Analytics & System Audit Trail State
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveAnalyticsSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditActorFilter, setAuditActorFilter] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [activeAdminTab, setActiveAdminTab] = useState<'OPERATIONS' | 'AUDIT_LOGS'>('OPERATIONS');

  // Feedback Alert
  const [pageAlert, setPageAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAdminData = async (silent: boolean = false) => {
    const isSilent = silent === true;
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const [accrualRes, slaRes, outboxRes, usersRes, pendingRes, compOffRes, encashRes, execRes, auditRes] = await Promise.all([
        adminApi.getLastAccrualRun().catch(() => null),
        adminApi.getLastSlaMonitorRun().catch(() => null),
        adminApi.getOutboxEvents(currentPage, 15, statusFilter || undefined).catch(() => null),
        adminApi.getAllUsers().catch(() => []),
        adminApi.getPendingApprovals().catch(() => []),
        leaveApi.getPendingCompOffRequests().catch(() => []),
        leaveApi.getPendingEncashmentRequests().catch(() => []),
        adminApi.getExecutiveSummary().catch(() => null),
        adminApi.getAuditLogs().catch(() => []),
      ]);

      if (accrualRes) setLastAccrual(accrualRes);
      if (slaRes) setLastSla(slaRes);
      if (outboxRes) setOutboxPage(outboxRes);
      if (usersRes) setUsers(usersRes);
      if (pendingRes) setPendingUsers(pendingRes);
      if (compOffRes) setPendingCompOffs(compOffRes);
      if (encashRes) setPendingEncashments(encashRes);
      if (execRes) setExecutiveSummary(execRes);
      if (auditRes) setAuditLogs(auditRes);
    } catch (err: any) {
      if (!isSilent) {
        setPageAlert({
          type: 'error',
          message: err.response?.data?.message || 'Failed to load admin telemetry.',
        });
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  };

  // 1-Click CSV Reports Downloader (Step 9)
  const handleExportCsv = async (type: 'balances' | 'absences' | 'liability' | 'encashment', filename: string) => {
    setIsExportingCsv(type);
    try {
      let blob: Blob;
      if (type === 'balances') {
        blob = await adminApi.exportLeaveBalancesCsv();
      } else if (type === 'absences') {
        blob = await adminApi.exportDepartmentAbsencesCsv();
      } else if (type === 'liability') {
        blob = await adminApi.exportLeaveLiabilityCsv();
      } else {
        blob = await adminApi.exportLeaveEncashmentCsv();
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setPageAlert({
        type: 'success',
        message: `${filename} downloaded successfully.`,
      });
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || `Failed to export ${filename}.`,
      });
    } finally {
      setIsExportingCsv(null);
    }
  };

  // Comp-Off Decision Handler (Step 4)
  const handleConfirmCompOffDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compOffDecision) return;
    setIsProcessingDecision(true);
    try {
      if (compOffDecision.action === 'APPROVE') {
        await leaveApi.approveCompOff(compOffDecision.id, decisionComments.trim() || undefined);
      } else {
        await leaveApi.rejectCompOff(compOffDecision.id, decisionComments.trim() || undefined);
      }
      setPageAlert({
        type: 'success',
        message: `Compensatory off claim successfully ${compOffDecision.action === 'APPROVE' ? 'approved and credited to leave balance' : 'rejected'}.`,
      });
      setCompOffDecision(null);
      setDecisionComments('');
      await loadAdminData(true);
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || `Failed to ${compOffDecision.action.toLowerCase()} compensatory off claim.`,
      });
    } finally {
      setIsProcessingDecision(false);
    }
  };

  // Encashment Decision Handler (Step 8)
  const handleConfirmEncashDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encashDecision) return;
    setIsProcessingDecision(true);
    try {
      if (encashDecision.action === 'APPROVE') {
        await leaveApi.approveEncashment(encashDecision.id, decisionComments.trim() || undefined);
      } else {
        await leaveApi.rejectEncashment(encashDecision.id, decisionComments.trim() || undefined);
      }
      setPageAlert({
        type: 'success',
        message: `Leave encashment request successfully ${encashDecision.action === 'APPROVE' ? 'approved and forwarded to payroll' : 'rejected'}.`,
      });
      setEncashDecision(null);
      setDecisionComments('');
      await loadAdminData(true);
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || `Failed to ${encashDecision.action.toLowerCase()} leave encashment request.`,
      });
    } finally {
      setIsProcessingDecision(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAdminData(false);
      setPageAlert({
        type: 'success',
        message: 'Administration telemetry, employee directory, and transactional outbox refreshed.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTriggerSlaCheck = async () => {
    setIsCheckingSla(true);
    try {
      const res = await adminApi.triggerSlaMonitor();
      setLastSla(res);
      setPageAlert({
        type: 'success',
        message: res.message || `SLA breach scan completed: ${res.ticketsChecked ?? 0} tickets inspected, ${res.breachesDetected ?? 0} breach(es) detected.`,
      });
      await loadAdminData(true);
    } catch (err: any) {
      setPageAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to trigger SLA breach check.',
      });
    } finally {
      setIsCheckingSla(false);
    }
  };

  useEffect(() => {
    loadAdminData(false);

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
      const accrued = res.balancesAccrued ?? res.successCount ?? 0;
      const skipped = res.skippedCount ?? 0;
      const failed = res.failureCount ?? 0;
      setPageAlert({
        type: 'success',
        message: res.message || `Accrual calculation completed: ${accrued} employee balance(s) accrued, ${skipped} skipped (already accrued for ${triggerMonth}/${triggerYear}), ${failed} failed.`,
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
          setLastAccrual(res);
          const carried = res.carriedOverCount ?? res.balancesAccrued ?? res.successCount ?? 0;
          setPageAlert({
            type: 'success',
            message: res.message || `Year-end carryover executed: ${carried} employee balance(s) rolled over into ${triggerYear + 1}.`,
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
          setLastAccrual(res);
          const expired = res.expiredCount ?? res.balancesAccrued ?? res.successCount ?? 0;
          setPageAlert({
            type: 'success',
            message: res.message || `Carryover expiry executed: ${expired} record(s) evaluated and reset.`,
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

  const filteredAuditLogs = auditLogs.filter((log) => {
    const actorMatch = !auditActorFilter || log.actorEmail.toLowerCase().includes(auditActorFilter.toLowerCase().trim());
    const actionMatch = !auditActionFilter || log.action.toLowerCase().includes(auditActionFilter.toLowerCase().trim());
    return actorMatch && actionMatch;
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
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-teal-200 text-slate-800 bg-white hover:bg-[#f8fbfb] rounded-lg text-sm font-semibold transition shadow-2xs disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 text-[#0e4a5c] ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTriggerModalOpen(true)}
            className="px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-sm font-semibold transition shadow-xs cursor-pointer"
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

      {/* Executive Analytics Summary Cards */}
      {executiveSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-teal-100 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Workforce
              </span>
              <span className="text-2xl font-black text-[#0d2836] mt-0.5 block">
                {executiveSummary.totalEmployees}
              </span>
              <span className="text-[11px] text-slate-400">
                {executiveSummary.totalActiveLeaves} on leave today
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center font-bold">
              <Activity className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-teal-100 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Leave Utilization
              </span>
              <span className="text-2xl font-black text-[#0e4a5c] mt-0.5 block">
                {executiveSummary.leaveUtilizationPercentage}%
              </span>
              <span className="text-[11px] text-slate-400">
                {executiveSummary.totalApprovedLeaveDays} total days taken
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-teal-100 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                SLA Compliance
              </span>
              <span className={`text-2xl font-black mt-0.5 block ${
                executiveSummary.slaCompliancePercentage >= 90 ? 'text-emerald-700' : 'text-amber-600'
              }`}>
                {executiveSummary.slaCompliancePercentage}%
              </span>
              <span className="text-[11px] text-slate-400">
                {executiveSummary.breachedTicketsCount} breach(es) detected
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-teal-100 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Help Desk CSAT
              </span>
              <span className="text-2xl font-black text-amber-600 mt-0.5 block flex items-center gap-1">
                <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                {executiveSummary.averageCsatRating ? `${executiveSummary.averageCsatRating} / 5.0` : 'N/A'}
              </span>
              <span className="text-[11px] text-slate-400">
                {executiveSummary.totalCsatSurveys} rating(s) submitted
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
          </div>
        </div>
      )}

      {/* Admin Section Tabs */}
      <div className="flex items-center gap-3 border-b border-teal-100 pb-2">
        <button
          type="button"
          onClick={() => setActiveAdminTab('OPERATIONS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'OPERATIONS'
              ? 'bg-[#0e4a5c] text-white shadow-xs'
              : 'bg-white text-slate-700 border border-teal-200/80 hover:bg-[#f0f9f8]'
          }`}
        >
          <span>Operations &amp; Telemetry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('AUDIT_LOGS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'AUDIT_LOGS'
              ? 'bg-[#0e4a5c] text-white shadow-xs'
              : 'bg-white text-slate-700 border border-teal-200/80 hover:bg-[#f0f9f8]'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>System Audit Trail &amp; Compliance</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeAdminTab === 'AUDIT_LOGS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 font-bold'
          }`}>
            {auditLogs.length}
          </span>
        </button>
      </div>

      {activeAdminTab === 'AUDIT_LOGS' ? (
        <div className="bg-white rounded-xl border border-teal-100 overflow-hidden shadow-xs space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-teal-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-[#0e4a5c]" />
                <h2 className="text-base font-bold text-slate-950">System Audit Trail &amp; Compliance Logs</h2>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Immutable chronological log of all critical HR, leave encashment, and ITSM actions with actor identity and IP address traceability.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={auditActorFilter}
                onChange={(e) => setAuditActorFilter(e.target.value)}
                placeholder="Filter by actor email..."
                className="px-3 py-1.5 border border-teal-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:border-[#0e4a5c]"
              />
              <input
                type="text"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                placeholder="Filter by action (e.g., LEAVE_APPROVED)..."
                className="px-3 py-1.5 border border-teal-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:border-[#0e4a5c]"
              />
            </div>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No audit log entries found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-teal-100 text-xs">
                <thead className="bg-[#f8fbfb] text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-teal-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Timestamp</th>
                    <th className="px-4 py-3 text-left">Actor</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Entity</th>
                    <th className="px-4 py-3 text-left">Details</th>
                    <th className="px-4 py-3 text-right">Client IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50 bg-white">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#f8fbfb] transition">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                        {log.actorEmail}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#e3f4f1] text-[#0e4a5c] border border-teal-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        {log.entityType} ({log.entityId ? log.entityId.slice(0, 8) : 'N/A'})
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={log.details}>
                        {log.details || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-slate-400 text-[11px]">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>

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

      {/* Pending Compensatory Off & Leave Encashment Review (Step 4 & Step 8) */}
      <div className="bg-white rounded-xl border border-teal-100 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafcfb]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-950">Compensatory Off &amp; Leave Encashment Claims</h2>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${
                  pendingCompOffs.length > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}>
                  {pendingCompOffs.length} Comp-Off
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${
                  pendingEncashments.length > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}>
                  {pendingEncashments.length} Encashment
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Review and decision overtime comp-off credit claims and employee leave encashment payouts.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={3} cols={5} />
          </div>
        ) : pendingCompOffs.length === 0 && pendingEncashments.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            <p className="font-bold text-[#0d2836]">No Pending Claims</p>
            <p className="text-xs text-slate-500 mt-0.5">All compensatory off claims and encashment requests have been processed.</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Pending Comp-Off Claims Sub-Table */}
            {pendingCompOffs.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[#0d2836] mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-[#0e4a5c]" />
                  <span>Pending Compensatory Off Claims ({pendingCompOffs.length})</span>
                </h3>
                <div className="overflow-x-auto border border-teal-100 rounded-xl">
                  <table className="min-w-full divide-y divide-teal-100 text-xs">
                    <thead className="bg-[#f8fbfb] text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Employee</th>
                        <th className="px-4 py-2.5 text-left">Worked Date</th>
                        <th className="px-4 py-2.5 text-left">Days Earned</th>
                        <th className="px-4 py-2.5 text-left">Duty / Reason</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-50 bg-white">
                      {pendingCompOffs.map((item) => (
                        <tr key={item.id} className="hover:bg-[#f8fbfb]">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-950">{item.employeeName}</div>
                            <div className="text-slate-500 text-[11px]">{item.employeeEmail}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                            {item.workedDate}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-[#0e4a5c]">
                            {item.daysEarned} day{item.daysEarned !== 1 ? 's' : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={item.reason}>
                            {item.reason}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCompOffDecision({
                                  id: item.id,
                                  action: 'APPROVE',
                                  employeeName: item.employeeName,
                                });
                                setDecisionComments('');
                              }}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs transition cursor-pointer shadow-xs"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCompOffDecision({
                                  id: item.id,
                                  action: 'REJECT',
                                  employeeName: item.employeeName,
                                });
                                setDecisionComments('');
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 rounded font-semibold text-xs transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pending Encashment Requests Sub-Table */}
            {pendingEncashments.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[#0d2836] mb-2 flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-[#0e4a5c]" />
                  <span>Pending Leave Encashment Requests ({pendingEncashments.length})</span>
                </h3>
                <div className="overflow-x-auto border border-teal-100 rounded-xl">
                  <table className="min-w-full divide-y divide-teal-100 text-xs">
                    <thead className="bg-[#f8fbfb] text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Employee</th>
                        <th className="px-4 py-2.5 text-left">Leave Type</th>
                        <th className="px-4 py-2.5 text-left">Days Requested</th>
                        <th className="px-4 py-2.5 text-left">Year</th>
                        <th className="px-4 py-2.5 text-left">Reason / Notes</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-50 bg-white">
                      {pendingEncashments.map((item) => (
                        <tr key={item.id} className="hover:bg-[#f8fbfb]">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-950">{item.employeeName}</div>
                            <div className="text-slate-500 text-[11px]">{item.employeeEmail}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-semibold text-[#0e4a5c]">
                            {item.leaveTypeName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold text-[#0d2836]">
                            {item.daysRequested} day{item.daysRequested !== 1 ? 's' : ''}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {item.year}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={item.reason}>
                            {item.reason}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEncashDecision({
                                  id: item.id,
                                  action: 'APPROVE',
                                  employeeName: item.employeeName,
                                });
                                setDecisionComments('');
                              }}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs transition cursor-pointer shadow-xs"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEncashDecision({
                                  id: item.id,
                                  action: 'REJECT',
                                  employeeName: item.employeeName,
                                });
                                setDecisionComments('');
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 rounded font-semibold text-xs transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enterprise HR Analytics & CSV Data Export (Step 9) */}
      <div className="bg-white rounded-xl border border-teal-100 p-6 shadow-xs">
        <div className="pb-4 border-b border-teal-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#0e4a5c]" />
              <h2 className="text-sm font-bold text-slate-950">Enterprise HR Analytics &amp; CSV Data Export</h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Instant one-click streaming data export for audits, payroll reconciliation, and departmental workforce analytics.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-teal-100 bg-[#fafcfb] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#0d2836]">Leave Balances Quota Report</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Full snapshot of entitled, accrued, used, carried over, and remaining available days across all organization staff.
              </p>
            </div>
            <button
              type="button"
              disabled={isExportingCsv === 'balances'}
              onClick={() => handleExportCsv('balances', 'leave-balances-report.csv')}
              className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingCsv === 'balances' ? 'Exporting...' : 'Export Balances CSV'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-teal-100 bg-[#fafcfb] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#0d2836]">Department Absences Report</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Absence rates, active leaves, department coverage, and total days taken per organizational business unit.
              </p>
            </div>
            <button
              type="button"
              disabled={isExportingCsv === 'absences'}
              onClick={() => handleExportCsv('absences', 'department-absences-report.csv')}
              className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingCsv === 'absences' ? 'Exporting...' : 'Export Absences CSV'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-teal-100 bg-[#fafcfb] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#0d2836]">Leave Liability &amp; Valuation</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Unused annual balance liability exposure, carried-forward totals, and encashment balance tracking for finance.
              </p>
            </div>
            <button
              type="button"
              disabled={isExportingCsv === 'liability'}
              onClick={() => handleExportCsv('liability', 'leave-liability-report.csv')}
              className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingCsv === 'liability' ? 'Exporting...' : 'Export Liability CSV'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-teal-100 bg-[#fafcfb] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#0d2836]">Leave Encashment Payouts</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Approved leave encashments, payout days, and financial audit line-items for payroll accounting.
              </p>
            </div>
            <button
              type="button"
              disabled={isExportingCsv === 'encashment'}
              onClick={() => handleExportCsv('encashment', 'leave-encashment-payouts.csv')}
              className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingCsv === 'encashment' ? 'Exporting...' : 'Export Payroll CSV'}</span>
            </button>
          </div>
        </div>
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
                    {new Date(lastAccrual.runAt || lastAccrual.executedAt || Date.now()).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-teal-50 text-center">
                  <div className="bg-[#fafcfb] border border-teal-100 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-500 font-medium">Checked</span>
                    <strong className="text-sm text-slate-950">{lastAccrual.processedCount ?? lastAccrual.usersProcessed ?? 0}</strong>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-emerald-700 font-medium">Accrued</span>
                    <strong className="text-sm text-emerald-800">{lastAccrual.successCount ?? lastAccrual.balancesAccrued ?? 0}</strong>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-600 font-medium">Skipped</span>
                    <strong className="text-sm text-slate-800">{lastAccrual.skippedCount ?? 0}</strong>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-rose-700 font-medium">Failed</span>
                    <strong className="text-sm text-rose-800">{lastAccrual.failureCount ?? 0}</strong>
                  </div>
                </div>
                {lastAccrual.message && (
                  <p className="text-[11px] text-slate-600 pt-1 italic">{lastAccrual.message}</p>
                )}
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
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-[#e3f4f1] text-[#0e4a5c] font-semibold border border-teal-200">
                Active Poller (0 */5 * * *)
              </span>
              <button
                type="button"
                disabled={isCheckingSla}
                onClick={handleTriggerSlaCheck}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingSla ? 'animate-spin' : ''}`} />
                <span>{isCheckingSla ? 'Checking...' : 'Run SLA Check'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs text-slate-600">
            {lastSla ? (
              <>
                <div className="flex justify-between items-center">
                  <span>Last Inspection Timestamp:</span>
                  <span className="font-semibold text-slate-900">
                    {new Date(lastSla.runAt || lastSla.executedAt || Date.now()).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-teal-50 text-center">
                  <div className="bg-[#fafcfb] border border-teal-100 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-500 font-medium">Tickets Checked</span>
                    <strong className="text-sm text-slate-950">{lastSla.ticketsChecked ?? 0}</strong>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-amber-700 font-medium">Breaches Detected</span>
                    <strong className="text-sm text-amber-800">{lastSla.breachesDetected ?? 0}</strong>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded-lg">
                    <span className="block text-[10px] text-rose-700 font-medium">Events Flagged</span>
                    <strong className="text-sm text-rose-800">{lastSla.breachesFlagged ?? lastSla.breachesDetected ?? 0}</strong>
                  </div>
                </div>
                {lastSla.message && (
                  <p className="text-[11px] text-slate-600 pt-1 italic">{lastSla.message}</p>
                )}
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 italic">
                Awaiting first scheduled SLA monitoring cycle. Click "Run SLA Check" to inspect now.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Organizational Hierarchy: Assign Direct Manager */}
      <div ref={hierarchyFormRef} className="bg-white rounded-xl border border-teal-100 p-6 shadow-xs">
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
              ref={managerSelectRef}
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
                          type="button"
                          onClick={() => handleOpenApproveModal(u)}
                          className="px-2.5 py-1 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded text-xs font-semibold transition shadow-xs cursor-pointer"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignForm({
                              employeeId: u.id,
                              managerId: u.manager?.id || '',
                            });
                            hierarchyFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                              managerSelectRef.current?.focus();
                            }, 350);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-[#f0f9f8] text-slate-800 rounded text-xs font-semibold border border-teal-200 transition shadow-2xs cursor-pointer"
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
                      {ev.aggregateType || ev.sourceDomain} &bull; {(ev.aggregateId || ev.id)?.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ev.status === 'PROCESSED' || ev.status === 'PUBLISHED'
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
                      {ev.retryCount ?? ev.retryAttempts ?? 0}
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
      </>
    )}

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
              <div>Aggregate Type: <strong>{selectedEvent.aggregateType || selectedEvent.sourceDomain}</strong></div>
              <div>Aggregate ID: <strong className="font-mono">{selectedEvent.aggregateId || selectedEvent.id}</strong></div>
              <div>Status: <strong>{selectedEvent.status}</strong></div>
              <div>Retry Count: <strong>{selectedEvent.retryCount ?? selectedEvent.retryAttempts ?? 0}</strong></div>
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

            <div className="pt-2 border-t border-teal-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
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

      {/* Comp-Off Decision Modal */}
      {compOffDecision && (
        <Modal
          isOpen={Boolean(compOffDecision)}
          onClose={() => {
            if (!isProcessingDecision) setCompOffDecision(null);
          }}
          title={`${compOffDecision.action === 'APPROVE' ? 'Approve' : 'Reject'} Compensatory Off Claim`}
          maxWidth="sm"
        >
          <form onSubmit={handleConfirmCompOffDecision} className="space-y-4">
            <p className="text-xs text-slate-600">
              Are you sure you want to {compOffDecision.action.toLowerCase()} the compensatory off claim for <strong>{compOffDecision.employeeName}</strong>?
              {compOffDecision.action === 'APPROVE' && ' The earned working days will be immediately credited to their leave quota.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Review Comments (Optional)
              </label>
              <textarea
                rows={2}
                value={decisionComments}
                onChange={(e) => setDecisionComments(e.target.value)}
                placeholder="Add decision notes or rationale..."
                className="block w-full px-3 py-2 border border-teal-200 rounded-lg text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-slate-950"
              />
            </div>

            <div className="pt-3 border-t border-teal-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessingDecision}
                onClick={() => setCompOffDecision(null)}
                className="px-3 py-1.5 border border-teal-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingDecision}
                className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                  compOffDecision.action === 'APPROVE' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {isProcessingDecision ? 'Saving...' : `Confirm ${compOffDecision.action}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Leave Encashment Decision Modal */}
      {encashDecision && (
        <Modal
          isOpen={Boolean(encashDecision)}
          onClose={() => {
            if (!isProcessingDecision) setEncashDecision(null);
          }}
          title={`${encashDecision.action === 'APPROVE' ? 'Approve' : 'Reject'} Leave Encashment`}
          maxWidth="sm"
        >
          <form onSubmit={handleConfirmEncashDecision} className="space-y-4">
            <p className="text-xs text-slate-600">
              Are you sure you want to {encashDecision.action.toLowerCase()} the leave encashment request for <strong>{encashDecision.employeeName}</strong>?
              {encashDecision.action === 'APPROVE' && ' The encashed days will be deducted from their leave balance and recorded for payroll processing.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Review Comments (Optional)
              </label>
              <textarea
                rows={2}
                value={decisionComments}
                onChange={(e) => setDecisionComments(e.target.value)}
                placeholder="Add payroll reference or approval comments..."
                className="block w-full px-3 py-2 border border-teal-200 rounded-lg text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white text-slate-950"
              />
            </div>

            <div className="pt-3 border-t border-teal-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessingDecision}
                onClick={() => setEncashDecision(null)}
                className="px-3 py-1.5 border border-teal-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingDecision}
                className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                  encashDecision.action === 'APPROVE' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {isProcessingDecision ? 'Saving...' : `Confirm ${encashDecision.action}`}
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
