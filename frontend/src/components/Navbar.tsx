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
    px-3 py-1.5 text-sm font-medium rounded-md transition-colors
    ${isActive(path)
      ? 'bg-slate-100 text-slate-900 font-semibold'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
  `;

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : '';

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight">
                HR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-sm tracking-tight leading-none">
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
                  <span className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.fullName || `${user.firstName} ${user.lastName}`}
                  </span>
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    <span className="text-xs text-slate-500 font-mono">
                      {user.employeeCode}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                      {roles[0]?.replace('ROLE_', '') || 'EMPLOYEE'}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-semibold text-xs tracking-wider">
                  {initials}
                </div>

                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
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
