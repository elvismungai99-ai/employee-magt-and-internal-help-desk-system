import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Inbox,
  Calendar,
  Users,
  Clock,
  TrendingUp,
  Wallet,
  CalendarCheck,
  UserCheck,
  Sparkles,
  ShieldCheck,
  Headphones
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TeamHubSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const TeamHubSidebar: React.FC<TeamHubSidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const location = useLocation();
  const { user, hasRole, hasAnyRole } = useAuth();

  const isLeaveActive = location.pathname === '/leave';
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
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col bg-[#fbfdfc] border-r border-[#e3edea] px-4 py-5 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-3 mb-7">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-800">TeamHub</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          <NavLink
            to="/"
            onClick={onCloseMobile}
            className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isDashboardActive
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#eef5f3]'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/helpdesk"
            onClick={onCloseMobile}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isInboxActive
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#eef5f3]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Inbox className="h-4 w-4" />
              <span>Inbox</span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isInboxActive
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Desk
            </span>
          </NavLink>

          <NavLink
            to="/leave"
            onClick={onCloseMobile}
            className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              location.pathname === '/calendar'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#eef5f3]'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Calendar</span>
          </NavLink>

          {/* Role-Specific quick link for Admin / Employees */}
          {hasRole('HR_ADMIN') ? (
            <NavLink
              to="/admin"
              onClick={onCloseMobile}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isAdminActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-[#eef5f3]'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Employees</span>
            </NavLink>
          ) : (
            <div
              className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed opacity-80"
              title="Employee Directory is managed by HR Admin"
            >
              <Users className="h-4 w-4" />
              <span>Employees</span>
            </div>
          )}

          <div
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 cursor-default"
            title="Standard full-time 40h attendance synced"
          >
            <Clock className="h-4 w-4" />
            <span>Attendance</span>
          </div>

          <div
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 cursor-default"
            title="Annual reviews scheduled in Q4"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Performance</span>
          </div>

          <div
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 cursor-default"
            title="Payroll cycle active: 28th of every month"
          >
            <Wallet className="h-4 w-4" />
            <span>Payroll</span>
          </div>

          {/* Active Leave Management Tab as shown in mockup */}
          <NavLink
            to="/leave"
            onClick={onCloseMobile}
            className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isLeaveActive
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#eef5f3]'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            <span>Leave Management</span>
          </NavLink>

          <div
            className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 cursor-default"
            title="Recruitment portal available for HR managers"
          >
            <UserCheck className="h-4 w-4" />
            <span>Recruitment</span>
          </div>

          {/* Role-Specific Approvals Menu */}
          {hasAnyRole(['LINE_MANAGER', 'HR_ADMIN']) && (
            <div className="pt-2 border-t border-[#e3edea] my-2">
              <NavLink
                to="/approvals"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isApprovalsActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-[#eef5f3]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Approvals</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Action
                </span>
              </NavLink>
            </div>
          )}

          {/* Support Queue for Support Agents */}
          {hasAnyRole(['SUPPORT_AGENT', 'HR_ADMIN']) && (
            <NavLink
              to="/agent-queue"
              onClick={onCloseMobile}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isAgentQueueActive
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-[#eef5f3]'
              }`}
            >
              <Headphones className="h-4 w-4 text-teal-600" />
              <span>Agent Queue</span>
            </NavLink>
          )}
        </nav>

        {/* Bottom "Level Up Your HR" promotional action card */}
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#d4f3e9] to-[#ebf9f3] p-4 border border-[#c1e8dc] text-slate-800 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-xs text-slate-800 tracking-tight">Level Up Your HR</span>
          </div>
          <p className="text-[11px] leading-tight text-slate-600 mb-3">
            Boost employee satisfaction &amp; automate approvals effortlessly.
          </p>
          <NavLink
            to="/leave"
            className="inline-flex items-center justify-center w-full py-1.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-[11px] font-semibold text-emerald-800 border border-emerald-200 shadow-sm transition-all"
          >
            Leave Policy Guide
          </NavLink>
        </div>
      </aside>
    </>
  );
};
