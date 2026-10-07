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
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItemClass = (path: string) => `
    px-3 py-1.5 text-sm font-medium rounded-md transition-all
    ${isActive(path)
      ? 'bg-blue-100/90 text-blue-950 font-semibold border border-blue-200/90 shadow-2xs'
      : 'text-slate-700 hover:text-black hover:bg-blue-50/70'}
  `;

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : '';

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-blue-100 sticky top-0 z-40 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-slate-950 text-white flex items-center justify-center font-bold text-sm tracking-tight ring-2 ring-blue-100 shadow-2xs">
                HR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-black text-sm tracking-tight leading-none">
                  Employee Management
                </span>
                <span className="text-[11px] text-slate-500 font-medium tracking-normal mt-0.5">
                  Internal Service Desk
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className={navItemClass('/')}>
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
                  <span className="text-sm font-bold text-black leading-tight">
                    {user.fullName || `${user.firstName} ${user.lastName}`}
                  </span>
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    <span className="text-xs text-slate-500 font-mono">
                      {user.employeeCode}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-900 px-2 py-0.5 rounded font-medium border border-blue-200">
                      {roles[0]?.replace('ROLE_', '') || 'EMPLOYEE'}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center font-bold text-xs tracking-wider ring-2 ring-blue-100">
                  {initials}
                </div>

                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-blue-50 rounded-md transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-slate-800 hover:text-black hover:bg-blue-50 rounded-md transition"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-sm font-semibold text-white bg-slate-950 hover:bg-black rounded-md shadow-xs transition"
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
