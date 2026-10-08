import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  LogOut,
  ChevronDown,
  User,
  Shield,
  LifeBuoy,
  CalendarDays
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
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-teal-100 bg-white/95 px-6 backdrop-blur-md shadow-2xs">
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
          <h1 className="text-lg font-bold tracking-tight text-[#0d2836] sm:text-xl leading-tight">
            {title}
          </h1>
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#155b6e]">
            <Link to="/" className="text-slate-500 hover:text-[#0e4a5c]">
              Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-[#0e4a5c]">{title}</span>
          </div>
        </div>
      </div>

      {/* Right: Quick Action Hub & Authenticated Profile */}
      <div className="flex items-center gap-3">
        {/* User Profile Pill */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2.5 rounded-full border border-teal-200/80 bg-white py-1 pl-1.5 pr-3 shadow-2xs transition-all hover:border-teal-300 hover:bg-[#f0f9f8]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0e4a5c] font-bold text-xs text-white shadow-inner">
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
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
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
