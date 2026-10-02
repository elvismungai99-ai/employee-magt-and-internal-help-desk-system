import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  CalendarDays, 
  HelpCircle, 
  LayoutDashboard, 
  CheckSquare, 
  Headphones, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon 
} from 'lucide-react';

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
    flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
    ${isActive(path)
      ? 'bg-blue-600 text-white shadow-xs'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}
  `;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                EP
              </div>
              <span className="font-bold text-gray-900 text-lg tracking-tight hidden sm:inline">
                Enterprise Portal
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className={navItemClass('/')}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              <Link to="/leave" className={navItemClass('/leave')}>
                <CalendarDays className="w-4 h-4" />
                <span>Leave</span>
              </Link>

              <Link to="/helpdesk" className={navItemClass('/helpdesk')}>
                <HelpCircle className="w-4 h-4" />
                <span>Help Desk</span>
              </Link>

              {(hasRole('LINE_MANAGER') || hasRole('HR_ADMIN')) && (
                <Link to="/approvals" className={navItemClass('/approvals')}>
                  <CheckSquare className="w-4 h-4" />
                  <span>Approvals</span>
                </Link>
              )}

              {(hasRole('SUPPORT_AGENT') || hasRole('HR_ADMIN')) && (
                <Link to="/agent-queue" className={navItemClass('/agent-queue')}>
                  <Headphones className="w-4 h-4" />
                  <span>Agent Queue</span>
                </Link>
              )}

              {hasRole('HR_ADMIN') && (
                <Link to="/admin" className={navItemClass('/admin')}>
                  <ShieldCheck className="w-4 h-4" />
                  <span>HR &amp; Admin</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-semibold text-gray-800 leading-tight">
                    {user.fullName || `${user.firstName} ${user.lastName}`}
                  </span>
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-xs text-gray-500 font-mono">
                      {user.employeeCode}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                      {roles[0]?.replace('ROLE_', '') || 'EMPLOYEE'}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <UserIcon className="w-5 h-5 text-slate-600" />
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Log out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
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
