import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../api/leaveApi';
import { helpdeskApi } from '../api/helpdeskApi';
import { adminApi } from '../api/adminApi';
import { LeaveBalance, LeaveRequest, Ticket, UserProfile } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const DashboardPage: React.FC = () => {
  const { user, hasRole } = useAuth();

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

  const openTicketsCount = recentTickets.filter(
    (t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'
  ).length;

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Employee Welcome & Profile Header */}
      <div className="bg-white border border-blue-100 rounded-xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Employee Self-Service
            </span>
            <h1 className="text-2xl font-bold text-black mt-1">
              Welcome back, {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-slate-600 text-sm mt-1 max-w-xl">
              Track accrued leave days, submit absence requests, and submit help desk incident tickets.
            </p>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 text-xs text-slate-700 min-w-[240px] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Department:</span>
              <span className="font-semibold text-black">{user?.department?.name || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Designation:</span>
              <span className="font-semibold text-black">{user?.jobTitle || 'Staff Member'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Line Manager:</span>
              <span className="font-semibold text-black">{user?.manager?.fullName || 'Not Assigned'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available PTO */}
        <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-xs hover:border-blue-200 transition">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Available Leave Balance
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-black tracking-tight">
              {loading ? '—' : totalAvailableDays}
            </span>
            <span className="text-xs font-medium text-slate-500">working days</span>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-50 flex justify-between text-xs">
            <span className="text-slate-500">Current annual cycle</span>
            <Link to="/leave" className="text-blue-700 hover:text-black font-semibold">
              View details
            </Link>
          </div>
        </div>

        {/* Active Leave Requests */}
        <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-xs hover:border-blue-200 transition">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Leave Applications
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-black tracking-tight">
              {loading
                ? '—'
                : recentLeaves.filter(
                    (r) => r.status === 'PENDING' || r.status === 'SUBMITTED'
                  ).length}
            </span>
            <span className="text-xs font-medium text-slate-500">pending review</span>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-50 flex justify-between text-xs">
            <span className="text-slate-500">Submitted requests</span>
            <Link to="/leave" className="text-blue-700 hover:text-black font-semibold">
              Application history
            </Link>
          </div>
        </div>

        {/* Open Support Tickets */}
        <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-xs hover:border-blue-200 transition">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Open Help Desk Tickets
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-black tracking-tight">
              {loading ? '—' : openTicketsCount}
            </span>
            <span className="text-xs font-medium text-slate-500">in progress</span>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-50 flex justify-between text-xs">
            <span className="text-slate-500">Active incidents</span>
            <Link to="/helpdesk" className="text-blue-700 hover:text-black font-semibold">
              Ticket list
            </Link>
          </div>
        </div>

        {/* 4th Stat Card: Approvals or Enterprise Status */}
        {(hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) ? (
          <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-xs hover:border-blue-200 transition">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Team Approvals
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-black tracking-tight">
                {loading ? '—' : pendingApprovalsCount}
              </span>
              <span className="text-xs font-medium text-slate-500">awaiting decision</span>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-50 flex justify-between text-xs">
              <span className="text-slate-500">Direct reports</span>
              <Link to="/approvals" className="text-blue-700 hover:text-black font-semibold">
                Review queue
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-xs hover:border-blue-200 transition">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Organization Policy
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-black tracking-tight">
                Statutory Standard
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-50 flex justify-between text-xs text-slate-500">
              <span>Employment Act 2007</span>
              <Link to="/leave" className="text-blue-700 hover:text-black font-semibold">
                Policy terms
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Navigation Bar */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/leave"
          className="px-4 py-2 bg-slate-950 hover:bg-black text-white rounded-md text-sm font-semibold shadow-xs transition"
        >
          Apply for Leave
        </Link>
        <Link
          to="/helpdesk"
          className="px-4 py-2 bg-white hover:bg-blue-50 text-slate-900 border border-blue-200 rounded-md text-sm font-medium transition"
        >
          Create Support Ticket
        </Link>
        {(hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) && (
          <Link
            to="/approvals"
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 rounded-md text-sm font-medium transition"
          >
            Review Team Approvals ({pendingApprovalsCount})
          </Link>
        )}
        {hasRole('HR_ADMIN') && (
          <Link
            to="/admin"
            className="px-4 py-2 bg-white hover:bg-blue-50 text-slate-900 border border-blue-200 rounded-md text-sm font-medium transition"
          >
            Administration Portal
          </Link>
        )}
      </div>

      {/* HR Pending Employee Registrations Notification Banner */}
      {hasRole('HR_ADMIN') && pendingRegistrations.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-200 text-amber-900 rounded">
                  Action Required
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  {pendingRegistrations.length} Employee Registration{pendingRegistrations.length > 1 ? 's' : ''} Awaiting Review
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                New accounts require administrator verification and reporting manager hierarchy assignment before system access is granted.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {pendingRegistrations.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center px-2.5 py-1 bg-white border border-amber-200 text-slate-800 rounded text-xs"
                  >
                    <strong className="mr-1">{p.fullName || `${p.firstName} ${p.lastName}`}</strong> ({p.email}) &bull; <span className="font-mono text-slate-500 ml-1">{p.employeeCode}</span>
                  </span>
                ))}
              </div>
            </div>
            <Link
              to="/admin"
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-md text-xs font-semibold transition whitespace-nowrap self-start md:self-center"
            >
              Verify in Admin Hub
            </Link>
          </div>
        </div>
      )}

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leave Requests */}
        <div className="bg-white rounded-xl border border-blue-100 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/40">
            <h2 className="text-sm font-bold text-slate-950">Recent Leave Requests</h2>
            <Link to="/leave" className="text-xs text-blue-700 hover:text-black font-semibold transition">
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-blue-50">
            {recentLeaves.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No leave requests filed yet.
              </div>
            ) : (
              recentLeaves.map((req) => (
                <div key={req.id} className="p-4 sm:px-5 flex items-center justify-between hover:bg-blue-50/30 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-950">
                        {req.leaveTypeName || 'Leave'}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {req.startDate} to {req.endDate} &bull; {Math.floor(Number(req.totalDays))} day{Math.floor(Number(req.totalDays)) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Support Tickets */}
        <div className="bg-white rounded-xl border border-blue-100 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/40">
            <h2 className="text-sm font-bold text-slate-950">Recent Support Tickets</h2>
            <Link to="/helpdesk" className="text-xs text-blue-700 hover:text-black font-semibold transition">
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-blue-50">
            {recentTickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No tickets opened yet.
              </div>
            ) : (
              recentTickets.map((t) => (
                <div key={t.id} className="p-4 sm:px-5 flex items-center justify-between hover:bg-blue-50/30 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/80">
                        {t.ticketNumber}
                      </span>
                      <span className="font-semibold text-sm text-slate-950 truncate max-w-[200px]">
                        {t.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <StatusBadge status={t.status} />
                      <StatusBadge priority={t.priority} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Organization Employee Directory (Visible to HR_ADMIN) */}
      {hasRole('HR_ADMIN') && (
        <div className="bg-white rounded-xl border border-blue-100 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-blue-100 flex flex-col sm:row sm:items-center justify-between gap-3 bg-blue-50/40">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Employee Directory</h2>
              <p className="text-xs text-slate-600">
                {allEmployees.length} total staff registered across organization departments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Filter by name, code, department..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="px-3 py-1.5 border border-blue-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-950 focus:border-slate-950 w-56 sm:w-64 bg-white text-slate-950 placeholder:text-slate-400"
              />
              <Link
                to="/admin"
                className="px-3.5 py-1.5 bg-slate-950 hover:bg-black text-white rounded-lg text-xs font-semibold transition whitespace-nowrap shadow-xs"
              >
                Manage Staff
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-100 text-xs">
              <thead className="bg-blue-50/50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-blue-100">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Employee ID</th>
                  <th className="px-5 py-3 text-left">Department</th>
                  <th className="px-5 py-3 text-left">Title &amp; Role</th>
                  <th className="px-5 py-3 text-left">Line Manager</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 bg-white">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No employees match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-950">
                          {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                        </div>
                        <div className="text-slate-500 text-[11px]">{emp.email}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-800 font-medium">
                        {emp.employeeCode}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                        {emp.department?.name || <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-slate-950 font-medium">{emp.jobTitle || 'Staff Member'}</div>
                        <div className="text-slate-500 text-[10px]">{emp.roles.join(', ')}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                        {emp.manager ? (
                          <span className="font-semibold text-slate-900">
                            {emp.manager.fullName}
                          </span>
                        ) : (
                          <span className="text-slate-400">None assigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
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
        </div>
      )}
    </div>
  );
};
