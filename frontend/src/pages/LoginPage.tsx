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
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [submitSeconds, setSubmitSeconds] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isSubmitting) {
      timer = setInterval(() => {
        setSubmitSeconds((s) => s + 1);
      }, 1000);
    } else {
      setSubmitSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSubmitting]);

  // Where to navigate after login
  const rawFrom = (location.state as any)?.from?.pathname;
  const from = rawFrom && rawFrom !== '/login' ? rawFrom : '/';

  // Purge any legacy insecure plain-text credentials from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('remembered_credentials');
    } catch {
      // Ignore
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
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
    <div className="min-h-screen bg-[#f2f8f8] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#0e4a5c] text-white flex items-center justify-center font-bold text-base tracking-tight shadow-xs group-hover:bg-[#083543] transition">
            EM
          </div>
        </Link>
        <h1 className="text-2xl font-bold text-[#0d2836] tracking-tight">
          Sign in to your account
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Employee Management &amp; Internal Help Desk Portal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 border border-teal-100 rounded-2xl sm:px-9 shadow-xs">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-900 mb-1">
                Work Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="block w-full px-3.5 py-2 border border-teal-200/90 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-900 mb-1">
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
                  className="block w-full px-3.5 pr-10 py-2 border border-teal-200/90 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0e4a5c] focus:border-[#0e4a5c] bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
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
                  className="h-4 w-4 rounded border-teal-200 text-[#0e4a5c] focus:ring-[#0e4a5c] cursor-pointer"
                />
                <span className="ml-2 font-medium">Keep me signed in</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-[#0e4a5c] hover:bg-[#083543] focus:outline-hidden focus:ring-2 focus:ring-offset-1 focus:ring-[#0e4a5c] text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>

            {isSubmitting && submitSeconds >= 4 && (
              <p className="mt-2 text-center text-xs text-slate-500 animate-pulse">
                {submitSeconds < 15
                  ? 'Connecting to secure server...'
                  : 'Waking up cloud server from standby (free tier takes ~30–60s on first request)...'}
              </p>
            )}
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 border-t border-teal-100 pt-5">
            New employee?{' '}
            <Link to="/register" className="font-semibold text-[#0e4a5c] hover:underline transition">
              Register an account &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
