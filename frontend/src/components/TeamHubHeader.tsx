import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  LogOut,
  ChevronDown,
  User,
  Shield,
  LifeBuoy,
  CalendarDays,
  Plus,
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  Ticket
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
  const { user, logout, roles, hasRole } = useAuth();
  const navigate = useNavigate();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (quickActionRef.current && !quickActionRef.current.contains(e.target as Node)) {
        setQuickActionOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.fullName || 'User Account';
  const roleDisplay = roles.includes('HR_ADMIN')
    ? 'HR Administrator'
    : roles.includes('LINE_MANAGER')
    ? 'Line Manager'
    : roles.includes('SUPPORT_AGENT')
    ? 'Support Agent'
    : 'Employee';

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'EM'
    : 'EM';

  // Sample dynamic notifications
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Leave Policy Active',
      message: 'Kenyan statutory holidays & public calendar active for working day calculations.',
      time: 'Just now',
      read: false,
      type: 'leave',
    },
    {
      id: '2',
      title: 'Help Desk SLA Monitor',
      message: 'Business-hours SLA policies (08:00–17:00) active with auto-pause on pending requests.',
      time: '1h ago',
      read: false,
      type: 'ticket',
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-teal-100 bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-2xs">
      {/* Left: Mobile Trigger & Page Navigation Breadcrumbs */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="rounded-lg p-2 text-slate-600 hover:bg-[#f0f9f8] hover:text-[#0d2836] lg:hidden"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0d2836] leading-tight">
            {title}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#155b6e]">
            <Link to="/" className="text-slate-500 hover:text-[#0e4a5c]">
              Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-[#0e4a5c]">{title}</span>
          </div>
        </div>
      </div>

      {/* Right: Quick Action Launcher, Notifications & Authenticated Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* 1. Global + Create Quick Action */}
        <div className="relative" ref={quickActionRef}>
          <button
            type="button"
            onClick={() => setQuickActionOpen(!quickActionOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Action</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>

          {quickActionOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-teal-100 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Quick Shortcuts
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickActionOpen(false);
                  navigate('/leave');
                }}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#f0f9f8] hover:text-[#0e4a5c] rounded-xl transition"
              >
                <div className="w-6 h-6 rounded-lg bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-slate-900 font-bold">Request Leave</div>
                  <div className="text-[10px] text-slate-500 font-normal">Full or half-day application</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuickActionOpen(false);
                  navigate('/helpdesk');
                }}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#f0f9f8] hover:text-[#0e4a5c] rounded-xl transition"
              >
                <div className="w-6 h-6 rounded-lg bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                  <LifeBuoy className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-slate-900 font-bold">Open Support Ticket</div>
                  <div className="text-[10px] text-slate-500 font-normal">IT, HR & facilities support</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 2. Notification Center Bell */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-teal-200/80 bg-white text-slate-600 hover:bg-[#f0f9f8] hover:text-[#0e4a5c] shadow-2xs transition"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-teal-100 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-teal-50">
                <span className="text-xs font-bold text-[#0d2836]">System Activity &amp; Alerts</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[10px] font-semibold text-[#0e4a5c] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl border text-xs transition ${
                      n.read
                        ? 'bg-white border-slate-100 text-slate-600'
                        : 'bg-[#f0f9f8] border-teal-200 text-[#0d2836]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${n.read ? 'bg-slate-300' : 'bg-[#0e4a5c]'}`} />
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 pl-3">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. User Profile Pill */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 rounded-full border border-teal-200/80 bg-white py-1 pl-1.5 pr-2.5 sm:pr-3 shadow-2xs transition-all hover:border-teal-300 hover:bg-[#f0f9f8]"
          >
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#0e4a5c] font-bold text-xs text-white shadow-inner">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-[#0d2836] leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] font-medium text-[#155b6e] leading-tight">
                {roleDisplay}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown */}
          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-teal-100 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2.5 border-b border-teal-50">
                <p className="text-xs font-bold text-[#0d2836]">{displayName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                {user?.employeeCode && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-[#0e4a5c] bg-[#e3f4f1] px-2 py-0.5 rounded">
                    {user.employeeCode} &bull; {user.department?.name || 'Department'}
                  </span>
                )}
              </div>

              <div className="py-1">
                <Link
                  to="/"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#f0f9f8] hover:text-[#0d2836] rounded-xl"
                >
                  <User className="h-3.5 w-3.5 text-[#0e4a5c]" />
                  <span>My Dashboard</span>
                </Link>

                <Link
                  to="/leave"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#f0f9f8] hover:text-[#0d2836] rounded-xl"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-[#0e4a5c]" />
                  <span>Leave Portal</span>
                </Link>

                <Link
                  to="/helpdesk"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#f0f9f8] hover:text-[#0d2836] rounded-xl"
                >
                  <LifeBuoy className="h-3.5 w-3.5 text-[#0e4a5c]" />
                  <span>Internal Help Desk</span>
                </Link>

                {hasRole('HR_ADMIN') && (
                  <Link
                    to="/admin"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#f0f9f8] hover:text-[#0d2836] rounded-xl"
                  >
                    <Shield className="h-3.5 w-3.5 text-[#0e4a5c]" />
                    <span>Admin Monitoring</span>
                  </Link>
                )}
              </div>

              <div className="border-t border-teal-50 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
