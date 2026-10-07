import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, roles, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && (location.pathname === '/dashboard' || location.pathname === '/')) return true;
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItemClass = (path: string) => `
    px-3 py-1.5 text-xs font-semibold rounded-lg transition-all
    ${isActive(path)
      ? 'bg-[#e3f4f1] text-[#0e4a5c] border border-teal-200/80 shadow-2xs font-bold'
      : 'text-slate-600 hover:text-[#0d2836] hover:bg-[#f0f9f8]'}
  `;

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : '';

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-teal-100/90 sticky top-0 z-40 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#0e4a5c] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-[#083543] transition">
                W
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[#0d2836] text-sm tracking-tight leading-none group-hover:text-[#0e4a5c] transition">
                  WorkHub
                </span>
                <span className="text-[11px] text-teal-800/80 font-medium tracking-normal mt-0.5">
                  Internal Workspace
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-[#0e4a5c] hover:bg-[#f0f9f8] rounded-lg transition" title="View WorkHub Landing Page">
                Overview
              </Link>

              <Link to="/dashboard" className={navItemClass('/dashboard')}>
                Dashboard
              </Link>

              <Link to="/leave" className={navItemClass('/leave')}>
                Leave
              </Link>

              <Link to="/helpdesk" className={navItemClass('/helpdesk')}>
                Help Desk
              </Link>

              {(hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) && (
                <Link to="/approvals" className={navItemClass('/approvals')}>
                  Approvals
                </Link>
              )}

              {(hasRole('SUPPORT_AGENT') || hasRole('HR_ADMIN')) && (
                <Link to="/agent-queue" className={navItemClass('/agent-queue')}>
                  Agent Queue
                </Link>
              )}

              {hasRole('HR_ADMIN') && (
                <Link to="/admin" className={navItemClass('/admin')}>
                  Administration
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-bold text-[#0d2836] leading-tight">
                    {user.fullName || `${user.firstName} ${user.lastName}`}
                  </span>
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    <span className="text-xs text-slate-500 font-mono">
                      {user.employeeCode}
                    </span>
                    <span className="text-[10px] bg-[#e3f4f1] text-[#0e4a5c] px-2 py-0.5 rounded font-semibold border border-teal-200/80">
                      {roles[0]?.replace('ROLE_', '') || 'EMPLOYEE'}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-lg bg-[#0e4a5c] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs ring-2 ring-teal-100">
                  {initials}
                </div>

                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#0d2836] hover:bg-teal-50/60 rounded-lg transition"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0e4a5c] hover:bg-[#083543] rounded-lg shadow-xs transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
