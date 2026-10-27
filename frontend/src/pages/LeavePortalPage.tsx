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
  RefreshCw,
  Bookmark,
  StickyNote,
  Trash2,
  Paperclip,
  Download,
  Coins,
  Users
} from 'lucide-react';
import { leaveApi } from '../api/leaveApi';
import { authApi } from '../api/authApi';
import {
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  UserProfile,
  CompOffRequest,
  LeaveEncashmentRequest,
  DepartmentOverlapItem,
  TeamCapacityDay
} from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
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
    attachmentUrl: '',
    isHalfDay: false,
    halfDayPeriod: 'MORNING' as 'MORNING' | 'AFTERNOON',
    delegateId: '',
    documentType: '',
    documentNumber: '',
    medicalCertIssueDate: '',
  });
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Department Overlap State
  const [departmentOverlap, setDepartmentOverlap] = useState<DepartmentOverlapItem[]>([]);
  const [isLoadingOverlap, setIsLoadingOverlap] = useState(false);

  // Team Capacity & Absence Heatmap State
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);
  const [teamCapacity, setTeamCapacity] = useState<TeamCapacityDay[]>([]);
  const [isLoadingCapacity, setIsLoadingCapacity] = useState(false);

  // Leave Details Modal State
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<LeaveRequest | null>(null);

  // Compensatory Off (Comp-Off) State
  const [myCompOffs, setMyCompOffs] = useState<CompOffRequest[]>([]);
  const [isCompOffModalOpen, setIsCompOffModalOpen] = useState(false);
  const [compOffForm, setCompOffForm] = useState({
    workedDate: '',
    daysEarned: 1.0,
    reason: '',
  });
  const [isSubmittingCompOff, setIsSubmittingCompOff] = useState(false);

  // Leave Encashment State
  const [myEncashments, setMyEncashments] = useState<LeaveEncashmentRequest[]>([]);
  const [isEncashmentModalOpen, setIsEncashmentModalOpen] = useState(false);
  const [encashmentForm, setEncashmentForm] = useState({
    leaveTypeId: '',
    daysRequested: 1.0,
    reason: '',
  });
  const [isSubmittingEncashment, setIsSubmittingEncashment] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Table filters & active tab
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [activeTab, setActiveTab] = useState<'MY_REQUESTS' | 'APPROVALS' | 'ALL_ACTIVITY' | 'COMP_OFF' | 'ENCASHMENT'>('MY_REQUESTS');

  // Load backend data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [balData, typesData, myReqData, colleaguesData, compOffData, encashData] = await Promise.all([
        leaveApi.getMyBalances(currentYear).catch(() => []),
        leaveApi.getLeaveTypes().catch(() => []),
        leaveApi.getMyRequests().catch(() => []),
        authApi.getColleagues().catch(() => []),
        leaveApi.getMyCompOffRequests().catch(() => []),
        leaveApi.getMyEncashmentRequests().catch(() => []),
      ]);

      setBalances(balData);
      setLeaveTypes(typesData);
      setMyRequests(myReqData);
      setColleagues(colleaguesData.filter((c) => c.id !== user?.id));
      setMyCompOffs(compOffData);
      setMyEncashments(encashData);

      if (typesData.length > 0 && !applyForm.leaveTypeId) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: typesData[0].id }));
      }
      if (typesData.length > 0 && !encashmentForm.leaveTypeId) {
        setEncashmentForm((prev) => ({ ...prev, leaveTypeId: typesData[0].id }));
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

  const handleOpenCapacityModal = async () => {
    setIsCapacityModalOpen(true);
    setIsLoadingCapacity(true);
    try {
      const data = await leaveApi.getTeamCapacity();
      setTeamCapacity(data);
    } catch {
      setFeedback({
        type: 'error',
        message: 'Unable to load team capacity heatmap from server.',
      });
    } finally {
      setIsLoadingCapacity(false);
    }
  };

  const handleExportMyIcs = async () => {
    try {
      await leaveApi.downloadMyLeavesIcs();
      setFeedback({
        type: 'success',
        message: 'Personal leave calendar (.ics) downloaded. Import it to Google Calendar, Outlook, or Apple Calendar.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to download calendar feed.',
      });
    }
  };

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
      isHalfDay: false,
      halfDayPeriod: 'MORNING',
      delegateId: '',
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
        attachmentUrl: applyForm.attachmentUrl || undefined,
        isHalfDay: applyForm.isHalfDay,
        halfDayPeriod: applyForm.isHalfDay ? applyForm.halfDayPeriod : undefined,
        delegateId: applyForm.delegateId || undefined,
        documentType: applyForm.documentType.trim() || undefined,
        documentNumber: applyForm.documentNumber.trim() || undefined,
        medicalCertIssueDate: applyForm.medicalCertIssueDate || undefined,
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
        attachmentUrl: '',
        isHalfDay: false,
        halfDayPeriod: 'MORNING',
        delegateId: '',
        documentType: '',
        documentNumber: '',
        medicalCertIssueDate: '',
      });
      setDepartmentOverlap([]);

      // Reload balances and request queue
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error?.details || 'Failed to submit leave request.';
      setApplyError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Department Overlap Live Fetcher
  useEffect(() => {
    if (isApplyModalOpen && applyForm.startDate && (applyForm.isHalfDay || applyForm.endDate)) {
      const endD = applyForm.isHalfDay ? applyForm.startDate : applyForm.endDate;
      let isMounted = true;
      setIsLoadingOverlap(true);
      leaveApi.getDepartmentOverlap(applyForm.startDate, endD)
        .then((data) => {
          if (isMounted) setDepartmentOverlap(data);
        })
        .catch(() => {
          if (isMounted) setDepartmentOverlap([]);
        })
        .finally(() => {
          if (isMounted) setIsLoadingOverlap(false);
        });
      return () => {
        isMounted = false;
      };
    } else {
      setDepartmentOverlap([]);
    }
  }, [isApplyModalOpen, applyForm.startDate, applyForm.endDate, applyForm.isHalfDay]);

  // Handle Attachment Upload in Apply Form
  const handleAttachmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAttachment(true);
    setApplyError(null);
    try {
      const url = await leaveApi.uploadAttachment(file);
      setApplyForm((prev) => ({ ...prev, attachmentUrl: url }));
      setFeedback({
        type: 'success',
        message: `Document '${file.name}' attached successfully.`,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload attachment.';
      setApplyError(msg);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // 1-Click Calendar (.ics) Download
  const handleDownloadIcs = async (requestId: string, leaveName: string) => {
    try {
      const blob = await leaveApi.downloadCalendarIcs(requestId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leave-${requestId}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setFeedback({
        type: 'success',
        message: `Calendar invitation (.ics) downloaded for ${leaveName}. Sync ready with Google & Outlook Calendar.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Unable to generate calendar export file.',
      });
    }
  };

  // Compensatory Off Submit
  const handleCompOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCompOff(true);
    try {
      await leaveApi.submitCompOff({
        workedDate: compOffForm.workedDate,
        daysEarned: Number(compOffForm.daysEarned) || 1.0,
        reason: compOffForm.reason.trim(),
      });
      setIsCompOffModalOpen(false);
      setCompOffForm({ workedDate: '', daysEarned: 1.0, reason: '' });
      setFeedback({
        type: 'success',
        message: 'Compensatory off claim submitted successfully for review.',
      });
      const updated = await leaveApi.getMyCompOffRequests();
      setMyCompOffs(updated);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit compensatory off claim.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmittingCompOff(false);
    }
  };

  // Leave Encashment Submit
  const handleEncashmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEncashment(true);
    try {
      await leaveApi.submitEncashment({
        leaveTypeId: encashmentForm.leaveTypeId,
        daysRequested: Number(encashmentForm.daysRequested),
        reason: encashmentForm.reason.trim(),
      });
      setIsEncashmentModalOpen(false);
      setEncashmentForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        daysRequested: 1.0,
        reason: '',
      });
      setFeedback({
        type: 'success',
        message: 'Leave encashment request submitted successfully for HR Admin review.',
      });
      const updated = await leaveApi.getMyEncashmentRequests();
      setMyEncashments(updated);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit leave encashment request.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmittingEncashment(false);
    }
  };

  // Cancel own pending request confirmation state
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const handleCancelRequest = (requestId: string) => {
    setCancelTargetId(requestId);
  };

  const executeCancelRequest = async () => {
    if (!cancelTargetId) return;
    setIsCancelling(true);
    try {
      await leaveApi.cancelRequest(cancelTargetId);
      setFeedback({
        type: 'success',
        message: 'Leave request successfully cancelled and hold released from balance.',
      });
      setCancelTargetId(null);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to cancel leave request.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsCancelling(false);
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

  // Filtered Comp-Off claims
  const displayedCompOffs = useMemo(() => {
    return myCompOffs.filter((item) => {
      const matchesSearch =
        (item.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.employeeName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [myCompOffs, searchQuery, statusFilter]);

  // Filtered Encashment requests
  const displayedEncashments = useMemo(() => {
    return myEncashments.filter((item) => {
      const matchesSearch =
        (item.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.leaveTypeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.employeeName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [myEncashments, searchQuery, statusFilter]);

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
              onClick={() => loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white hover:bg-[#f0f9f8] px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-2xs transition disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#0e4a5c] ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportMyIcs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 px-3 py-2 text-xs font-semibold text-[#0e4a5c] shadow-2xs transition cursor-pointer"
              title="Download iCal feed to sync with Google Calendar or Outlook"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Export (.ics)</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCapacityModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 px-3 py-2 text-xs font-semibold text-[#0e4a5c] shadow-2xs transition cursor-pointer"
              title="View 30-day team staffing capacity and absence forecast"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Team Capacity</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCompOffModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 px-3 py-2 text-xs font-semibold text-[#0e4a5c] shadow-2xs transition cursor-pointer"
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Claim Comp-Off</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEncashmentModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 px-3 py-2 text-xs font-semibold text-[#0e4a5c] shadow-2xs transition cursor-pointer"
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Request Encashment</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setApplyForm({
                  leaveTypeId: leaveTypes[0]?.id || '',
                  startDate: '',
                  endDate: '',
                  reason: '',
                  attachmentUrl: '',
                  isHalfDay: false,
                  halfDayPeriod: 'MORNING',
                  delegateId: '',
                });
                setIsApplyModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
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
          {isLoading ? (
            <CardSkeleton count={4} />
          ) : balances.length === 0 ? (
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
                          isHalfDay: false,
                          halfDayPeriod: 'MORNING',
                          delegateId: '',
                        });
                        setIsApplyModalOpen(true);
                      }}
                      className="text-xs font-bold text-[#0e4a5c] hover:text-[#083543] hover:underline cursor-pointer"
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

        {/* Calendar Color Legend */}
        <div className="mt-3 mb-1 flex flex-wrap items-center gap-3.5 sm:gap-5 text-[11px] bg-[#f8fbfb] p-2.5 rounded-xl border border-teal-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="font-semibold text-slate-700">Public Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700">Approved Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="font-semibold text-slate-700">Pending Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bookmark className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="font-semibold text-slate-700">Bookmarked / Note</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#0e4a5c]" />
            <span className="font-semibold text-slate-700">Selected</span>
          </div>
        </div>

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

            <button
              type="button"
              onClick={() => setActiveTab('COMP_OFF')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                activeTab === 'COMP_OFF'
                  ? 'bg-[#0e4a5c] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0d2836] hover:bg-slate-100'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Comp-Off ({myCompOffs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ENCASHMENT')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                activeTab === 'ENCASHMENT'
                  ? 'bg-[#0e4a5c] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0d2836] hover:bg-slate-100'
              }`}
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Encashment ({myEncashments.length})</span>
            </button>
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

        {/* Content Table by Active Tab */}
        {activeTab === 'COMP_OFF' ? (
          <div className="overflow-x-auto">
            <div className="p-4 bg-[#f8faf9] border-b border-teal-50 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#0d2836]">Compensatory Off (Comp-Off / TOIL) Claims</h4>
                <p className="text-[11px] text-slate-500">Track and submit compensatory days earned for extra work or weekend duty.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompOffModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Claim Comp-Off</span>
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-teal-50 bg-[#f8faf9] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date Worked</th>
                  <th className="py-3 px-4">Days Earned</th>
                  <th className="py-3 px-4">Reason / Assignment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Approver</th>
                  <th className="py-3 px-4 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-6 px-4">
                      <TableSkeleton rows={3} cols={6} />
                    </td>
                  </tr>
                ) : displayedCompOffs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No compensatory off claims found for this filter.
                    </td>
                  </tr>
                ) : (
                  displayedCompOffs.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f6faf8] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#0d2836]">
                        {item.workedDate}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0e4a5c]">
                        {item.daysEarned} day{item.daysEarned !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-sm truncate" title={item.reason}>
                        {item.reason}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {item.approverName || <span className="text-slate-400 italic">Pending review</span>}
                        {item.comments && (
                          <span className="block text-[10px] text-slate-500 truncate italic">
                            &ldquo;{item.comments}&rdquo;
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'ENCASHMENT' ? (
          <div className="overflow-x-auto">
            <div className="p-4 bg-[#f8faf9] border-b border-teal-50 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#0d2836]">Leave Encashment Requests</h4>
                <p className="text-[11px] text-slate-500">Submit requests to monetize unused statutory leave balances.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEncashmentModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Request Encashment</span>
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-teal-50 bg-[#f8faf9] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Days Requested</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">HR Reviewer</th>
                  <th className="py-3 px-4 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4">
                      <TableSkeleton rows={3} cols={7} />
                    </td>
                  </tr>
                ) : displayedEncashments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No leave encashment requests found for this filter.
                    </td>
                  </tr>
                ) : (
                  displayedEncashments.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f6faf8] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#0e4a5c]">
                        {item.leaveTypeName}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0d2836]">
                        {item.daysRequested} day{item.daysRequested !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {item.year}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-sm truncate" title={item.reason}>
                        {item.reason}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {item.approvedByName || <span className="text-slate-400 italic">Pending HR review</span>}
                        {item.comments && (
                          <span className="block text-[10px] text-slate-500 truncate italic">
                            &ldquo;{item.comments}&rdquo;
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-teal-50 bg-[#f8faf9] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Working Days</th>
                  <th className="py-3 px-4">Reason &amp; Attachment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4">
                      <TableSkeleton rows={4} cols={7} />
                    </td>
                  </tr>
                ) : displayedRequests.length === 0 ? (
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

                        <td className="py-3.5 px-4 text-slate-600 max-w-xs" title={req.reason}>
                          <p className="truncate">{req.reason}</p>
                          {req.attachmentUrl && (
                            <a
                              href={req.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#0e4a5c] hover:underline font-bold mt-1"
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>View Attachment</span>
                            </a>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge status={req.status} />
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* View Details & Approval History Modal */}
                            <button
                              type="button"
                              onClick={() => setSelectedLeaveDetail(req)}
                              className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white hover:bg-teal-50 text-[#0e4a5c] px-2 py-1 text-xs font-semibold transition shadow-2xs"
                              title="View details and multi-stage approval history"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Details</span>
                            </button>

                            {/* 1-Click Calendar Download (.ics) */}
                            {req.status === 'APPROVED' && (
                              <button
                                type="button"
                                onClick={() => handleDownloadIcs(req.id, req.leaveTypeName || 'Leave')}
                                className="inline-flex items-center gap-1 rounded-lg border border-teal-200 text-[#0e4a5c] hover:bg-[#e3f4f1] px-2 py-1 text-xs font-semibold transition"
                                title="Download .ics Calendar Sync (RFC 5545)"
                              >
                                <Download className="h-3 w-3" />
                                <span>.ics</span>
                              </button>
                            )}

                            {/* If user is manager/admin and on pending approvals tab or viewing a pending request */}
                            {hasAnyRole(['LINE_MANAGER', 'HR_ADMIN']) && req.status === 'PENDING' && !isOwner && (
                              <>
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
                              </>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
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

            {/* Department Overlap / Team Coverage Alert (Step 3) */}
            {isLoadingOverlap && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-2.5 text-xs text-teal-800 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0e4a5c]" />
                <span>Checking department coverage for overlapping colleague leaves...</span>
              </div>
            )}
            {!isLoadingOverlap && departmentOverlap.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Users className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>Department Team Coverage Alert ({departmentOverlap.length} colleague{departmentOverlap.length > 1 ? 's' : ''} away)</span>
                </div>
                <p className="text-[11px] text-amber-800 mb-2">
                  The following members in your department have scheduled or pending leave during this window:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {departmentOverlap.map((item) => (
                    <div key={item.requestId} className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg border border-amber-100 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-900">{item.employeeName}</span>
                        <span className="text-slate-500 ml-1.5 font-medium">({item.leaveTypeName})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-amber-900">{item.startDate} &rarr; {item.endDate}</span>
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">{item.status}</span>
                      </div>
                    </div>
                  ))}
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

            {/* Attachment Upload (Step 1) */}
            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Attachment / Medical Certificate / Supporting Document <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleAttachmentFileChange}
                  disabled={isUploadingAttachment}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#e3f4f1] file:text-[#0e4a5c] hover:file:bg-[#cbebe5] cursor-pointer"
                />
              </div>
              {isUploadingAttachment && (
                <p className="text-[11px] text-[#0e4a5c] mt-1 font-medium flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Uploading attachment...
                </p>
              )}
              {applyForm.attachmentUrl && !isUploadingAttachment && (
                <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-semibold">
                  <Check className="h-3.5 w-3.5" /> File attached and ready for submission
                </p>
              )}
            </div>

            {/* Medical Certificate / Statutory Document details */}
            <div className="rounded-xl border border-teal-100 bg-[#fafcfb] p-3 space-y-2">
              <span className="text-xs font-bold text-[#0d2836] block">
                Official Document Verification (Optional / Statutory Leave)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Document Type
                  </label>
                  <input
                    type="text"
                    value={applyForm.documentType}
                    onChange={(e) => setApplyForm({ ...applyForm, documentType: e.target.value })}
                    placeholder="e.g., Medical Cert"
                    className="w-full rounded-xl border border-teal-200/90 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Document / Cert #
                  </label>
                  <input
                    type="text"
                    value={applyForm.documentNumber}
                    onChange={(e) => setApplyForm({ ...applyForm, documentNumber: e.target.value })}
                    placeholder="e.g., MED-2026-90"
                    className="w-full rounded-xl border border-teal-200/90 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={applyForm.medicalCertIssueDate}
                    onChange={(e) => setApplyForm({ ...applyForm, medicalCertIssueDate: e.target.value })}
                    className="w-full rounded-xl border border-teal-200/90 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none"
                  />
                </div>
              </div>
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
                className="flex items-center gap-1.5 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL: LEAVE DETAILS & MULTI-STAGE APPROVAL TIMELINE (Step 2 & Step 6)
         ========================================================================= */}
      {selectedLeaveDetail && (
        <Modal
          isOpen={Boolean(selectedLeaveDetail)}
          onClose={() => setSelectedLeaveDetail(null)}
          title="Leave Request Details & Approvals"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-teal-100">
              <div>
                <h4 className="font-bold text-sm text-[#0d2836]">
                  {selectedLeaveDetail.employeeName || 'Employee'}
                </h4>
                <p className="text-slate-500 text-[11px]">{selectedLeaveDetail.employeeEmail}</p>
              </div>
              <StatusBadge status={selectedLeaveDetail.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[#f8faf9] p-3 rounded-xl border border-teal-50">
              <div>
                <span className="text-slate-400 text-[10px] block">Leave Type</span>
                <span className="font-bold text-[#0e4a5c]">
                  {selectedLeaveDetail.leaveTypeName || selectedLeaveDetail.leaveTypeCode}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Total Working Days</span>
                <span className="font-bold text-[#0d2836]">
                  {selectedLeaveDetail.totalDays} day{selectedLeaveDetail.totalDays !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Period</span>
                <span className="font-semibold text-slate-800">
                  {selectedLeaveDetail.startDate} &rarr; {selectedLeaveDetail.endDate}
                  {selectedLeaveDetail.isHalfDay && ` (Half Day - ${selectedLeaveDetail.halfDayPeriod})`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Coverage Backup</span>
                <span className="font-semibold text-slate-800">
                  {selectedLeaveDetail.delegateName || 'None assigned'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block">Reason / Justification</span>
              <p className="mt-1 text-slate-700 bg-white p-2.5 rounded-xl border border-teal-100">
                {selectedLeaveDetail.reason}
              </p>
            </div>

            {selectedLeaveDetail.attachmentUrl && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#e3f4f1]/50 border border-teal-200">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-[#0e4a5c]" />
                  <span className="font-semibold text-[#0d2836]">Attached Supporting Document</span>
                </div>
                <a
                  href={selectedLeaveDetail.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-lg bg-[#0e4a5c] text-white font-bold hover:bg-[#083543] transition"
                >
                  Download / View
                </a>
              </div>
            )}

            {/* Multi-Stage Approval Routing & Progression Timeline (Step 2) */}
            <div className="pt-2 border-t border-teal-100">
              <div className="flex items-center gap-1.5 mb-2 font-bold text-[#0d2836]">
                <ShieldCheck className="h-4 w-4 text-[#0e4a5c]" />
                <span>Multi-Stage Approval Hierarchy &amp; Audit Trail</span>
              </div>

              {selectedLeaveDetail.approvals && selectedLeaveDetail.approvals.length > 0 ? (
                <div className="space-y-2">
                  {selectedLeaveDetail.approvals.map((appr, idx) => (
                    <div
                      key={appr.id || idx}
                      className="p-3 rounded-xl border border-teal-100 bg-[#fafcfb] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0d2836]">
                            Stage {appr.stepOrder ?? idx + 1}: {appr.approverName || 'Designated Approver'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              appr.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : appr.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {appr.status}
                          </span>
                        </div>
                        {appr.approverEmail && (
                          <p className="text-[10px] text-slate-400">{appr.approverEmail}</p>
                        )}
                        {appr.comments && (
                          <p className="text-[11px] text-slate-600 mt-1 italic">
                            &ldquo;{appr.comments}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-slate-400">
                        {appr.actionedAt
                          ? new Date(appr.actionedAt).toLocaleDateString()
                          : 'Pending Action'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 text-slate-500 italic text-[11px]">
                  Standard direct manager review routing in effect.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-teal-100">
              {selectedLeaveDetail.status === 'APPROVED' ? (
                <button
                  type="button"
                  onClick={() => handleDownloadIcs(selectedLeaveDetail.id, selectedLeaveDetail.leaveTypeName || 'Leave')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 text-[#0e4a5c] hover:bg-[#e3f4f1] font-bold transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .ics Calendar File</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedLeaveDetail(null)}
                className="px-4 py-1.5 rounded-xl border border-teal-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL: CLAIM COMPENSATORY OFF (Step 4)
         ========================================================================= */}
      {isCompOffModalOpen && (
        <Modal
          isOpen={isCompOffModalOpen}
          onClose={() => setIsCompOffModalOpen(false)}
          title="Claim Compensatory Off (Comp-Off / TOIL)"
        >
          <form onSubmit={handleCompOffSubmit} className="space-y-4">
            <div>
              <p className="text-xs text-slate-600 mb-3">
                Claim compensatory off for overtime, weekend support, or public holiday duty. Once approved by your manager, compensatory days will be credited directly to your leave balance.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Worked Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={compOffForm.workedDate}
                onChange={(e) => setCompOffForm({ ...compOffForm, workedDate: e.target.value })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Days Earned <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="5.0"
                required
                value={compOffForm.daysEarned}
                onChange={(e) => setCompOffForm({ ...compOffForm, daysEarned: parseFloat(e.target.value) || 1.0 })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Reason / Duty Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain the duties or system maintenance performed outside normal working hours..."
                value={compOffForm.reason}
                onChange={(e) => setCompOffForm({ ...compOffForm, reason: e.target.value })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-teal-50">
              <button
                type="button"
                onClick={() => setIsCompOffModalOpen(false)}
                className="rounded-xl border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCompOff}
                className="flex items-center gap-1.5 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingCompOff ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL: SUBMIT LEAVE ENCASHMENT (Step 8)
         ========================================================================= */}
      {isEncashmentModalOpen && (
        <Modal
          isOpen={isEncashmentModalOpen}
          onClose={() => setIsEncashmentModalOpen(false)}
          title="Submit Leave Encashment Request"
        >
          <form onSubmit={handleEncashmentSubmit} className="space-y-4">
            <div>
              <p className="text-xs text-slate-600 mb-3">
                Request financial reimbursement for unused annual leave days. Upon HR Admin approval, the encashed days will be deducted from your leave quota and forwarded to payroll.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Leave Type <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={encashmentForm.leaveTypeId}
                onChange={(e) => setEncashmentForm({ ...encashmentForm, leaveTypeId: e.target.value })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
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

            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Days to Encash <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={encashmentForm.daysRequested}
                onChange={(e) => setEncashmentForm({ ...encashmentForm, daysRequested: parseFloat(e.target.value) || 1.0 })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0d2836] mb-1">
                Reason / Notes for HR Payroll <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Year-end encashment of unused annual leave days as per company policy..."
                value={encashmentForm.reason}
                onChange={(e) => setEncashmentForm({ ...encashmentForm, reason: e.target.value })}
                className="w-full rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0e4a5c] focus:outline-none focus:ring-1 focus:ring-[#0e4a5c]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-teal-50">
              <button
                type="button"
                onClick={() => setIsEncashmentModalOpen(false)}
                className="rounded-xl border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEncashment}
                className="flex items-center gap-1.5 rounded-xl bg-[#0e4a5c] hover:bg-[#083543] px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingEncashment ? 'Submitting...' : 'Submit Encashment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Team Capacity & Absence Heatmap Modal */}
      {isCapacityModalOpen && (
        <Modal
          isOpen={isCapacityModalOpen}
          onClose={() => setIsCapacityModalOpen(false)}
          title="Team Capacity & Absence Heatmap (30-Day Forecast)"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Real-time daily staffing availability. Days with less than 75% staffing available are flagged as potential operational bottlenecks.
            </p>

            {isLoadingCapacity ? (
              <div className="p-6">
                <TableSkeleton rows={4} cols={4} />
              </div>
            ) : teamCapacity.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No capacity records found for your department.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {teamCapacity.map((day) => (
                  <div
                    key={day.date}
                    className={`p-3 rounded-xl border text-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      day.isBottleneck
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : day.capacityPercentage < 100
                        ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                        : 'bg-white border-teal-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-black/5">
                        {day.date} ({day.dayOfWeek})
                      </span>
                      {day.isBottleneck && (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-200 text-rose-800">
                          Bottleneck Alert
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {day.absentEmployeesCount > 0 ? (
                        <div className="text-[11px] text-slate-600">
                          Absent: <strong className="font-semibold text-slate-800">{day.absentEmployeeNames.join(', ')}</strong>
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-semibold">Full Staffing (100%)</span>
                      )}

                      <div className="text-right">
                        <span className={`font-extrabold text-xs ${day.isBottleneck ? 'text-rose-700' : 'text-[#0e4a5c]'}`}>
                          {day.capacityPercentage}%
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          ({day.availableCapacityCount}/{day.totalActiveEmployees} present)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-teal-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCapacityModalOpen(false)}
                className="px-4 py-2 border border-teal-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Leave Request Cancellation */}
      <ConfirmModal
        isOpen={Boolean(cancelTargetId)}
        onClose={() => setCancelTargetId(null)}
        onConfirm={executeCancelRequest}
        title="Cancel Leave Application"
        message="Are you sure you want to cancel this pending leave request? Any reserved days will be immediately released back to your available balance."
        confirmLabel="Yes, Cancel Request"
        cancelLabel="Keep Request"
        variant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
};
