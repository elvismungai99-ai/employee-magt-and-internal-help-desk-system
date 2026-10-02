import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/Alert';
import { Lock, Mail, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

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
      const msg = err.response?.data?.message || err.message || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-md mb-3">
          EP
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Welcome back
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to your employee account to manage leave &amp; help desk requests
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 rounded-2xl sm:px-10">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-6"
            />
          )}

          {savedFound && (
            <div className="mb-4 flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                Remembered user &amp; password loaded
              </span>
              <button
                type="button"
                onClick={handleForgetSaved}
                className="text-blue-800 hover:text-red-600 underline font-semibold transition"
              >
                Forget
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="on" className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Work Email
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-hidden"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="ml-2 font-medium">Remember my password &amp; user</span>
              </label>

              {savedFound && (
                <button
                  type="button"
                  onClick={handleForgetSaved}
                  className="text-xs text-slate-500 hover:text-red-600 underline font-medium transition"
                >
                  Clear saved
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 border-t border-gray-100 pt-6">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500">
              Create a profile &amp; select roles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
