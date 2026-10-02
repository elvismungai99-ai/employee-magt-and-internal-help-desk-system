import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';
import { Department } from '../types';
import { Alert } from '../components/Alert';
import { 
  User, 
  Mail, 
  Lock, 
  Building, 
  Briefcase, 
  Phone, 
  ArrowRight, 
  ShieldCheck, 
  Headphones, 
  Users, 
  Calendar,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';

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
      icon: Users,
      desc: 'Submit leave applications & raise IT/HR tickets',
    },
    {
      id: 'LINE_MANAGER',
      name: 'Line Manager',
      icon: Calendar,
      desc: 'Supervise direct reports & approve leave requests',
    },
    {
      id: 'SUPPORT_AGENT',
      name: 'Support Agent',
      icon: Headphones,
      desc: 'Triage ticket queues, claim & resolve incidents',
    },
    {
      id: 'HR_ADMIN',
      name: 'HR Administrator',
      icon: ShieldCheck,
      desc: 'Manage staff, policies, scheduled engines & telemetry',
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
          <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100 text-center space-y-6">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Registration Submitted</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Thank you, <strong className="text-gray-900">{formData.firstName} {formData.lastName}</strong>! Your account has been created and is currently <span className="font-semibold text-amber-600">Pending HR Approval</span>.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Organizational Security Verification
              </div>
              <p>To avoid unauthorized access, all registrations must be reviewed and activated by an HR Administrator.</p>
              <p>Once HR verifies and approves your account, your leave balances will be activated and you will be able to log in with your email (<strong className="text-slate-700">{formData.email}</strong>).</p>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-xs transition"
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
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-md mb-3">
          EP
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Create User Profile
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your details and select your role to configure your system access permissions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 rounded-2xl sm:px-10">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-6"
            />
          )}

          <form onSubmit={handleSubmit} autoComplete="on" className="space-y-5">
            {/* Role Selection Grid */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Dictate Account Role <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roleOptions.map((r) => {
                  const Icon = r.icon;
                  const isSelected = formData.role === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setFormData((prev) => ({ ...prev, role: r.id }))}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-600/20'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-xs text-gray-900">{r.name}</span>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2 leading-tight">{r.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Jane"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="regEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Work Email <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="regEmail"
                  type="email"
                  autoComplete="username"
                  required
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="jane.doe@company.com"
                  className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="regPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="regPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  name="password"
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                  className="block w-full pl-9 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-hidden"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Department and Job Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Building className="w-4 h-4" />
                  </div>
                  <select
                    name="departmentId"
                    value={formData.departmentId}
                    onChange={handleChange}
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    placeholder="e.g. Senior Lead, Systems Engineer"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+254 700 000 000"
                  className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center pt-1">
              <label className="flex items-center text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="registerRememberMe"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="ml-2 font-medium">Remember my password &amp; user on this device</span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Creating Profile...' : 'Create Profile & Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 border-t border-gray-100 pt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
              Sign in with your credentials
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
