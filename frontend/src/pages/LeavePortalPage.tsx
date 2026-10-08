import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Briefcase,
  HeartPulse,
  Coffee,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  MoreHorizontal,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  CalendarCheck2
} from 'lucide-react';
import { leaveApi } from '../api/leaveApi';
import { LeaveBalance, LeaveRequest, LeaveType } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

// Unified Leave Activity row interface
interface LeaveActivityItem {
  id: string;
  isBackendRecord?: boolean;
  employeeName: string;
  employeeCode: string;
  avatarUrl: string;
  jobTitle: string;
  department: string;
  leaveType: string;
  leaveTypeCode?: string;
  submitDate: string;
  period: string;
  duration: string;
  durationDays: number;
  reason: string;
  status: 'Approved' | 'Rejected' | 'Pending';
  rawStatus?: string;
}

// Initial realistic data matching the mockup exactly
const INITIAL_MOCKUP_ACTIVITIES: LeaveActivityItem[] = [
  {
    id: 'mock-1',
    employeeName: 'Lina Armand',
    employeeCode: 'EMP-0312',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'Lab Analyst',
    department: 'R&D',
    leaveType: 'Sick Leave',
    leaveTypeCode: 'SICK',
    submitDate: '18 Jun 2035',
    period: '20–22 Jun 2035',
    duration: '3 Days',
    durationDays: 3,
    reason: "Doctor's note attached",
    status: 'Approved',
  },
  {
    id: 'mock-2',
    employeeName: 'Jacob Yuen',
    employeeCode: 'EMP-0115',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'Site Supervisor',
    department: 'Operations',
    leaveType: 'Annual Leave',
    leaveTypeCode: 'ANNUAL',
    submitDate: '10 Jun 2035',
    period: '17–21 Jun 2035',
    duration: '5 Days',
    durationDays: 5,
    reason: 'Family trip',
    status: 'Approved',
  },
  {
    id: 'mock-3',
    employeeName: 'Anya Rodriguez',
    employeeCode: 'EMP-0275',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'Graphic Designer',
    department: 'Marketing',
    leaveType: 'Other Leave',
    leaveTypeCode: 'OTHER',
    submitDate: '17 Jun 2035',
    period: '19 Jun 2035',
    duration: '1 Day',
    durationDays: 1,
    reason: 'Personal matter',
    status: 'Pending',
  },
  {
    id: 'mock-4',
    employeeName: 'Olivia Mason',
    employeeCode: 'EMP-0234',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'Marketing',
    department: 'Executive Marketing',
    leaveType: 'Annual Leave',
    leaveTypeCode: 'ANNUAL',
    submitDate: '02 Jun 2035',
    period: '05–07 Jun 2035',
    duration: '3 Days',
    durationDays: 3,
    reason: 'Conference attendance',
    status: 'Approved',
  },
  {
    id: 'mock-5',
    employeeName: 'Sara Kim',
    employeeCode: 'EMP-0358',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'Customer Support',
    department: 'Customer Service',
    leaveType: 'Sick Leave',
    leaveTypeCode: 'SICK',
    submitDate: '14 Jun 2035',
    period: '15–16 Jun 2035',
    duration: '2 Days',
    durationDays: 2,
    reason: 'Fever',
    status: 'Approved',
  },
  {
    id: 'mock-6',
    employeeName: 'Daniel Cheung',
    employeeCode: 'EMP-0251',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'Compliance Specialist',
    department: 'Operations',
    leaveType: 'Annual Leave',
    leaveTypeCode: 'ANNUAL',
    submitDate: '01 Jun 2035',
    period: '10–12 Jun 2035',
    duration: '3 Days',
    durationDays: 3,
    reason: 'Holiday',
    status: 'Pending',
  },
  {
    id: 'mock-7',
    employeeName: 'Mia Torres',
    employeeCode: 'EMP-0389',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'HR Officer',
    department: 'Human Resources',
    leaveType: 'Annual Leave',
    leaveTypeCode: 'ANNUAL',
    submitDate: '06 Jun 2035',
    period: '09–10 Jun 2035',
    duration: '2 Days',
    durationDays: 2,
    reason: 'Personal retreat',
    status: 'Approved',
  },
  {
    id: 'mock-8',
    employeeName: 'Ethan Roy',
    employeeCode: 'EMP-0178',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'UI Designer',
    department: 'Product Design',
    leaveType: 'Casual Leave',
    leaveTypeCode: 'CASUAL',
    submitDate: '05 Jun 2035',
    period: '07 Jun 2035',
    duration: '1 Day',
    durationDays: 1,
    reason: '—',
    status: 'Rejected',
  },
  {
    id: 'mock-9',
    employeeName: 'Farah Nabila',
    employeeCode: 'EMP-0120',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    jobTitle: 'Customer Experience Lead',
    department: 'Customer Service',
    leaveType: 'Sick Leave',
    leaveTypeCode: 'SICK',
    submitDate: '11 Jun 2035',
    period: '12 Jun 2035',
    duration: '1 Day',
    durationDays: 1,
    reason: 'Headache',
    status: 'Approved',
  },
];

export const LeavePortalPage: React.FC = () => {
  const { user, hasAnyRole } = useAuth();

  // Backend state
  const [backendRequests, setBackendRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Local state for table & interactions
  const [activityList, setActivityList] = useState<LeaveActivityItem[]>(INITIAL_MOCKUP_ACTIVITIES);
  const [selectedIds, setSelectedIds] = useState<string[]>(['mock-3']); // Anya Rodriguez selected in mockup
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Approved' | 'Pending' | 'Rejected'>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Chart hover state
  const [hoveredDay, setHoveredDay] = useState<string>('Mon');

  // Calendar state
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);

  // Apply Leave Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch real backend data
  const loadData = async () => {
    try {
      const [balData, typesData, reqData] = await Promise.all([
        leaveApi.getMyBalances().catch(() => []),
        leaveApi.getLeaveTypes().catch(() => []),
        leaveApi.getAllRequests().catch(() => leaveApi.getMyRequests().catch(() => [])),
      ]);

      setBalances(balData);
      setLeaveTypes(typesData);
      setBackendRequests(reqData);

      if (typesData.length > 0 && !applyForm.leaveTypeId) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: typesData[0].id }));
      }

      // Convert backend requests into LeaveActivityItem rows
      if (reqData && reqData.length > 0) {
        const mappedBackendItems: LeaveActivityItem[] = reqData.map((r) => {
          const statusMapped: 'Approved' | 'Rejected' | 'Pending' =
            r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : 'Pending';

          const formatPeriod = (start: string, end: string) => {
            if (start === end) return start;
            return `${start} to ${end}`;
          };

          return {
            id: r.id,
            isBackendRecord: true,
            employeeName: r.employeeName || user?.fullName || 'Current User',
            employeeCode: user?.employeeCode || 'EMP-0099',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
            jobTitle: user?.jobTitle || 'Team Member',
            department: user?.department?.name || 'Department',
            leaveType: r.leaveTypeName || 'Annual Leave',
            leaveTypeCode: r.leaveTypeCode || 'ANNUAL',
            submitDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
            period: formatPeriod(r.startDate, r.endDate),
            duration: `${r.totalDays} Day${r.totalDays > 1 ? 's' : ''}`,
            durationDays: r.totalDays,
            reason: r.reason || '—',
            status: statusMapped,
            rawStatus: r.status,
          };
        });

        // Merge backend items at top of the initial mockup items (deduplicating)
        setActivityList([
          ...mappedBackendItems,
          ...INITIAL_MOCKUP_ACTIVITIES.filter((m) => !mappedBackendItems.some((b) => b.id === m.id)),
        ]);
      }
    } catch (err: any) {
      console.warn('Backend load notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute working days helper
  const calculateWorkingDays = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const [sY, sM, sD] = startStr.split('-').map(Number);
    const [eY, eM, eD] = endStr.split('-').map(Number);
    if (!sY || !eY) return 0;

    const start = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);
    if (start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const selectedBalance = balances.find((b) => b.leaveTypeId === applyForm.leaveTypeId);
  const availableDays = selectedBalance ? Number(selectedBalance.availableDays) || 0 : 15;
  const requestedWorkingDays = calculateWorkingDays(applyForm.startDate, applyForm.endDate);

  // Form submission handler
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

    setIsSubmitting(true);
    try {
      const created = await leaveApi.submitRequest({
        leaveTypeId: applyForm.leaveTypeId,
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        reason: applyForm.reason,
      });

      setToastMessage({
        type: 'success',
        text: `Leave request for ${requestedWorkingDays} day(s) submitted successfully!`,
      });

      // Reload fresh state from backend
      await loadData();
      setIsApplyModalOpen(false);
      setApplyForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: '',
        endDate: '',
        reason: '',
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error?.details || 'Failed to submit leave request.';
      setApplyError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Action Approve / Reject handler
  const handleAction = async (item: LeaveActivityItem, decision: 'APPROVE' | 'REJECT') => {
    try {
      if (item.isBackendRecord) {
        if (decision === 'APPROVE') {
          await leaveApi.approveRequest(item.id, 'Approved via Leave Management Dashboard');
        } else {
          await leaveApi.rejectRequest(item.id, 'Declined via Leave Management Dashboard');
        }
      }

      // Update local row state immediately
      setActivityList((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, status: decision === 'APPROVE' ? 'Approved' : 'Rejected' }
            : row
        )
      );

      setToastMessage({
        type: 'success',
        text: `Request for ${item.employeeName} marked as ${decision === 'APPROVE' ? 'Approved' : 'Rejected'}.`,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || `Failed to ${decision.toLowerCase()} request.`;
      setToastMessage({ type: 'error', text: msg });
    }
  };

  // Checkbox selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredActivities.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredActivities.map((a) => a.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filtering activities
  const filteredActivities = useMemo(() => {
    return activityList.filter((item) => {
      const matchesSearch =
        item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.leaveType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [activityList, searchQuery, statusFilter]);

  // Dynamic KPI counts based on active list
  const totalOnLeave = 6;
  const annualLeaveCount = 3;
  const sickLeaveCount = 2;
  const otherLeaveCount = 1;

  // Chart data for Leave Overview
  const chartDays = [
    { day: 'Mon', fullDate: 'Monday, 11 Jun', count: 6, percent: 75 },
    { day: 'Tue', fullDate: 'Tuesday, 12 Jun', count: 4, percent: 50 },
    { day: 'Wed', fullDate: 'Wednesday, 13 Jun', count: 5, percent: 62 },
    { day: 'Thu', fullDate: 'Thursday, 14 Jun', count: 6, percent: 75 },
    { day: 'Fri', fullDate: 'Friday, 15 Jun', count: 4, percent: 50 },
  ];

  const currentHoveredDay = chartDays.find((d) => d.day === hoveredDay) || chartDays[0];

  return (
    <div className="space-y-6">
      {/* Toast feedback banner */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 shadow-sm border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-xs font-semibold">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs font-bold text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          TOP ROW: 4 KPI METRIC CARDS (Exact match to Mockup)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total On Leave (Today) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f6f0] text-emerald-600">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total On Leave (Today)
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalOnLeave}
            </span>
            <span className="text-xs font-medium text-slate-500">Employees</span>
          </div>

          <div className="mt-2 flex items-center">
            <span className="inline-flex items-center rounded-md bg-[#e3f6f0] px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              4.7%
            </span>
            <span className="ml-1.5 text-[11px] text-slate-500">
              from total employee
            </span>
          </div>
        </div>

        {/* Card 2: Annual Leave */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f6f0] text-emerald-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Annual Leave
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {annualLeaveCount}
            </span>
            <span className="text-xs font-medium text-slate-500">Employees</span>
          </div>

          <div className="mt-2 flex items-center">
            <span className="inline-flex items-center rounded-md bg-[#e3f6f0] px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              50%
            </span>
            <span className="ml-1.5 text-[11px] text-slate-500">
              of total leave
            </span>
          </div>
        </div>

        {/* Card 3: Sick Leave */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f6f0] text-emerald-600">
              <HeartPulse className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Sick Leave
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {sickLeaveCount}
            </span>
            <span className="text-xs font-medium text-slate-500">Employees</span>
          </div>

          <div className="mt-2 flex items-center">
            <span className="inline-flex items-center rounded-md bg-[#e3f6f0] px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              33.3%
            </span>
            <span className="ml-1.5 text-[11px] text-slate-500">
              of total leave
            </span>
          </div>
        </div>

        {/* Card 4: Other Leaves */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f6f0] text-emerald-600">
              <Coffee className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Other Leaves
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {otherLeaveCount}
            </span>
            <span className="text-xs font-medium text-slate-500">Employees</span>
          </div>

          <div className="mt-2 flex items-center">
            <span className="inline-flex items-center rounded-md bg-[#e3f6f0] px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              16.7%
            </span>
            <span className="ml-1.5 text-[11px] text-slate-500">
              of total leave
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MIDDLE ROW: 4 CARDS (Leave Overview, Calendar, Employee Leaves, Donut)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card 1: Leave Overview Chart (4 cols on lg) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Leave Overview</h3>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[#f8faf9] px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <span>This Week</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
          </div>

          {/* Interactive Bar + Line SVG Chart matching mockup */}
          <div className="relative pt-6 pb-2">
            {/* Tooltip on active day */}
            <div
              className="absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-white px-3 py-1.5 text-center shadow-lg border border-slate-100 transition-all pointer-events-none"
              style={{
                left:
                  hoveredDay === 'Mon'
                    ? '18%'
                    : hoveredDay === 'Tue'
                    ? '34%'
                    : hoveredDay === 'Wed'
                    ? '50%'
                    : hoveredDay === 'Thu'
                    ? '66%'
                    : '82%',
              }}
            >
              <p className="text-[10px] text-slate-400 font-medium">{currentHoveredDay.fullDate}</p>
              <div className="flex items-center justify-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-800">{currentHoveredDay.count} employees</span>
              </div>
            </div>

            {/* SVG Plot */}
            <div className="h-44 w-full flex items-end justify-between px-3 relative">
              {/* Horizontal Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
                <div className="border-b border-dashed border-slate-100 w-full flex items-center justify-between"><span>8</span></div>
                <div className="border-b border-dashed border-slate-100 w-full flex items-center justify-between"><span>6</span></div>
                <div className="border-b border-dashed border-slate-100 w-full flex items-center justify-between"><span>4</span></div>
                <div className="border-b border-dashed border-slate-100 w-full flex items-center justify-between"><span>2</span></div>
                <div className="border-b border-slate-200 w-full flex items-center justify-between"><span>0</span></div>
              </div>

              {/* Day Bars */}
              {chartDays.map((item) => (
                <div
                  key={item.day}
                  onMouseEnter={() => setHoveredDay(item.day)}
                  className="group relative flex flex-col items-center flex-1 h-full justify-end cursor-pointer z-1"
                >
                  <div
                    className={`w-6 rounded-t-lg transition-all duration-300 ${
                      hoveredDay === item.day
                        ? 'bg-emerald-500/80 shadow-md shadow-emerald-500/20'
                        : 'bg-[#e4edea] group-hover:bg-[#cbe2da]'
                    }`}
                    style={{ height: `${item.percent}%` }}
                  />
                  <span
                    className={`mt-2 text-xs font-medium transition-colors ${
                      hoveredDay === item.day ? 'font-bold text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Interactive Mini Calendar (3 cols on lg) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 font-bold text-xs text-slate-800 cursor-pointer hover:text-emerald-700">
              <span>June 2035</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-1">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
            {/* Previous month days */}
            <span className="py-1 text-slate-300">27</span>
            <span className="py-1 text-slate-300">28</span>
            <span className="py-1 text-slate-300">29</span>
            <span className="py-1 text-slate-300">30</span>
            <span className="py-1 text-slate-300">31</span>

            {/* Current month days 1..6 */}
            <span className="py-1 text-slate-700">1</span>
            <span className="py-1 text-slate-700">2</span>
            <span className="py-1 text-slate-700">3</span>
            <span className="py-1 text-slate-700">4</span>
            <span className="py-1 text-slate-700">5</span>
            <span className="py-1 text-slate-700">6</span>

            {/* Day 7: Red circle (Public Holiday) */}
            <span className="py-1 flex items-center justify-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 font-bold text-white shadow-sm">
                7
              </span>
            </span>

            <span className="py-1 text-slate-700">8</span>
            <span className="py-1 text-slate-700">9</span>
            <span className="py-1 text-slate-700">10</span>
            <span className="py-1 text-slate-700">11</span>
            <span className="py-1 text-slate-700">12</span>
            <span className="py-1 text-slate-700">13</span>
            <span className="py-1 text-slate-700">14</span>
            <span className="py-1 text-slate-700">15</span>
            <span className="py-1 text-slate-700">16</span>

            {/* Days 17-22: Green highlighted pills (Leaves) */}
            {[17, 18, 19, 20, 21, 22].map((day) => (
              <span key={day} className="py-1 flex items-center justify-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 font-semibold text-white shadow-sm">
                  {day}
                </span>
              </span>
            ))}

            <span className="py-1 text-slate-700">23</span>
            <span className="py-1 text-slate-700">24</span>
            <span className="py-1 text-slate-700">25</span>
            <span className="py-1 text-slate-700">26</span>
            <span className="py-1 text-slate-700">27</span>
            <span className="py-1 text-slate-700">28</span>
            <span className="py-1 text-slate-700">29</span>
            <span className="py-1 text-slate-700">30</span>
          </div>

          {/* Calendar Legend */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Public Holiday</span>
            </div>
          </div>
        </div>

        {/* Card 3: Employee Leaves List (2.5 cols on lg) */}
        <div className="lg:col-span-2.5 bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">Employee Leaves</h3>
            <button type="button" className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3.5 my-auto">
            {/* 1. Lina Armand */}
            <div className="flex items-center gap-2.5">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80"
                alt="Lina Armand"
                className="h-8 w-8 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">Lina Armand</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="text-emerald-700 font-semibold">Sick Leave</span>
                  <span>&bull;</span>
                  <span>20–22 June 2035</span>
                </div>
              </div>
            </div>

            {/* 2. Jacob Yuen */}
            <div className="flex items-center gap-2.5">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80"
                alt="Jacob Yuen"
                className="h-8 w-8 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">Jacob Yuen</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="text-emerald-700 font-semibold">Annual Leave</span>
                  <span>&bull;</span>
                  <span>17–21 June 2035</span>
                </div>
              </div>
            </div>

            {/* 3. Anya Rodriguez */}
            <div className="flex items-center gap-2.5">
              <img
                src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&auto=format&fit=crop&q=80"
                alt="Anya Rodriguez"
                className="h-8 w-8 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">Anya Rodriguez</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="text-emerald-700 font-semibold">Other Leave</span>
                  <span>&bull;</span>
                  <span>19 June 2035</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Leave Types Donut Chart Widget (2.5 cols on lg) */}
        <div className="lg:col-span-2.5 bg-white rounded-2xl p-5 shadow-sm border border-[#e4edea] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800">Leave Types</h3>
            <button type="button" className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* SVG Donut Ring with 6 Employees in Center */}
          <div className="relative flex items-center justify-center my-1">
            <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 100 100">
              {/* Background circle track */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#eef5f3"
                strokeWidth="11"
              />
              {/* Segment 1: Annual Leave 50% (emerald) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#059669"
                strokeWidth="11"
                strokeDasharray="119.38 238.76"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Segment 2: Sick Leave 33.3% (mint/cyan) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#10b981"
                strokeWidth="11"
                strokeDasharray="79.5 238.76"
                strokeDashoffset="-125"
                strokeLinecap="round"
              />
              {/* Segment 3: Other Leave 16.7% (pale mint) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#34d399"
                strokeWidth="11"
                strokeDasharray="39.8 238.76"
                strokeDashoffset="-205"
                strokeLinecap="round"
              />
            </svg>

            {/* Center Text: 6 Employees */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">6</span>
              <span className="text-[10px] font-medium text-slate-400">Employees</span>
            </div>
          </div>

          {/* Breakdown percentages */}
          <div className="space-y-1.5 mt-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 text-[10px]">
                  50%
                </span>
                <span className="text-slate-600 text-[11px] font-medium">Annual Leave</span>
              </div>
              <span className="text-slate-400 text-[10px]">3 employee</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 text-[10px]">
                  33.3%
                </span>
                <span className="text-slate-600 text-[11px] font-medium">Sick Leave</span>
              </div>
              <span className="text-slate-400 text-[10px]">2 employee</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 text-[10px]">
                  16.7%
                </span>
                <span className="text-slate-600 text-[11px] font-medium">Other Leaves</span>
              </div>
              <span className="text-slate-400 text-[10px]">1 employee</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 text-[10px]">
                  0%
                </span>
                <span className="text-slate-600 text-[11px] font-medium">Casual Leave</span>
              </div>
              <span className="text-slate-400 text-[10px]">0 employee</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BOTTOM SECTION: LEAVE ACTIVITY TABLE
         ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#e4edea] overflow-hidden">
        {/* Table Top Controls: Title, Search, Filter & + Apply Leave */}
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Leave Activity</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee, ID, etc"
                className="w-48 sm:w-60 rounded-full border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm"
              >
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span>Filter</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl z-20">
                  {(['ALL', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        setStatusFilter(status);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                        statusFilter === status
                          ? 'bg-emerald-50 font-bold text-emerald-800'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {status === 'ALL' ? 'All Statuses' : status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* + Apply Leave Action Button */}
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/30 transition-all hover:shadow"
            >
              <Plus className="h-4 w-4" />
              <span>Apply Leave</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-[#fafcfb] text-[11px] font-semibold text-slate-400">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredActivities.length > 0 &&
                      selectedIds.length === filteredActivities.length
                    }
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="py-3 px-3">Name ↕</th>
                <th className="py-3 px-3">Job Title ↕</th>
                <th className="py-3 px-3">Type ↕</th>
                <th className="py-3 px-3">Submit Date ↕</th>
                <th className="py-3 px-3">Period ↕</th>
                <th className="py-3 px-3">Duration ↕</th>
                <th className="py-3 px-3">Reason ↕</th>
                <th className="py-3 px-4 text-center">Status ↕</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No leave activities matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-[#f6faf8] ${
                        isSelected ? 'bg-[#f0f9f5]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Name + Avatar + EMP Code */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={row.avatarUrl}
                            alt={row.employeeName}
                            className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-slate-100"
                          />
                          <div>
                            <p className="font-bold text-slate-800 leading-tight">
                              {row.employeeName}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 leading-tight">
                              {row.employeeCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Job Title + Department */}
                      <td className="py-3.5 px-3">
                        <div>
                          <p className="font-medium text-slate-800 leading-tight">{row.jobTitle}</p>
                          <p className="text-[10px] text-slate-400 leading-tight">{row.department}</p>
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td className="py-3.5 px-3 font-medium text-slate-700">
                        {row.leaveType}
                      </td>

                      {/* Submit Date */}
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {row.submitDate}
                      </td>

                      {/* Period */}
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        {row.period}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {row.duration}
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-3 text-slate-500 max-w-xs truncate" title={row.reason}>
                        {row.reason}
                      </td>

                      {/* Status / Quick Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {row.status === 'Approved' && (
                          <span className="inline-flex items-center justify-center rounded-full bg-[#dcfce7] px-3 py-1 text-[11px] font-bold text-[#15803d]">
                            Approved
                          </span>
                        )}

                        {row.status === 'Rejected' && (
                          <span className="inline-flex items-center justify-center rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-700">
                            Rejected
                          </span>
                        )}

                        {row.status === 'Pending' && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAction(row, 'APPROVE')}
                              className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] hover:bg-[#bbf7d0] px-2.5 py-1 text-[11px] font-bold text-[#15803d] transition-all shadow-xs"
                              title="Approve this leave request"
                            >
                              <Check className="h-3 w-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(row, 'REJECT')}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Reject this leave request"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          APPLY LEAVE MODAL (Connected to real backend API)
         ========================================================================= */}
      {isApplyModalOpen && (
        <Modal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          title="Apply for Leave"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4">
            {applyError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{applyError}</span>
              </div>
            )}

            {/* Leave Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Leave Type <span className="text-red-500">*</span>
              </label>
              <select
                value={applyForm.leaveTypeId}
                onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              >
                {leaveTypes.length > 0 ? (
                  leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="ANNUAL">Annual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="CASUAL">Casual Leave</option>
                    <option value="OTHER">Other Leave</option>
                  </>
                )}
              </select>
            </div>

            {/* Date Range: Start and End */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={applyForm.startDate}
                  onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={applyForm.endDate}
                  onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Duration calculation banner */}
            {applyForm.startDate && applyForm.endDate && (
              <div className="rounded-xl bg-[#ecf7f3] p-3 text-xs border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">Working Days Requested: </span>
                  <span className="font-bold text-emerald-800">{requestedWorkingDays} day(s)</span>
                  <p className="text-[11px] text-slate-500">Excludes standard Saturdays and Sundays.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Available Balance</span>
                  <span className="font-bold text-emerald-700 text-sm">{availableDays} days</span>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Leave <span className="text-red-500">*</span>
              </label>
              <textarea
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                rows={3}
                placeholder="Provide details or reference for your line manager..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
