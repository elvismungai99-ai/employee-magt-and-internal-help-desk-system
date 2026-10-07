import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/Alert';
import { Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [savedFound, setSavedFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Where to navigate after login
  const from = (location.state as any)?.from?.pathname || '/';

  // Load remembered user & password from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('remembered_credentials');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) {
          setEmail(parsed.email);
          setSavedFound(true);
        }
        if (parsed.password) {
          setPassword(parsed.password);
        }
        if (parsed.rememberMe !== undefined) {
          setRememberMe(Boolean(parsed.rememberMe));
        }
      }
    } catch (e) {
      console.warn('Could not read remembered credentials', e);
    }
  }, []);

  const handleForgetSaved = () => {
    localStorage.removeItem('remembered_credentials');
    setEmail('');
    setPassword('');
    setRememberMe(false);
    setSavedFound(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (rememberMe) {
        localStorage.setItem(
          'remembered_credentials',
          JSON.stringify({ email, password, rememberMe: true, updatedAt: new Date().toISOString() })
        );
      } else {
        localStorage.removeItem('remembered_credentials');
      }

      await login({ email, password }, rememberMe);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please verify your email and password.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-10 h-10 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-base tracking-tight mx-auto mb-3 shadow-xs">
          HR
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Employee management and internal service portal
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 border border-slate-200 rounded-lg sm:px-9 shadow-xs">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-5"
            />
          )}

          {savedFound && (
            <div className="mb-4 flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700">
              <span className="font-medium">
                Saved credentials loaded
              </span>
              <button
                type="button"
                onClick={handleForgetSaved}
                className="text-slate-600 hover:text-rose-600 underline font-medium transition"
              >
                Clear
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (savedFound && e.target.value !== email) {
                    setSavedFound(false);
                  }
                }}
                placeholder="name@company.com"
                className="block w-full px-3.5 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full px-3.5 pr-10 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <span className="ml-2 font-medium">Keep me signed in</span>
              </label>

              {savedFound && (
                <button
                  type="button"
                  onClick={handleForgetSaved}
                  className="text-xs text-slate-500 hover:text-rose-600 underline font-medium transition"
                >
                  Forget
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-offset-1 focus:ring-slate-900 text-white rounded-md text-sm font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-5">
            New employee?{' '}
            <Link to="/register" className="font-semibold text-slate-900 hover:underline">
              Register an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
