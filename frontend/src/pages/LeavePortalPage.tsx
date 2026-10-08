import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Calendar as CalendarIcon,
  Clock,
  User,
  Briefcase,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  FileText,
  ShieldCheck,
  RotateCcw,
  Bookmark,
  StickyNote,
  Trash2
} from 'lucide-react';
import { leaveApi } from '../api/leaveApi';
import { authApi } from '../api/authApi';
import { LeaveBalance, LeaveRequest, LeaveType, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import {
  getKenyanHolidaysForYear,
  isKenyanPublicHoliday,
  calculateKenyanWorkingDays
} from '../utils/kenyaHolidays';

export const LeavePortalPage: React.FC = () => {
  const { user, hasAnyRole } = useAuth();

  // Core state from backend
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Calendar State (Defaults to current system year & month)
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(today.getMonth()); // 0-indexed

  // Calendar Selection State (Range selection from the calendar)
  const [calendarSelectedStart, setCalendarSelectedStart] = useState<string | null>(null);
  const [calendarSelectedEnd, setCalendarSelectedEnd] = useState<string | null>(null);

  // Calendar Bookmarks and Notes State (Persisted in localStorage)
  const [dayAnnotations, setDayAnnotations] = useState<Record<string, { isBookmarked: boolean; note?: string }>>(() => {
    try {
      const saved = localStorage.getItem(`leave_calendar_annotations_${user?.id || 'default'}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Note & Bookmark Modal State
  const [noteModalDate, setNoteModalDate] = useState<string | null>(null);
  const [noteDraftText, setNoteDraftText] = useState<string>('');
  const [noteDraftBookmarked, setNoteDraftBookmarked] = useState<boolean>(false);

  const openNoteModal = (dateStr: string) => {
    setNoteModalDate(dateStr);
    const existing = dayAnnotations[dateStr];
    setNoteDraftText(existing?.note || '');
    setNoteDraftBookmarked(Boolean(existing?.isBookmarked));
  };

  const handleSaveNoteModal = () => {
    if (!noteModalDate) return;
    const updated = { ...dayAnnotations };
    if (noteDraftBookmarked || noteDraftText.trim()) {
      updated[noteModalDate] = {
        isBookmarked: noteDraftBookmarked,
        note: noteDraftText.trim() || undefined,
      };
    } else {
      delete updated[noteModalDate];
    }
    setDayAnnotations(updated);
    try {
      localStorage.setItem(
        `leave_calendar_annotations_${user?.id || 'default'}`,
        JSON.stringify(updated)
      );
    } catch {}
    setNoteModalDate(null);
    setFeedback({
      type: 'success',
      message: `Note and bookmark for ${noteModalDate} saved successfully.`,
    });
  };

  const handleDeleteNoteModal = () => {
    if (!noteModalDate) return;
    const updated = { ...dayAnnotations };
    delete updated[noteModalDate];
    setDayAnnotations(updated);
    try {
      localStorage.setItem(
        `leave_calendar_annotations_${user?.id || 'default'}`,
        JSON.stringify(updated)
      );
    } catch {}
    setNoteModalDate(null);
    setFeedback({
      type: 'success',
      message: `Bookmark and note for ${noteModalDate} removed.`,
    });
  };

  // Apply Leave Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [colleagues, setColleagues] = useState<UserProfile[]>([]);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    isHalfDay: false,
    halfDayPeriod: 'MORNING' as 'MORNING' | 'AFTERNOON',
    delegateId: '',
  });
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Table filters & active tab
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [activeTab, setActiveTab] = useState<'MY_REQUESTS' | 'APPROVALS' | 'ALL_ACTIVITY'>('MY_REQUESTS');

  // Load backend data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [balData, typesData, myReqData, colleaguesData] = await Promise.all([
        leaveApi.getMyBalances(currentYear).catch(() => []),
        leaveApi.getLeaveTypes().catch(() => []),
        leaveApi.getMyRequests().catch(() => []),
        authApi.getColleagues().catch(() => []),
      ]);

      setBalances(balData);
      setLeaveTypes(typesData);
      setMyRequests(myReqData);
      setColleagues(colleaguesData.filter((c) => c.id !== user?.id));

      if (typesData.length > 0 && !applyForm.leaveTypeId) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: typesData[0].id }));
      }

      // If user has manager or admin privileges, fetch approvals and team activity
      if (hasAnyRole(['LINE_MANAGER', 'HR_ADMIN'])) {
        const [pendingData, allData] = await Promise.all([
          leaveApi.getPendingApprovals().catch(() => []),
          leaveApi.getAllRequests().catch(() => []),
        ]);
        setPendingApprovals(pendingData);
        setAllRequests(allData);
      }
    } catch (err: any) {
      console.error('Failed to load leave portal data', err);
      setFeedback({
        type: 'error',
        message: 'Unable to refresh latest leave records from server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentYear]);

  // Calendar Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonthIndex(today.getMonth());
  };

  // Calendar days generation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonthIndex, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
      holidayInfo: { isHoliday: boolean; holidayName?: string };
      hasApprovedLeave: boolean;
      hasPendingLeave: boolean;
      annotation?: { isBookmarked: boolean; note?: string };
    }> = [];

    const pad = (n: number) => n.toString().padStart(2, '0');

    // Previous month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;
      const prevYear = currentMonthIndex === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${pad(prevMonth + 1)}-${pad(dayNum)}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: new Date(prevYear, prevMonth, dayNum).getDay() === 0 || new Date(prevYear, prevMonth, dayNum).getDay() === 6,
        holidayInfo: isKenyanPublicHoliday(dateStr),
        hasApprovedLeave: false,
        hasPendingLeave: false,
        annotation: dayAnnotations[dateStr],
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${currentYear}-${pad(currentMonthIndex + 1)}-${pad(d)}`;
      const dateObj = new Date(currentYear, currentMonthIndex, d);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday =
        dateObj.getDate() === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear();

      // Check user's leave requests falling on this date
      const hasApproved = myRequests.some((req) => {
        return (
          req.status === 'APPROVED' &&
          dateStr >= req.startDate &&
          dateStr <= req.endDate
        );
      });

      const hasPending = myRequests.some((req) => {
        return (
          req.status === 'PENDING' &&
          dateStr >= req.startDate &&
          dateStr <= req.endDate
        );
      });

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        isWeekend,
        holidayInfo: isKenyanPublicHoliday(dateStr),
        hasApprovedLeave: hasApproved,
        hasPendingLeave: hasPending,
        annotation: dayAnnotations[dateStr],
      });
    }

    // Trailing padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
      const nextMonth = currentMonthIndex === 11 ? 0 : currentMonthIndex + 1;
      const nextYear = currentMonthIndex === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${pad(nextMonth + 1)}-${pad(j)}`;
      days.push({
        dateStr,
        dayNumber: j,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: new Date(nextYear, nextMonth, j).getDay() === 0 || new Date(nextYear, nextMonth, j).getDay() === 6,
        holidayInfo: isKenyanPublicHoliday(dateStr),
        hasApprovedLeave: false,
        hasPendingLeave: false,
        annotation: dayAnnotations[dateStr],
      });
    }

    return days;
  }, [currentYear, currentMonthIndex, today, myRequests, dayAnnotations]);

  // Click handler to select leave days from calendar
  const handleCalendarDayClick = (dateStr: string) => {
    if (!calendarSelectedStart || (calendarSelectedStart && calendarSelectedEnd)) {
      // First click: Select start date
      setCalendarSelectedStart(dateStr);
      setCalendarSelectedEnd(null);
    } else {
      // Second click: Select end date
      if (dateStr < calendarSelectedStart) {
        setCalendarSelectedEnd(calendarSelectedStart);
        setCalendarSelectedStart(dateStr);
      } else {
        setCalendarSelectedEnd(dateStr);
      }
    }
  };

  const clearCalendarSelection = () => {
    setCalendarSelectedStart(null);
    setCalendarSelectedEnd(null);
  };

  // Selected calendar working days calculation (using Kenyan holiday rules)
  const calendarWorkingDaysSelected = useMemo(() => {
    if (!calendarSelectedStart) return 0;
    const end = calendarSelectedEnd || calendarSelectedStart;
    return calculateKenyanWorkingDays(calendarSelectedStart, end);
  }, [calendarSelectedStart, calendarSelectedEnd]);

  // Open modal with calendar selected dates
  const handleApplyWithSelectedCalendarDates = (leaveTypeId?: string) => {
    setApplyForm({
      leaveTypeId: leaveTypeId || applyForm.leaveTypeId || (leaveTypes[0]?.id || ''),
      startDate: calendarSelectedStart || '',
      endDate: calendarSelectedEnd || calendarSelectedStart || '',
      reason: '',
    });
    setApplyError(null);
    setIsApplyModalOpen(true);
  };

  // Calculate working days for current apply form
  const requestedWorkingDays = useMemo(() => {
    if (applyForm.isHalfDay) {
      if (!applyForm.startDate) return 0;
      const days = calculateKenyanWorkingDays(applyForm.startDate, applyForm.startDate);
      return days > 0 ? 0.5 : 0;
    }
    return calculateKenyanWorkingDays(applyForm.startDate, applyForm.endDate);
  }, [applyForm.startDate, applyForm.endDate, applyForm.isHalfDay]);

  // Selected balance in apply form
  const selectedBalance = balances.find((b) => b.leaveTypeId === applyForm.leaveTypeId);
  const availableDays = selectedBalance ? Number(selectedBalance.availableDays) || 0 : 0;
  const isInsufficient = requestedWorkingDays > availableDays && Boolean(applyForm.startDate && (applyForm.isHalfDay || applyForm.endDate));

  // Submit leave request to backend API
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError(null);

    const effectiveEndDate = applyForm.isHalfDay ? applyForm.startDate : applyForm.endDate;

    if (!applyForm.isHalfDay && new Date(effectiveEndDate) < new Date(applyForm.startDate)) {
      setApplyError('End date cannot precede the start date.');
      return;
    }
    if (requestedWorkingDays === 0) {
      setApplyError('Leave request must include at least one working day (Kenyan public holidays and weekends are excluded).');
      return;
    }
    if (isInsufficient) {
      setApplyError(`Insufficient balance. You requested ${requestedWorkingDays} day(s), but only have ${availableDays} available.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await leaveApi.submitRequest({
        leaveTypeId: applyForm.leaveTypeId,
        startDate: applyForm.startDate,
        endDate: effectiveEndDate,
        reason: applyForm.reason.trim(),
        isHalfDay: applyForm.isHalfDay,
        halfDayPeriod: applyForm.isHalfDay ? applyForm.halfDayPeriod : undefined,
        delegateId: applyForm.delegateId || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Leave application for ${requestedWorkingDays} day(s) submitted successfully. Routed to line manager for approval.`,
      });

      setIsApplyModalOpen(false);
      clearCalendarSelection();
      setApplyForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: '',
        endDate: '',
        reason: '',
        isHalfDay: false,
        halfDayPeriod: 'MORNING',
        delegateId: '',
      });

      // Reload balances and request queue
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error?.details || 'Failed to submit leave request.';
      setApplyError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel own pending request
  const handleCancelRequest = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) return;

    try {
      await leaveApi.cancelRequest(requestId);
      setFeedback({
        type: 'success',
        message: 'Leave request successfully cancelled and hold released from balance.',
      });
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to cancel leave request.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  // Manager Approve / Reject actions
  const handleManagerDecision = async (requestId: string, decision: 'APPROVE' | 'REJECT') => {
    const reasonPrompt = decision === 'REJECT' ? window.prompt('Optional reason for rejection:') : undefined;
    if (decision === 'REJECT' && reasonPrompt === null) return; // User cancelled prompt

    try {
      if (decision === 'APPROVE') {
        await leaveApi.approveRequest(requestId, 'Approved by manager');
      } else {
        await leaveApi.rejectRequest(requestId, reasonPrompt || 'Rejected by manager');
      }

      setFeedback({
        type: 'success',
        message: `Leave request successfully ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`,
      });
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || `Failed to ${decision.toLowerCase()} request.`;
      setFeedback({ type: 'error', message: msg });
    }
  };

  // Filtered requests for the active table
  const displayedRequests = useMemo(() => {
    let source = myRequests;
    if (activeTab === 'APPROVALS') {
      source = pendingApprovals;
    } else if (activeTab === 'ALL_ACTIVITY') {
      source = allRequests;
    }

    return source.filter((req) => {
      const matchesSearch =
        (req.employeeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.leaveTypeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.reason || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || req.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [activeTab, myRequests, pendingApprovals, allRequests, searchQuery, statusFilter]);

  // Overall totals calculation
  const totalAvailableAcrossTypes = useMemo(() => {
    return balances.reduce((sum, b) => sum + (Number(b.availableDays) || 0), 0);
  }, [balances]);

  const totalUsedAcrossTypes = useMemo(() => {
    return balances.reduce((sum, b) => sum + (Number(b.usedDays) || 0), 0);
  }, [balances]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Feedback Alert Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 shadow-2xs border transition-all ${
            feedback.type === 'success'
              ? 'bg-[#e3f4f1] border-teal-200 text-[#0e4a5c]'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-teal-700 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: EMPLOYEE DETAILS & EMPLOYMENT HEADER
         ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-teal-100 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0e4a5c] text-white font-bold text-lg shadow-sm">
              {user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : 'EM'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#0d2836]">
                  {user?.fullName || 'Authenticated Employee'}
                </h2>
                <span className="rounded-md bg-[#e3f4f1] px-2 py-0.5 text-[11px] font-bold text-[#0e4a5c] border border-teal-200/80">
                  {user?.employeeCode || 'EMP-2026'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-teal-700" />
                  <span>{user?.jobTitle || 'Team Member'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-teal-700" />
                  <span>{user?.department?.name || 'Department'}</span>
                </div>
                {user?.manager && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-teal-700" />
                    <span>Manager: <strong className="text-slate-700">{user.manager.fullName}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setApplyForm({
                  leaveTypeId: leaveTypes[0]?.id || '',
                  startDate: '',
                  endDate: '',
                  reason: '',
                });
                setIsApplyModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Apply for Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: ALL LEAVE TYPES & LIVE BALANCES GRID
         ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="text-sm font-bold text-[#0d2836]">
              Leave Entitlements &amp; Balances ({currentYear})
            </h3>
            <p className="text-xs text-slate-500">
              Your real-time statutory allocations and remaining available working days.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Total Available</span>
            <span className="text-base font-bold text-[#0e4a5c]">
              {totalAvailableAcrossTypes} Days
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.length === 0 ? (
            <div className="col-span-4 bg-white rounded-2xl p-6 text-center border border-teal-100 text-xs text-slate-500">
              No leave balance records found for year {currentYear}. Please contact your HR administrator.
            </div>
          ) : (
            balances.map((balance) => {
              const entitled = Number(balance.entitledDays) || 0;
              const used = Number(balance.usedDays) || 0;
              const pending = Number(balance.pendingDays) || 0;
              const available = Number(balance.availableDays) || 0;
              const carried = Number(balance.carriedOverDays) || 0;
              const totalQuota = entitled + carried;
              const percentageUsed = totalQuota > 0 ? Math.min(100, Math.round((used / totalQuota) * 100)) : 0;

              return (
                <div
                  key={balance.id || balance.leaveTypeId}
                  className="bg-white rounded-2xl p-5 border border-teal-100 shadow-2xs flex flex-col justify-between transition-all hover:border-teal-200"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0d2836] truncate">
                        {balance.leaveTypeName}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#0e4a5c] bg-[#e3f4f1] px-1.5 py-0.5 rounded">
                        {balance.leaveTypeCode}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold text-[#0e4a5c]">
                        {available}
                      </span>
                      <span className="text-xs font-medium text-slate-500">Days Available</span>
                    </div>

                    {/* Usage Progress Bar */}
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Used: {used} d</span>
                        <span>Quota: {totalQuota} d</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-[#0e4a5c] rounded-full transition-all duration-300"
                          style={{ width: `${percentageUsed}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-teal-50 flex items-center justify-between text-[11px]">
                    <div className="text-slate-500">
                      <span>Pending: </span>
                      <strong className="text-amber-700">{pending} d</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setApplyForm({
                          leaveTypeId: balance.leaveTypeId,
                          startDate: calendarSelectedStart || '',
                          endDate: calendarSelectedEnd || calendarSelectedStart || '',
                          reason: '',
                        });
                        setIsApplyModalOpen(true);
                      }}
                      className="text-xs font-bold text-[#0e4a5c] hover:text-[#083543] hover:underline"
                    >
                      Apply &rarr;
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: LEAVE CALENDAR & INTERACTIVE DATE PICKER
         ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-teal-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-teal-50 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e3f4f1] text-[#0e4a5c]">
              <CalendarDays className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0d2836]">
                Leave Calendar
              </h3>
              <p className="text-[11px] text-slate-500">
                Choose leave days or click any day to add bookmarks and notes.
              </p>
            </div>
          </div>

          {/* Month & Year Dropdown Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleResetToCurrentMonth}
              className="px-2 py-1 text-xs font-semibold text-[#0e4a5c] hover:bg-[#f0f9f8] rounded-lg border border-teal-200"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg border border-teal-200 text-slate-600 hover:bg-[#f0f9f8] hover:text-[#0d2836]"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Month Dropdown */}
            <select
              value={currentMonthIndex}
              onChange={(e) => setCurrentMonthIndex(Number(e.target.value))}
              className="rounded-lg border border-teal-200 bg-white px-2 py-1 text-xs font-bold text-[#0d2836] focus:border-[#0e4a5c] focus:outline-none"
            >
              {monthNames.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="rounded-lg border border-teal-200 bg-white px-2 py-1 text-xs font-bold text-[#0d2836] focus:border-[#0e4a5c] focus:outline-none"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg border border-teal-200 text-slate-600 hover:bg-[#f0f9f8] hover:text-[#0d2836]"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Calendar Interactive Selection Banner */}
        {calendarSelectedStart && (
          <div className="mt-3 rounded-xl bg-[#e3f4f1] border border-teal-200 p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div>
              <div className="flex items-center gap-2 font-bold text-[#0e4a5c]">
                <Clock className="h-3.5 w-3.5" />
                <span>Selected Range:</span>
                <span className="bg-white px-2 py-0.5 rounded border border-teal-200 text-[#0d2836]">
                  {calendarSelectedStart} {calendarSelectedEnd && calendarSelectedEnd !== calendarSelectedStart ? `to ${calendarSelectedEnd}` : ''}
                </span>
                <span className="font-bold text-[#0d2836]">
                  ({calendarWorkingDaysSelected} working day{calendarWorkingDaysSelected !== 1 ? 's' : ''})
                </span>
              </div>
              <p className="text-[10px] text-[#155b6e] mt-0.5">
                Statutory calculation: Weekends and public holidays are automatically excluded.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openNoteModal(calendarSelectedStart)}
                className="px-2.5 py-1 rounded-lg border border-teal-200 text-xs font-semibold text-[#0e4a5c] bg-white hover:bg-slate-50 flex items-center gap-1"
                title="Add or edit note and bookmark for this date"
              >
                <Bookmark className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span>Note / Bookmark</span>
              </button>
              <button
                type="button"
                onClick={clearCalendarSelection}
                className="px-2.5 py-1 rounded-lg border border-teal-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleApplyWithSelectedCalendarDates()}
                className="px-3.5 py-1 rounded-lg bg-[#0e4a5c] hover:bg-[#083543] text-xs font-bold text-white shadow-xs"
              >
                Apply for These Dates
              </button>
            </div>
          </div>
        )}

        {/* Days of Week Headers */}
        <div className="mt-2.5 grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 py-1 border-b border-teal-50">
          <span className="text-rose-500">Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span className="text-rose-500">Sat</span>
        </div>

        {/* Resized, Compact Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1 pt-1.5">
          {calendarDays.map((dayItem, index) => {
            const isSelectedStart = calendarSelectedStart === dayItem.dateStr;
            const isSelectedEnd = calendarSelectedEnd === dayItem.dateStr;
            const isInSelectedRange =
              calendarSelectedStart &&
              calendarSelectedEnd &&
              dayItem.dateStr >= calendarSelectedStart &&
              dayItem.dateStr <= calendarSelectedEnd;

            return (
              <div
                key={`${dayItem.dateStr}-${index}`}
                onClick={() => handleCalendarDayClick(dayItem.dateStr)}
                className={`min-h-[46px] sm:min-h-[50px] p-1 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between relative group ${
                  !dayItem.isCurrentMonth
                    ? 'bg-slate-50/50 border-transparent text-slate-300 opacity-60'
                    : isSelectedStart || isSelectedEnd
                    ? 'bg-[#0e4a5c] border-[#0e4a5c] text-white shadow-xs'
                    : isInSelectedRange
                    ? 'bg-[#e3f4f1] border-teal-200 text-[#0e4a5c]'
                    : dayItem.holidayInfo.isHoliday
                    ? 'bg-rose-50/60 border-rose-200 hover:border-rose-300'
                    : dayItem.hasApprovedLeave
                    ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
                    : dayItem.hasPendingLeave
                    ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
                    : 'bg-white border-slate-100 hover:border-teal-200 hover:bg-[#f0f9f8]'
                }`}
                title={
                  dayItem.holidayInfo.holidayName
                    ? `Public Holiday: ${dayItem.holidayInfo.holidayName}`
                    : dayItem.annotation?.note
                    ? `Note: ${dayItem.annotation.note}`
                    : dayItem.dateStr
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      dayItem.isToday
                        ? isSelectedStart || isSelectedEnd
                          ? 'bg-white text-[#0e4a5c]'
                          : 'bg-[#0e4a5c] text-white'
                        : isSelectedStart || isSelectedEnd
                        ? 'text-white'
                        : dayItem.isWeekend
                        ? 'text-slate-400'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayItem.dayNumber}
                  </span>

                  {/* Badges / Icons for Bookmarks, Notes, Holidays */}
                  <div className="flex items-center gap-1 shrink-0">
                    {dayItem.annotation?.isBookmarked && (
                      <Bookmark className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" title="Bookmarked Date" />
                    )}
                    {dayItem.annotation?.note && (
                      <StickyNote className="h-3 w-3 text-teal-700 shrink-0" title={`Note: ${dayItem.annotation.note}`} />
                    )}
                    {dayItem.holidayInfo.isHoliday && (
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" title={dayItem.holidayInfo.holidayName} />
                    )}
                    {dayItem.hasApprovedLeave && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Approved Leave" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNoteModal(dayItem.dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-[#0e4a5c] transition-opacity"
                      title="Add / Edit Note & Bookmark"
                    >
                      <Bookmark className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>

                {/* Compact Day Content Label */}
                <div className="leading-none overflow-hidden">
                  {dayItem.holidayInfo.isHoliday ? (
                    <p
                      className={`text-[9px] font-bold leading-tight truncate ${
                        isSelectedStart || isSelectedEnd ? 'text-white/90' : 'text-rose-700'
                      }`}
                      title={dayItem.holidayInfo.holidayName}
                    >
                      {dayItem.holidayInfo.holidayName}
                    </p>
                  ) : dayItem.annotation?.note ? (
                    <p
                      className="text-[9px] truncate text-slate-500 italic leading-tight"
                      title={dayItem.annotation.note}
                    >
                      {dayItem.annotation.note}
                    </p>
                  ) : dayItem.hasApprovedLeave ? (
                    <p className="text-[9px] font-semibold text-emerald-700 leading-tight">Leave</p>
                  ) : dayItem.hasPendingLeave ? (
                    <p className="text-[9px] font-semibold text-amber-700 leading-tight">Pending</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Calendar Legend */}
        <div className="mt-3 pt-2.5 border-t border-teal-50 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2.5">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span>Public Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Approved Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Pending Approval</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[#0e4a5c]" />
              <span>Selected Range</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bookmark className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span>Bookmark / Note</span>
            </div>
          </div>
          <div className="text-[10px] text-teal-800 font-medium">
            &bull; Weekends &amp; holidays automatically excluded from working leave days.
          </div>
        </div>
      </div>

      {/* Day Note & Bookmark Modal */}
      {noteModalDate && (
        <Modal
          isOpen={Boolean(noteModalDate)}
          onClose={() => setNoteModalDate(null)}
          title={`Date Note & Bookmark (${noteModalDate})`}
        >
          <div className="space-y-4 text-xs">
            {/* Holiday / status indicator banner */}
            {(() => {
              const holiday = isKenyanPublicHoliday(noteModalDate);
              if (holiday.isHoliday) {
                return (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>Public Holiday: <strong>{holiday.holidayName}</strong></span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Bookmark Checkbox Toggle */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-teal-100 bg-[#f8faf9] cursor-pointer hover:bg-[#eef7f5] transition">
              <input
                type="checkbox"
                checked={noteDraftBookmarked}
                onChange={(e) => setNoteDraftBookmarked(e.target.checked)}
                className="h-4 w-4 rounded border-teal-300 text-[#0e4a5c] focus:ring-[#0e4a5c]"
              />
              <div className="flex items-center gap-1.5">
                <Bookmark className={`h-4 w-4 ${noteDraftBookmarked ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                <span className="font-bold text-[#0d2836]">Bookmark this date</span>
              </div>
            </label>

            {/* Personal Note Textarea */}
            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Personal Note / Reminder
              </label>
              <textarea
                value={noteDraftText}
                onChange={(e) => setNoteDraftText(e.target.value)}
                rows={3}
                placeholder="Add notes, schedule reminders, handover info, appointments..."
                className="w-full rounded-xl border border-teal-200/90 bg-white p-2.5 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-teal-50">
              {dayAnnotations[noteModalDate] ? (
                <button
                  type="button"
                  onClick={handleDeleteNoteModal}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Note</span>
                </button>
              ) : <span />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModalDate(null)}
                  className="rounded-xl border border-teal-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNoteModal}
                  className="rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          SECTION 4: BALANCED TASKS & LEAVE ACTIVITY QUEUE
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-teal-100 shadow-2xs overflow-hidden">
        {/* Tab navigation for requests */}
        <div className="p-4 border-b border-teal-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafcfb]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('MY_REQUESTS')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                activeTab === 'MY_REQUESTS'
                  ? 'bg-[#0e4a5c] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0d2836] hover:bg-slate-100'
              }`}
            >
              My Leave Requests ({myRequests.length})
            </button>

            {hasAnyRole(['LINE_MANAGER', 'HR_ADMIN']) && (
              <button
                type="button"
                onClick={() => setActiveTab('APPROVALS')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                  activeTab === 'APPROVALS'
                    ? 'bg-[#0e4a5c] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-[#0d2836] hover:bg-slate-100'
                }`}
              >
                <span>Pending Approvals</span>
                {pendingApprovals.length > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white font-bold">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>
            )}

            {hasAnyRole(['LINE_MANAGER', 'HR_ADMIN']) && (
              <button
                type="button"
                onClick={() => setActiveTab('ALL_ACTIVITY')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                  activeTab === 'ALL_ACTIVITY'
                    ? 'bg-[#0e4a5c] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-[#0d2836] hover:bg-slate-100'
                }`}
              >
                All Team Activity ({allRequests.length})
              </button>
            )}
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="w-44 sm:w-56 rounded-xl border border-teal-200/80 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-teal-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#0e4a5c] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-teal-50 bg-[#f8faf9] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Working Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50 text-xs">
              {displayedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No leave requests found for this filter.
                  </td>
                </tr>
              ) : (
                displayedRequests.map((req) => {
                  const isOwner = user?.id === req.userId;
                  return (
                    <tr key={req.id} className="hover:bg-[#f6faf8] transition-colors">
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-[#0d2836]">
                            {req.employeeName || user?.fullName || 'Employee'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {req.employeeEmail || user?.email}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-[#0e4a5c]">
                        {req.leaveTypeName || req.leaveTypeCode || 'Leave'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        <div>
                          <span>{req.startDate}{req.startDate !== req.endDate ? ` to ${req.endDate}` : ''}</span>
                          {req.isHalfDay && (
                            <span className="block text-[10px] font-semibold text-[#0e4a5c]">
                              Half Day ({req.halfDayPeriod === 'AFTERNOON' ? 'Afternoon' : 'Morning'})
                            </span>
                          )}
                          {req.delegateName && (
                            <span className="block text-[10px] text-slate-500">
                              Backup: {req.delegateName}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-[#0d2836]">
                        {req.totalDays} day{req.totalDays !== 1 ? 's' : ''}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>

                      <td className="py-3.5 px-4">
                        {req.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Approved</span>
                          </span>
                        )}

                        {req.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                            <XCircle className="h-3 w-3" />
                            <span>Rejected</span>
                          </span>
                        )}

                        {req.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            <Clock className="h-3 w-3" />
                            <span>Pending Approval</span>
                          </span>
                        )}

                        {req.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                            Cancelled
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {/* If user is manager/admin and on pending approvals tab or viewing a pending request */}
                        {hasAnyRole(['LINE_MANAGER', 'HR_ADMIN']) && req.status === 'PENDING' && !isOwner && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleManagerDecision(req.id, 'APPROVE')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 text-xs font-bold transition shadow-xs"
                            >
                              <Check className="h-3 w-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleManagerDecision(req.id, 'REJECT')}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 px-2.5 py-1 text-xs font-semibold transition"
                            >
                              <X className="h-3 w-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}

                        {/* If user is the owner and request is still PENDING, allow cancellation */}
                        {isOwner && req.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(req.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 px-2.5 py-1 text-xs font-semibold transition"
                          >
                            <span>Cancel</span>
                          </button>
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
          MODAL: APPLY LEAVE WITH KENYAN STATUTORY CALCULATIONS
         ========================================================================= */}
      {isApplyModalOpen && (
        <Modal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          title="Apply for Leave"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4">
            {applyError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{applyError}</span>
              </div>
            )}

            {/* Leave Type Selector */}
            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Leave Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={applyForm.leaveTypeId}
                onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
                required
              >
                {leaveTypes.map((t) => {
                  const bal = balances.find((b) => b.leaveTypeId === t.id);
                  const avail = bal ? Number(bal.availableDays) || 0 : 0;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) &mdash; {avail} days available
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Half-Day Option Toggle */}
            <div className="rounded-xl border border-teal-100 bg-[#e3f4f1]/40 p-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyForm.isHalfDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setApplyForm({
                      ...applyForm,
                      isHalfDay: checked,
                      endDate: checked ? applyForm.startDate : applyForm.endDate,
                    });
                  }}
                  className="rounded border-teal-300 text-[#0e4a5c] focus:ring-[#0e4a5c] h-4 w-4"
                />
                <span className="text-xs font-bold text-[#0d2836]">Half-Day Leave (0.5 working day)</span>
              </label>

              {applyForm.isHalfDay && (
                <div className="mt-2.5 pt-2 border-t border-teal-100 flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 font-medium">Session:</span>
                  <button
                    type="button"
                    onClick={() => setApplyForm({ ...applyForm, halfDayPeriod: 'MORNING' })}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      applyForm.halfDayPeriod === 'MORNING'
                        ? 'bg-[#0e4a5c] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-teal-200 hover:bg-teal-50'
                    }`}
                  >
                    Morning (First Half)
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyForm({ ...applyForm, halfDayPeriod: 'AFTERNOON' })}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      applyForm.halfDayPeriod === 'AFTERNOON'
                        ? 'bg-[#0e4a5c] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-teal-200 hover:bg-teal-50'
                    }`}
                  >
                    Afternoon (Second Half)
                  </button>
                </div>
              )}
            </div>

            {/* Date Pickers */}
            <div className={`grid gap-3 ${applyForm.isHalfDay ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div>
                <label className="block text-xs font-bold text-[#0d2836] mb-1">
                  {applyForm.isHalfDay ? 'Leave Date' : 'Start Date'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={applyForm.startDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setApplyForm({
                      ...applyForm,
                      startDate: newStart,
                      endDate: applyForm.isHalfDay ? newStart : applyForm.endDate,
                    });
                  }}
                  className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
                  required
                />
              </div>

              {!applyForm.isHalfDay && (
                <div>
                  <label className="block text-xs font-bold text-[#0d2836] mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={applyForm.endDate}
                    onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                    className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
                    required
                  />
                </div>
              )}
            </div>

            {/* Coverage Delegate / Backup Colleague */}
            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Coverage Delegate / Backup Colleague <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={applyForm.delegateId}
                onChange={(e) => setApplyForm({ ...applyForm, delegateId: e.target.value })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              >
                <option value="">-- No delegate assigned --</option>
                {colleagues.map((colleague) => (
                  <option key={colleague.id} value={colleague.id}>
                    {colleague.fullName} ({colleague.jobTitle || colleague.roles?.join(', ') || colleague.email})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                While you are on approved leave, tickets assigned to you will automatically re-route to this colleague.
              </p>
            </div>

            {/* Working Days & Holiday notice banner */}
            {applyForm.startDate && applyForm.endDate && (
              <div className="rounded-xl bg-[#e3f4f1] p-3 text-xs border border-teal-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0d2836]">Working Days Requested: </span>
                  <span className="font-extrabold text-[#0e4a5c] text-sm">
                    {requestedWorkingDays} day{requestedWorkingDays !== 1 ? 's' : ''}
                  </span>
                  <p className="text-[11px] text-[#155b6e] mt-0.5">
                    Excludes Kenyan statutory holidays &amp; weekends.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Available Balance</span>
                  <span className={`font-bold text-sm ${isInsufficient ? 'text-rose-600' : 'text-[#0e4a5c]'}`}>
                    {availableDays} days
                  </span>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Reason for Leave <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                rows={3}
                placeholder="Provide details or comments for line manager approval..."
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-teal-50">
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="rounded-xl border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isInsufficient}
                className="flex items-center gap-1.5 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
