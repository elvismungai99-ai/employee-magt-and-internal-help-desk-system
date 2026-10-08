import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Inbox,
  ShieldCheck,
  Headphones,
  Users,
  User,
  Building2,
  LifeBuoy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../api/leaveApi';
import { helpdeskApi } from '../api/helpdeskApi';

interface TeamHubSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const TeamHubSidebar: React.FC<TeamHubSidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const location = useLocation();
  const { user, roles, hasRole, hasAnyRole } = useAuth();

  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (hasAnyRole(['LINE_MANAGER', 'HR_ADMIN'])) {
      leaveApi.getPendingApprovals()
        .then((res) => {
          if (isMounted) setPendingApprovalsCount(res?.length || 0);
        })
        .catch(() => {});
    }
    if (hasAnyRole(['SUPPORT_AGENT', 'HR_ADMIN'])) {
      helpdeskApi.getQueueTickets()
        .then((res) => {
          if (isMounted) {
            const openCount = res?.filter((t) => t.status === 'NEW' || t.status === 'OPEN' || t.status === 'IN_PROGRESS')?.length || 0;
            setQueueCount(openCount);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [roles, location.pathname]);

  const isLeaveActive = location.pathname.startsWith('/leave');
  const isDashboardActive = location.pathname === '/' || location.pathname === '/dashboard';
  const isInboxActive = location.pathname.startsWith('/helpdesk');
  const isApprovalsActive = location.pathname.startsWith('/approvals');
  const isAgentQueueActive = location.pathname.startsWith('/agent-queue');
  const isAdminActive = location.pathname.startsWith('/admin');

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-teal-100 px-4 py-5 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Authentic System Brand Header */}
        <div className="flex items-center gap-3 px-2 mb-7">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0e4a5c] text-white font-bold text-base shadow-sm">
            EM
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight text-[#0d2836] truncate leading-tight">
              Employee Mgmt
            </span>
            <span className="text-[11px] text-[#155b6e] font-medium tracking-normal mt-0.5 truncate">
              Internal Help Desk
            </span>
          </div>
        </div>

        {/* Functional Navigation Links (Only buttons with real destinations) */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {/* 1. Dashboard Overview */}
          <NavLink
            to="/"
            onClick={onCloseMobile}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isDashboardActive
                ? 'bg-[#0e4a5c] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-[#0d2836] hover:bg-[#f0f9f8]'
            }`}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>Dashboard</span>
          </NavLink>

          {/* 2. Leave Management */}
          <NavLink
            to="/leave"
            onClick={onCloseMobile}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isLeaveActive
                ? 'bg-[#0e4a5c] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-[#0d2836] hover:bg-[#f0f9f8]'
            }`}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>Leave Management</span>
          </NavLink>

          {/* 3. Help Desk (Inbox) */}
          <NavLink
            to="/helpdesk"
            onClick={onCloseMobile}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isInboxActive
                ? 'bg-[#0e4a5c] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-[#0d2836] hover:bg-[#f0f9f8]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Inbox className="h-4 w-4 shrink-0" />
              <span>Help Desk</span>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                isInboxActive
                  ? 'bg-white/20 text-white'
                  : 'bg-[#e3f4f1] text-[#0e4a5c]'
              }`}
            >
              Tickets
            </span>
          </NavLink>

          {/* 4. Manager Approvals (Visible to LINE_MANAGER and HR_ADMIN) */}
          {hasAnyRole(['LINE_MANAGER', 'HR_ADMIN']) && (
            <div className="pt-2">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Management
              </div>
              <NavLink
                to="/approvals"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isApprovalsActive
                    ? 'bg-[#0e4a5c] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-[#0d2836] hover:bg-[#f0f9f8]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-teal-600" />
                  <span>Approvals</span>
                </div>
                {pendingApprovalsCount !== null && pendingApprovalsCount > 0 ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isApprovalsActive ? 'bg-white text-[#0e4a5c]' : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {pendingApprovalsCount}
                  </span>
                ) : (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    isApprovalsActive ? 'text-teal-100' : 'text-slate-400'
                  }`}>
                    0
                  </span>
                )}
              </NavLink>
            </div>
          )}

          {/* 5. Support Queue (Visible to SUPPORT_AGENT and HR_ADMIN) */}
          {hasAnyRole(['SUPPORT_AGENT', 'HR_ADMIN']) && (
            <NavLink
              to="/agent-queue"
              onClick={onCloseMobile}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isAgentQueueActive
                  ? 'bg-[#0e4a5c] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-[#0d2836] hover:bg-[#f0f9f8]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Headphones className="h-4 w-4 shrink-0 text-teal-600" />
                <span>Agent Queue</span>
              </div>
              {queueCount !== null && queueCount > 0 ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isAgentQueueActive ? 'bg-white text-[#0e4a5c]' : 'bg-teal-100 text-[#0e4a5c] border border-teal-300'
                }`}>
                  {queueCount}
                </span>
              ) : null}
            </NavLink>
          )}

          {/* 6. Employee Directory & Admin (Visible to HR_ADMIN) */}
          {hasRole('HR_ADMIN') && (
            <NavLink
              to="/admin"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isAdminActive
                  ? 'bg-[#0e4a5c] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-[#0d2836] hover:bg-[#f0f9f8]'
              }`}
            >
              <Users className="h-4 w-4 shrink-0 text-teal-600" />
              <span>Administration</span>
            </NavLink>
          )}
        </nav>

        {/* User Employment Badge at Bottom */}
        <div className="mt-4 rounded-xl bg-[#f2f8f8] p-3.5 border border-teal-100 text-[#0d2836]">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0e4a5c] text-white font-bold text-xs">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0d2836] truncate leading-tight">
                {user?.fullName || 'User Account'}
              </p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">
                {user?.employeeCode || 'Employee'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-teal-100/80 text-[10px] text-slate-600">
            <Building2 className="h-3 w-3 text-teal-700 shrink-0" />
            <span className="truncate">{user?.department?.name || 'General Operations'}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
