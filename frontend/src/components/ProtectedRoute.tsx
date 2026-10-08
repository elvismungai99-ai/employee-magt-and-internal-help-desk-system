import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Calendar, LifeBuoy, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, hasAnyRole, logout, user, roles } = useAuth();
  const location = useLocation();
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f6fc] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-blue-100 p-8 shadow-xs flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-slate-950 rounded-full animate-spin"></div>
          
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-950">
              {elapsedSeconds < 6 
                ? 'Verifying secure session...' 
                : 'Loading your workspace...'}
            </h3>
            <p className="text-xs text-slate-600 max-w-sm">
              Please wait while your session and permissions are being loaded.
            </p>
          </div>

          {elapsedSeconds >= 8 && (
            <div className="pt-2 w-full flex flex-col gap-2">
              <div className="w-full bg-blue-50 rounded-full h-1.5 overflow-hidden border border-blue-100">
                <div 
                  className="bg-slate-950 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(95, elapsedSeconds * 2.5)}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="mt-2 text-xs text-blue-700 hover:text-black font-semibold underline transition cursor-pointer"
              >
                Return to Sign In screen &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    const formatRoleTitle = (r: string) => {
      const clean = r.replace(/^ROLE_/, '').toUpperCase();
      if (clean === 'HR_ADMIN') return 'HR Administrator';
      if (clean === 'LINE_MANAGER') return 'Line Manager';
      if (clean === 'SUPPORT_AGENT') return 'Support Agent';
      if (clean === 'EMPLOYEE') return 'Employee';
      return clean;
    };

    const currentRolesDisplay = roles && roles.length > 0
      ? roles.map(formatRoleTitle).join(', ')
      : 'Employee';

    const requiredRolesDisplay = allowedRoles.map(formatRoleTitle).join(' or ');

    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4 selection:bg-teal-200 selection:text-teal-900">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-teal-100 p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200/60 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[#0d2836]">Restricted Area</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              This module requires elevated privileges that are not assigned to your account.
            </p>
          </div>

          {/* Role Status Diagnostic Box */}
          <div className="bg-[#f0f9f8] border border-teal-200/70 rounded-xl p-4 text-xs text-left space-y-2">
            <div className="flex justify-between items-center border-b border-teal-100 pb-2">
              <span className="text-slate-500 font-medium">Your Current Role:</span>
              <span className="font-bold text-[#0e4a5c] bg-[#e3f4f1] px-2.5 py-0.5 rounded-full border border-teal-200">
                {currentRolesDisplay}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-teal-100 pb-2">
              <span className="text-slate-500 font-medium">Required Role:</span>
              <span className="font-semibold text-slate-800">
                {requiredRolesDisplay}
              </span>
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-slate-500 font-medium">Account:</span>
              <span className="font-medium text-slate-700 truncate max-w-[200px]">
                {user?.email || 'Authenticated User'}
              </span>
            </div>
          </div>

          {/* Quick Safe Actions */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Continue to your accessible workspaces:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                to="/leave"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-200 rounded-xl text-xs font-semibold text-[#0e4a5c] bg-white hover:bg-[#eef7f6] transition shadow-2xs"
              >
                <Calendar className="w-4 h-4" />
                Leave Portal
              </Link>
              <Link
                to="/helpdesk"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-200 rounded-xl text-xs font-semibold text-[#0e4a5c] bg-white hover:bg-[#eef7f6] transition shadow-2xs"
              >
                <LifeBuoy className="w-4 h-4" />
                Help Desk
              </Link>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <Link
                to="/"
                className="text-xs font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Dashboard
              </Link>
              <span className="text-slate-300">&bull;</span>
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign in with another account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
