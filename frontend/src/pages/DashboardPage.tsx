import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../api/leaveApi';
import { helpdeskApi } from '../api/helpdeskApi';
import { adminApi } from '../api/adminApi';
import { LeaveBalance, LeaveRequest, Ticket, UserProfile } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Calendar, 
  Users, 
  LifeBuoy, 
  ShieldCheck, 
  LayoutGrid, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [allEmployees, setAllEmployees] = useState<UserProfile[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<UserProfile[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [balRes, leaveRes, ticketRes] = await Promise.allSettled([
          leaveApi.getMyBalances(),
          leaveApi.getMyRequests(),
          helpdeskApi.getMyTickets(),
        ]);

        if (balRes.status === 'fulfilled') setBalances(balRes.value);
        if (leaveRes.status === 'fulfilled') setRecentLeaves(leaveRes.value.slice(0, 5));
        if (ticketRes.status === 'fulfilled') setRecentTickets(ticketRes.value.slice(0, 5));

        if (hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) {
          try {
            const approvals = await leaveApi.getPendingApprovals();
            setPendingApprovalsCount(approvals.length);
          } catch {
            // Ignore approval fetch error
          }
        }

        if (hasRole('HR_ADMIN')) {
          const [allUsersRes, pendingUsersRes] = await Promise.allSettled([
            adminApi.getAllUsers(),
            adminApi.getPendingApprovals(),
          ]);
          if (allUsersRes.status === 'fulfilled') setAllEmployees(allUsersRes.value);
          if (pendingUsersRes.status === 'fulfilled') setPendingRegistrations(pendingUsersRes.value);
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [hasRole]);

  const totalAvailableDays = balances.reduce(
    (acc, b) => acc + Math.floor(Number(b.availableDays) || 0),
    0
  );

  const activeLeavesCount = recentLeaves.filter(
    (r) => r.status === 'PENDING' || r.status === 'SUBMITTED'
  ).length;

  const openTicketsCount = recentTickets.filter(
    (t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'
  ).length;

  const latestLeave = recentLeaves.length > 0 ? recentLeaves[0] : null;
  const latestTicket = recentTickets.length > 0 ? recentTickets[0] : null;

  const filteredEmployees = allEmployees.filter((emp) => {
    const q = employeeSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (emp.fullName && emp.fullName.toLowerCase().includes(q)) ||
      (emp.firstName && emp.firstName.toLowerCase().includes(q)) ||
      (emp.lastName && emp.lastName.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.employeeCode && emp.employeeCode.toLowerCase().includes(q)) ||
      (emp.department?.name && emp.department.name.toLowerCase().includes(q)) ||
      (emp.jobTitle && emp.jobTitle.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16 selection:bg-teal-200 selection:text-teal-900">
      
      {/* Hero Section (Design Mockup) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e3f4f1] text-[#0e4a5c] text-xs font-bold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0e4a5c]" />
            One Employee Workspace
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0d2836] leading-[1.18] tracking-tight">
            Manage leave and get workplace support in one place.
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
            Welcome back, <strong className="text-[#0d2836]">{user?.firstName} {user?.lastName}</strong>. WorkHub makes time-off planning, team visibility, and help desk support feel simple, clear, and connected.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/leave"
              className="px-5 py-2.5 bg-[#0e4a5c] hover:bg-[#083543] text-white text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4" /> Request leave
            </Link>
            <Link
              to="/helpdesk"
              className="px-5 py-2.5 bg-white border border-teal-200 text-[#0e4a5c] hover:bg-[#f0f9f8] text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
            >
              <LifeBuoy className="w-4 h-4" /> Get help
            </Link>
          </div>
        </div>

        {/* Live Workspace Card: "Today at a glance" (Powered by Live Data) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-teal-50">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
                  Your Workspace
                </span>
                <h3 className="font-serif text-lg font-bold text-[#0d2836]">
                  Today at a glance
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#eef7f6] text-[#0e4a5c] flex items-center justify-center">
                <LayoutGrid className="w-4 h-4" />
              </div>
            </div>

            {/* Sub-cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Leave Balance Subcard */}
              <Link 
                to="/leave"
                className="bg-[#eef7f6] p-4 rounded-xl border border-teal-100/60 hover:border-teal-300 transition group block"
              >
                <span className="text-[11px] text-slate-500 font-medium block">
                  Leave balance
                </span>
                <div className="text-2xl font-bold text-[#0e4a5c] mt-1">
                  {loading ? '—' : `${totalAvailableDays} days`}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block group-hover:text-[#0e4a5c] transition">
                  Available this year &rarr;
                </span>
              </Link>

              {/* Next Leave Request Subcard */}
              <Link 
                to="/leave"
                className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex flex-col justify-between hover:border-teal-300 transition group block"
              >
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Next leave request
                  </span>
                  {latestLeave ? (
                    <div className="mt-1.5 space-y-1">
                      <StatusBadge status={latestLeave.status} />
                      <div className="text-[11px] font-medium text-slate-700 truncate">
                        {latestLeave.leaveTypeName || 'Leave Request'}
                      </div>
                    </div>
                  ) : (
                    <span className="inline-block mt-2 text-[10px] text-slate-500">
                      No active requests
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-[#0e4a5c] mt-2 block group-hover:underline">
                  View in portal &rarr;
                </span>
              </Link>
            </div>

            {/* Help Ticket Preview Row */}
            <Link 
              to="/helpdesk"
              className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex items-center justify-between gap-3 hover:border-teal-300 transition group block"
            >
              <div className="space-y-1 flex-1 min-w-0">
                {latestTicket ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Help ticket · #{latestTicket.ticketNumber || latestTicket.id}
                      </span>
                      <StatusBadge status={latestTicket.status} />
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">
                      {latestTicket.title}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Internal Help Desk
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-semibold">
                        All clear
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      No open incidents. Report hardware, HR, or IT issues.
                    </p>
                  </>
                )}
              </div>

              <span className="text-[10px] font-semibold text-[#0e4a5c] group-hover:underline whitespace-nowrap ml-2">
                Open &rarr;
              </span>
            </Link>

            {/* Quick Profile Row */}
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-teal-50">
              <span>Department: <strong className="text-slate-800">{user?.department?.name || 'General'}</strong></span>
              <span>Code: <strong className="font-mono text-slate-800">{user?.employeeCode}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Metric Overview Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-teal-100 rounded-xl p-5 shadow-xs hover:border-teal-200 transition">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Available PTO
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[#0d2836] tracking-tight">
              {loading ? '—' : totalAvailableDays}
            </span>
            <span className="text-xs font-medium text-slate-500">working days</span>
          </div>
          <div className="mt-3 pt-3 border-t border-teal-50 flex justify-between text-xs">
            <span className="text-slate-500">Annual balance</span>
            <Link to="/leave" className="text-[#0e4a5c] hover:underline font-semibold">
              View quota details &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white border border-teal-100 rounded-xl p-5 shadow-xs hover:border-teal-200 transition">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Leave Applications
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[#0d2836] tracking-tight">
              {loading ? '—' : activeLeavesCount}
            </span>
            <span className="text-xs font-medium text-slate-500">pending decision</span>
          </div>
          <div className="mt-3 pt-3 border-t border-teal-50 flex justify-between text-xs">
            <span className="text-slate-500">Submitted requests</span>
            <Link to="/leave" className="text-[#0e4a5c] hover:underline font-semibold">
              History &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white border border-teal-100 rounded-xl p-5 shadow-xs hover:border-teal-200 transition">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Open Help Tickets
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[#0d2836] tracking-tight">
              {loading ? '—' : openTicketsCount}
            </span>
            <span className="text-xs font-medium text-slate-500">in resolution</span>
          </div>
          <div className="mt-3 pt-3 border-t border-teal-50 flex justify-between text-xs">
            <span className="text-slate-500">Support tickets</span>
            <Link to="/helpdesk" className="text-[#0e4a5c] hover:underline font-semibold">
              Manage tickets &rarr;
            </Link>
          </div>
        </div>

        {(hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) ? (
          <div className="bg-white border border-teal-100 rounded-xl p-5 shadow-xs hover:border-teal-200 transition">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Team Approvals
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-[#0d2836] tracking-tight">
                {loading ? '—' : pendingApprovalsCount}
              </span>
              <span className="text-xs font-medium text-slate-500">direct reports</span>
            </div>
            <div className="mt-3 pt-3 border-t border-teal-50 flex justify-between text-xs">
              <span className="text-slate-500">Manager review</span>
              <Link to="/approvals" className="text-[#0e4a5c] hover:underline font-semibold">
                Review queue &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-teal-100 rounded-xl p-5 shadow-xs hover:border-teal-200 transition">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Organization Policy
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-[#0d2836] tracking-tight">
                Statutory Standard
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-teal-50 flex justify-between text-xs text-slate-500">
              <span>Employment Act compliance</span>
              <Link to="/leave" className="text-[#0e4a5c] hover:underline font-semibold">
                Policy terms &rarr;
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Everything in Context (Core System Modules from Mockup) */}
      <section className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
            Everything in Context
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
            Less admin chasing. More confident workdays.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Module 1: Leave Requests */}
          <Link 
            to="/leave"
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              Leave requests, made clear
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              See your balance, choose dates, and understand exactly where each request stands.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              Open leave portal &rarr;
            </span>
          </Link>

          {/* Module 2: Approvals */}
          <Link 
            to="/approvals"
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              Approvals and team calendars
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Give managers the context to approve quickly while teams plan around availability.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              Open approvals &rarr;
            </span>
          </Link>

          {/* Module 3: Help Tickets */}
          <Link 
            to="/helpdesk"
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              Submit and track help tickets
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Send a request to the right support team and follow progress without extra follow-ups.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              Open service desk &rarr;
            </span>
          </Link>

          {/* Module 4: Agent Queue & Administration */}
          <Link 
            to={hasRole('HR_ADMIN') ? '/admin' : '/agent-queue'}
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              {hasRole('HR_ADMIN') ? 'Organization administration' : 'Support queue & SLAs'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Find reliable answers, policy guidance, and timely workplace updates in one home.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              {hasRole('HR_ADMIN') ? 'Open admin console &rarr;' : 'Open agent queue &rarr;'}
            </span>
          </Link>
        </div>
      </section>

      {/* Section 3: How it Works (from Mockup) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-2">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
            How it Works
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
            A calmer route from request to resolution.
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-sm pt-1">
            WorkHub removes ambiguity from the everyday moments that keep teams moving.
          </p>
        </div>

        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
            <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
              1
            </div>
            <h4 className="font-bold text-sm text-[#0d2836]">
              Choose what you need
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Request time away or describe an issue in a few focused details.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
            <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
              2
            </div>
            <h4 className="font-bold text-sm text-[#0d2836]">
              Stay in the loop
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Get clear status updates, ownership, and helpful next steps.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
            <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
              3
            </div>
            <h4 className="font-bold text-sm text-[#0d2836]">
              Move forward
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Make plans with confidence and get back to meaningful work.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Built for People at Work (from Mockup) */}
      <section className="bg-[#e4f3f0] rounded-2xl border border-teal-200/80 p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-bold tracking-wider uppercase text-teal-800 block">
            Built for People at Work
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
            One shared source of clarity for employees and support teams.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-[#0d2836]">
                For employees
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Spend less time wondering who to ask, what is pending, or where the latest guidance lives.
              </p>
            </div>
            <Link
              to="/leave"
              className="text-xs font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1"
            >
              Access leave &amp; ticket tools &rarr;
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-[#0d2836]">
                For HR and support teams
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Create consistent service experiences with visibility, accountability, and fewer manual handoffs.
              </p>
            </div>
            <Link
              to="/approvals"
              className="text-xs font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1"
            >
              Access manager queue &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Section 5: Live Activity Lists (Recent Leaves & Tickets) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0d2836]">
            Your Recent Activity
          </h2>
          <span className="text-xs text-slate-500">
            Real-time synchronization
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leave Requests */}
          <div className="bg-white rounded-xl border border-teal-100 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-teal-50 flex items-center justify-between bg-teal-50/40">
              <h3 className="text-xs font-bold text-[#0d2836] uppercase tracking-wider">Recent Leave Applications</h3>
              <Link to="/leave" className="text-xs text-[#0e4a5c] hover:underline font-semibold transition">
                View all &rarr;
              </Link>
            </div>
            <div className="divide-y divide-teal-50">
              {recentLeaves.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No leave requests filed yet. Ready to submit?
                </div>
              ) : (
                recentLeaves.map((req) => (
                  <div key={req.id} className="p-4 sm:px-5 flex items-center justify-between hover:bg-teal-50/20 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#0d2836]">
                          {req.leaveTypeName || 'Leave Request'}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-xs text-slate-600">
                        {req.startDate} to {req.endDate} &bull; {Math.floor(Number(req.totalDays))} day{Math.floor(Number(req.totalDays)) > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Support Tickets */}
          <div className="bg-white rounded-xl border border-teal-100 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-teal-50 flex items-center justify-between bg-teal-50/40">
              <h3 className="text-xs font-bold text-[#0d2836] uppercase tracking-wider">Recent Support Tickets</h3>
              <Link to="/helpdesk" className="text-xs text-[#0e4a5c] hover:underline font-semibold transition">
                View all &rarr;
              </Link>
            </div>
            <div className="divide-y divide-teal-50">
              {recentTickets.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No support tickets opened yet.
                </div>
              ) : (
                recentTickets.map((t) => (
                  <div key={t.id} className="p-4 sm:px-5 flex items-center justify-between hover:bg-teal-50/20 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-[#0e4a5c] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          #{t.ticketNumber}
                        </span>
                        <span className="font-semibold text-xs text-[#0d2836] truncate max-w-[200px]">
                          {t.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <StatusBadge status={t.status} />
                        <StatusBadge priority={t.priority} />
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Admin Quick Employee Directory (if HR_ADMIN) */}
      {hasRole('HR_ADMIN') && (
        <section className="bg-white rounded-xl border border-teal-100 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-teal-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/40">
            <div>
              <h3 className="text-xs font-bold text-[#0d2836] uppercase tracking-wider">Organization Employee Directory</h3>
              <p className="text-xs text-slate-600">
                {allEmployees.length} staff registered across organization departments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Filter by name, code, department..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="px-3 py-1.5 border border-teal-200 rounded-lg text-xs focus:ring-1 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] w-56 sm:w-64 bg-white text-slate-900 placeholder:text-slate-400"
              />
              <Link
                to="/admin"
                className="px-3.5 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-lg text-xs font-semibold transition whitespace-nowrap shadow-xs"
              >
                Manage Staff
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-teal-50 text-xs">
              <thead className="bg-teal-50/30 text-slate-600 font-semibold uppercase tracking-wider text-[10px] border-b border-teal-50">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Employee ID</th>
                  <th className="px-5 py-3 text-left">Department</th>
                  <th className="px-5 py-3 text-left">Title &amp; Role</th>
                  <th className="px-5 py-3 text-left">Line Manager</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50 bg-white">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No employees match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.slice(0, 10).map((emp) => (
                    <tr key={emp.id} className="hover:bg-teal-50/20 transition">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-semibold text-[#0d2836]">
                          {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                        </div>
                        <div className="text-slate-500 text-[11px]">{emp.email}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap font-mono text-slate-800 font-medium">
                        {emp.employeeCode}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-700">
                        {emp.department?.name || <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-slate-900 font-medium">{emp.jobTitle || 'Staff Member'}</div>
                        <div className="text-slate-500 text-[10px]">{emp.roles.join(', ')}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-700">
                        {emp.manager?.fullName || <span className="text-slate-400">None assigned</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : emp.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 6: Dark Petrol Final CTA Banner (from Mockup) */}
      <section className="bg-[#0f2e3d] rounded-2xl p-8 sm:p-12 text-center text-white space-y-4 shadow-sm">
        <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-xl mx-auto leading-snug">
          Work feels better when the next step is obvious.
        </h2>
        <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Request time away, plan around team calendars, or get help from workplace support.
        </p>
        <div className="pt-2">
          <Link
            to="/leave"
            className="inline-flex items-center justify-center px-6 py-2.5 bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0a2734] font-bold text-sm rounded-xl shadow-xs transition"
          >
            Request leave now
          </Link>
        </div>
      </section>
    </div>
  );
};
