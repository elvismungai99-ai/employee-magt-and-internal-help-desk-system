import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';
import { Department } from '../types';
import { Alert } from '../components/Alert';
import { Eye, EyeOff } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    jobTitle: '',
    departmentId: '',
    role: 'EMPLOYEE',
  });

  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const deps = await authApi.getDepartments();
        setDepartments(deps);
        if (deps.length > 0) {
          setFormData((prev) => ({ ...prev, departmentId: deps[0].id }));
        }
      } catch (err) {
        console.warn('Could not load departments dynamically', err);
      }
    };
    fetchDepartments();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const roleOptions = [
    {
      id: 'EMPLOYEE',
      name: 'Standard Employee',
      desc: 'Submit leave applications and raise help desk requests',
    },
    {
      id: 'LINE_MANAGER',
      name: 'Line Manager',
      desc: 'Manage direct reports and approve leave requests',
    },
    {
      id: 'SUPPORT_AGENT',
      name: 'Support Agent',
      desc: 'Triage ticket queues, claim and resolve technical incidents',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (rememberMe) {
        localStorage.setItem(
          'remembered_credentials',
          JSON.stringify({
            email: formData.email,
            password: formData.password,
            rememberMe: true,
            updatedAt: new Date().toISOString(),
          })
        );
      } else {
        localStorage.removeItem('remembered_credentials');
      }

      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        jobTitle: formData.jobTitle || undefined,
        departmentId: formData.departmentId || undefined,
        role: formData.role,
      }, rememberMe);

      setIsSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please review your details.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 rounded-lg sm:px-9 border border-slate-200 text-center space-y-5 shadow-xs">
            <div className="w-12 h-12 bg-amber-50 text-amber-800 rounded-md border border-amber-200 flex items-center justify-center mx-auto text-lg font-bold">
              !
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-900">Registration Submitted</h2>
              <p className="text-sm text-slate-600">
                Your account for <strong className="text-slate-900">{formData.firstName} {formData.lastName}</strong> has been registered.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-md border border-slate-200 text-left text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-800">
                Administrator Approval Required
              </div>
              <p>In accordance with internal company policy, your registration is pending review by an HR Administrator.</p>
              <p>Once verified, your leave balance quota will be allocated and you may sign in with your email address (<strong className="text-slate-800">{formData.email}</strong>).</p>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md shadow-xs transition"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="w-10 h-10 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-base tracking-tight mx-auto mb-3 shadow-xs">
          HR
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Register employee account
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Enter your employee information and select your organization role
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 border border-slate-200 rounded-lg sm:px-9 shadow-xs">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
            {/* Role Selection Grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Account Role <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {roleOptions.map((r) => {
                  const isSelected = formData.role === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setFormData((prev) => ({ ...prev, role: r.id }))}
                      className={`p-3 rounded-md border cursor-pointer transition text-left flex flex-col justify-between ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{r.name}</span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <span className="w-1 h-1 rounded-full bg-white" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{r.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="e.g. Jane"
                  className="block w-full px-3.5 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="e.g. Doe"
                  className="block w-full px-3.5 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="regEmail" className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email <span className="text-red-500">*</span>
              </label>
              <input
                id="regEmail"
                type="email"
                autoComplete="username"
                required
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@company.com"
                className="block w-full px-3.5 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="regPassword" className="block text-xs font-semibold text-slate-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="regPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  name="password"
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
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

            {/* Department and Job Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                >
                  <option value="">Select Department...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Designation / Job Title
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer"
                  className="block w-full px-3.5 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+254 700 000 000"
                className="block w-full px-3.5 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div className="flex items-center pt-1">
              <label className="flex items-center text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="registerRememberMe"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <span className="ml-2 font-medium">Keep me signed in on this browser</span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-offset-1 focus:ring-slate-900 text-white rounded-md text-sm font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
              >
                {isSubmitting ? 'Submitting registration...' : 'Register Account'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-5">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-slate-900 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
