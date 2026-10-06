import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../api/leaveApi';
import { helpdeskApi } from '../api/helpdeskApi';
import { adminApi } from '../api/adminApi';
import { LeaveBalance, LeaveRequest, Ticket, UserProfile } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Calendar, 
  HelpCircle, 
  Clock, 
  CheckCircle, 
  ArrowRight, 
  Briefcase, 
  UserCheck, 
  Building,
  AlertCircle,
  Users,
  UserPlus,
  ShieldCheck,
  Search
} from 'lucide-react';

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
        if (leaveRes.status === 'fulfilled') setRecentLeaves(leaveRes.value.slice(0, 4));
        if (ticketRes.status === 'fulfilled') setRecentTickets(ticketRes.value.slice(0, 4));

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
          if (allUsersRes.status === 'fulfilled') setAllUsers(allUsersRes.value);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl text-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-blue-200 font-semibold">
              Corporate Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              Welcome back, {user?.firstName || 'Employee'}!
            </h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Track your paid time off balances, submit leave applications, and get IT/HR help desk support.
            </p>
          </div>

          {/* User Profile Pill Info */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-xs space-y-1.5 min-w-[220px]">
            <div className="flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-blue-200" />
              <span>{user?.department?.name || 'Department: General'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-blue-200" />
              <span>{user?.jobTitle || 'Staff Member'}</span>
            </div>
            {user?.manager && (
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-blue-200" />
                <span>Manager: {user.manager.fullName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Available PTO</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {loading ? '...' : totalAvailableDays}
            </span>
            <span className="text-xs text-gray-500 ml-1">full days remaining</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2 flex justify-between">
            <span>Accrued year-to-date</span>
            <Link to="/leave" className="text-blue-600 hover:underline">
              View Balances &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Active Leave Requests</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {loading
                ? '...'
                : recentLeaves.filter(
                    (r) => r.status === 'PENDING' || r.status === 'SUBMITTED'
                  ).length}
            </span>
            <span className="text-xs text-gray-500 ml-1">awaiting review</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2 flex justify-between">
            <span>Submitted requests</span>
            <Link to="/leave" className="text-blue-600 hover:underline">
              History &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Open Support Tickets</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {loading ? '...' : openTicketsCount}
            </span>
            <span className="text-xs text-gray-500 ml-1">in progress</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2 flex justify-between">
            <span>Help Desk Incidents</span>
            <Link to="/helpdesk" className="text-blue-600 hover:underline">
              My Tickets &rarr;
            </Link>
          </div>
        </div>

        {(hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) ? (
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Manager Approvals</span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-gray-900">
                {loading ? '...' : pendingApprovalsCount}
              </span>
              <span className="text-xs text-gray-500 ml-1">direct reports</span>
            </div>
            <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2 flex justify-between">
              <span>Awaiting decision</span>
              <Link to="/approvals" className="text-purple-600 hover:underline">
                Review &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Service Status</span>
              <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-lg font-bold text-emerald-600">Operational</span>
            </div>
            <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2 flex justify-between">
              <span>All engines healthy</span>
              <span className="text-gray-400">v1.0.0</span>
            </div>
          </div>
        )}

        {hasRole('HR_ADMIN') && (
          <div className={`bg-white rounded-xl p-5 border shadow-2xs ${pendingRegistrations.length > 0 ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Pending Registrations</span>
              <div className={`p-2 rounded-lg ${pendingRegistrations.length > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
                <UserPlus className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-2xl font-bold ${pendingRegistrations.length > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {loading ? '...' : pendingRegistrations.length}
              </span>
              <span className="text-xs text-gray-500 ml-1">awaiting HR</span>
            </div>
            <div className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2 flex justify-between">
              <span>{allEmployees.length} total staff</span>
              <Link to="/admin" className="text-blue-600 font-semibold hover:underline">
                Approve &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <Link
          to="/leave"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm shadow-xs transition"
        >
          <Calendar className="w-4 h-4" />
          Apply for Leave
        </Link>
        <Link
          to="/helpdesk"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm shadow-xs transition"
        >
          <HelpCircle className="w-4 h-4" />
          Create Support Ticket
        </Link>
        {(hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) && (
          <Link
            to="/approvals"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-medium text-sm transition"
          >
            <CheckCircle className="w-4 h-4" />
            Review Team Approvals ({pendingApprovalsCount})
          </Link>
        )}
        {hasRole('HR_ADMIN') && (
          <Link
            to="/admin"
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition border ${
              pendingRegistrations.length > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm animate-pulse'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            HR Admin Hub {pendingRegistrations.length > 0 && `(${pendingRegistrations.length} Pending Approvals)`}
          </Link>
        )}
      </div>

      {/* HR Pending Employee Registrations Alert Banner */}
      {hasRole('HR_ADMIN') && pendingRegistrations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                <UserPlus className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">
                    {pendingRegistrations.length} New Employee Registration{pendingRegistrations.length > 1 ? 's' : ''} Awaiting Review
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-200 text-amber-900 rounded-full">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  New employees have registered. Before they can log in and access the portal, verify their identity, assign their reporting manager, and initialize leave balances.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pendingRegistrations.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-medium shadow-2xs">
                      <strong>{p.fullName || `${p.firstName} ${p.lastName}`}</strong> ({p.email}) &bull; <span className="font-mono text-gray-600">{p.employeeCode}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition whitespace-nowrap self-start md:self-center"
            >
              Go to HR Admin to Approve
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Split Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Leave Requests */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Recent Leave Requests</h2>
            <Link to="/leave" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentLeaves.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No leave requests filed yet.
              </div>
            ) : (
              recentLeaves.map((req) => (
                <div key={req.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">
                        {req.leaveTypeName || 'Leave'}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {req.startDate} to {req.endDate} &bull; {Math.floor(Number(req.totalDays))} day{Math.floor(Number(req.totalDays)) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Support Tickets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Recent Support Tickets</h2>
            <Link to="/helpdesk" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentTickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No tickets opened yet.
              </div>
            ) : (
              recentTickets.map((t) => (
                <div key={t.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {t.ticketNumber}
                      </span>
                      <span className="font-medium text-sm text-gray-900 truncate max-w-[200px]">
                        {t.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <StatusBadge status={t.status} />
                      <StatusBadge priority={t.priority} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/40 to-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-100/80 text-blue-700">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Organization Employee Directory</h2>
                <p className="text-xs text-gray-500">
                  Total {allEmployees.length} staff members registered across company divisions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, code, department..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600 w-56 sm:w-64 bg-white"
                />
              </div>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Manage in Admin Hub
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50/75 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3 text-left">Employee</th>
                  <th className="px-6 py-3 text-left">Code</th>
                  <th className="px-6 py-3 text-left">Department</th>
                  <th className="px-6 py-3 text-left">Job Title &amp; Role</th>
                  <th className="px-6 py-3 text-left">Line Manager</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">
                      No employees found matching "{employeeSearch}".
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">
                          {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                        </div>
                        <div className="text-gray-500 text-[11px]">{emp.email}</div>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap font-mono text-gray-700">
                        {emp.employeeCode}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-gray-700">
                        {emp.department?.name || <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="text-gray-900 font-medium">{emp.jobTitle || 'Staff Member'}</div>
                        <div className="text-gray-400 text-[10px]">{emp.roles.join(', ')}</div>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-gray-700">
                        {emp.manager ? (
                          <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                            {emp.manager.fullName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            No Manager Assigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : emp.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
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
