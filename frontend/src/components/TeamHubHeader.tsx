import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  Settings,
  Bell,
  Menu,
  LogOut,
  ChevronDown,
  User,
  Shield,
  CheckCircle2,
  Calendar,
  LifeBuoy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TeamHubHeaderProps {
  onToggleMobileMenu?: () => void;
  title?: string;
  breadcrumb?: string;
}

export const TeamHubHeader: React.FC<TeamHubHeaderProps> = ({
  onToggleMobileMenu,
  title = 'Leave Management',
  breadcrumb = 'Dashboard / Leave Management',
}) => {
  const { user, logout, roles } = useAuth();
  const location = useLocation();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.fullName || 'Davis Levin';
  const roleDisplay = roles.includes('HR_ADMIN')
    ? 'HR Admin'
    : roles.includes('LINE_MANAGER')
    ? 'Manager'
    : roles.includes('SUPPORT_AGENT')
    ? 'Support Agent'
    : 'User';

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[#e3edea] bg-[#fbfdfc]/90 px-6 backdrop-blur-md">
      {/* Left: Mobile trigger & Page Titles */}
      <div className="flex items-center gap-4">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="rounded-xl p-2 text-slate-500 hover:bg-[#eef5f3] hover:text-slate-800 lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {title}
          </h1>
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <Link to="/" className="text-slate-500 hover:text-emerald-700">Dashboard</Link>
            <span className="text-slate-400">/</span>
            <span className="text-emerald-600 font-semibold">
              {title}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Search, Utilities & User Profile */}
      <div className="flex items-center gap-3">
        {/* Search input - pill style like mockup */}
        <div className="relative hidden md:block">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything"
            className="w-56 lg:w-64 rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-normal text-slate-700 placeholder-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Settings button */}
        <button
          type="button"
          title="TeamHub Preferences"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-[#f5faf8] hover:text-slate-800"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Notification bell button with active dot */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-[#f5faf8] hover:text-slate-800"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>

          {/* Notifications Popover */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 px-1">
                <span className="text-xs font-bold text-slate-800">Notifications</span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  2 New
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#f6faf8] text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Leave Schedule Synchronized</p>
                    <p className="text-[11px] text-slate-500">Public holiday &amp; team leaves up to date.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 text-xs">
                  <Calendar className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Upcoming Leave Notice</p>
                    <p className="text-[11px] text-slate-500">Public holiday on 7th June (King's Birthday).</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill - matching mockup: avatar + Davis Levin + User */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition-all hover:border-slate-300 hover:bg-[#f5faf8]"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 font-semibold text-white shadow-inner overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt={displayName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image doesn't load
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-xs font-bold text-white uppercase">
                {displayName.slice(0, 2)}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] font-medium text-slate-500 leading-tight">
                {roleDisplay}
              </p>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {/* User Menu Dropdown */}
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl z-50">
              <div className="px-3 py-2.5 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800">{displayName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email || 'davis.levin@teamhub.internal'}</p>
                {user?.employeeCode && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {user.employeeCode} &bull; {user.department?.name || 'Operations'}
                  </span>
                )}
              </div>

              <div className="py-1">
                <Link
                  to="/"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#eef5f3] rounded-xl"
                >
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span>My Dashboard</span>
                </Link>

                <Link
                  to="/helpdesk"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#eef5f3] rounded-xl"
                >
                  <LifeBuoy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Internal Help Desk</span>
                </Link>

                {roles.includes('HR_ADMIN') && (
                  <Link
                    to="/admin"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#eef5f3] rounded-xl"
                  >
                    <Shield className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Admin Controls</span>
                  </Link>
                )}
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
