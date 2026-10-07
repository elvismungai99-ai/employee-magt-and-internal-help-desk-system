import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, hasAnyRole, logout } = useAuth();
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
              {elapsedSeconds < 4 
                ? 'Verifying secure session...' 
                : elapsedSeconds < 15 
                ? 'Connecting to backend service...' 
                : 'Waking up cloud backend...'}
            </h3>
            <p className="text-xs text-slate-600 max-w-sm">
              {elapsedSeconds < 4
                ? 'Validating authorization credentials with the server.'
                : elapsedSeconds < 15
                ? 'Establishing a secure connection with cloud infrastructure.'
                : 'The cloud backend is spinning up from idle standby. Free-tier instances take ~30–60 seconds on initial boot.'}
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
                Cancel and go to Sign In screen &rarr;
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
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your account does not have permission to access this section. Contact an administrator if you believe this is in error.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 border border-teal-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-teal-50"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
