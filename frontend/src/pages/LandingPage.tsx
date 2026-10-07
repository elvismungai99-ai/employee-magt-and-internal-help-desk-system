import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Users, 
  LifeBuoy, 
  ShieldCheck, 
  LayoutGrid, 
  ArrowRight, 
  Clock, 
  CheckCircle2,
  FileText
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Interactive sample state for "Today at a glance" widget
  const [sampleIndex, setSampleIndex] = useState(0);

  const sampleLeaveRequests = [
    { title: 'Annual Leave (3 days)', dates: 'Oct 14 - Oct 16', status: 'Pending Approval', color: 'bg-amber-50 text-amber-900 border-amber-200' },
    { title: 'Sick Leave (1 day)', dates: 'Oct 08', status: 'Approved', color: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
    { title: 'Personal Time (2 days)', dates: 'Oct 22 - Oct 23', status: 'Under Review', color: 'bg-teal-50 text-teal-900 border-teal-200' },
  ];

  const sampleTickets = [
    { id: '#1042', title: 'VPN & Remote Access Gateway issue', priority: 'High', status: 'IN PROGRESS', color: 'bg-sky-50 text-sky-900 border-sky-200' },
    { id: '#1048', title: 'Payslip deduction calculation query', priority: 'Medium', status: 'ASSIGNED', color: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
    { id: '#1039', title: 'Workstation monitor setup request', priority: 'Low', status: 'RESOLVED', color: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  ];

  const currentLeaveSample = sampleLeaveRequests[sampleIndex % sampleLeaveRequests.length];
  const currentTicketSample = sampleTickets[sampleIndex % sampleTickets.length];

  const handleAction = (path: string) => {
    if (isAuthenticated) {
      navigate(path);
    } else {
      navigate('/login', { state: { from: { pathname: path } } });
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f8f8] text-[#0d2836] flex flex-col font-sans selection:bg-teal-200 selection:text-teal-900">
      {/* Top Navbar */}
      <header className="border-b border-teal-100 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#0e4a5c] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-[#083543] transition">
              EM
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[#0d2836] text-base tracking-tight leading-tight">
                Employee Management
              </span>
              <span className="text-[11px] text-teal-800 font-medium">
                &amp; Internal Help Desk Portal
              </span>
            </div>
          </Link>

          {/* Quick Header Nav Links */}
          <div className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => handleAction('/leave')}
              className="hover:text-[#0e4a5c] transition cursor-pointer"
            >
              Leave Management
            </button>
            <button
              type="button"
              onClick={() => handleAction('/helpdesk')}
              className="hover:text-[#0e4a5c] transition cursor-pointer"
            >
              Help Desk
            </button>
            <button
              type="button"
              onClick={() => handleAction('/approvals')}
              className="hover:text-[#0e4a5c] transition cursor-pointer"
            >
              Manager Approvals
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600 hidden sm:inline">
                  Signed in as <strong className="text-[#0d2836]">{user?.fullName || user?.firstName}</strong>
                </span>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/register"
                  className="px-3 py-1.5 border border-teal-200 text-[#0e4a5c] hover:bg-teal-50 text-xs font-semibold rounded-lg transition"
                >
                  Register
                </Link>
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-16 sm:space-y-20">
        
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e3f4f1] text-[#0e4a5c] text-xs font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0e4a5c]" />
              Enterprise Employee Service Desk
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0d2836] leading-[1.18] tracking-tight">
              Manage leave, approvals, and workplace support in one connected platform.
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
              A unified internal workspace for employees to plan time off, monitor quota balances, and submit IT &amp; HR support tickets with transparent, auditable workflows.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleAction('/leave')}
                className="px-5 py-2.5 bg-[#0e4a5c] hover:bg-[#083543] text-white text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4" /> Request Leave
              </button>
              <button
                type="button"
                onClick={() => handleAction('/helpdesk')}
                className="px-5 py-2.5 bg-white border border-teal-200 text-[#0e4a5c] hover:bg-[#f0f9f8] text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
              >
                <LifeBuoy className="w-4 h-4" /> Submit Help Ticket
              </button>
              {!isAuthenticated && (
                <Link
                  to="/register"
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-[#0e4a5c] transition inline-flex items-center gap-1"
                >
                  Create account &rarr;
                </Link>
              )}
            </div>
          </div>

          {/* Interactive Workspace Card: Today at a glance */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-teal-50">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
                    Employee Self-Service
                  </span>
                  <h3 className="font-serif text-lg font-bold text-[#0d2836]">
                    Today at a glance
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#eef7f6] text-[#0e4a5c] flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4" />
                </div>
              </div>

              {/* Sub-cards */}
              <div className="grid grid-cols-2 gap-3">
                <div 
                  onClick={() => handleAction('/leave')}
                  className="bg-[#eef7f6] p-4 rounded-xl border border-teal-100/60 cursor-pointer hover:border-teal-300 transition group"
                >
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Available Leave
                  </span>
                  <div className="text-2xl font-bold text-[#0e4a5c] mt-1">
                    18.5 days
                  </div>
                  <span className="text-[10px] text-teal-800 font-semibold mt-1 inline-flex items-center gap-1 group-hover:underline">
                    Apply for Leave &rarr;
                  </span>
                </div>

                <div 
                  onClick={() => handleAction('/leave')}
                  className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex flex-col justify-between cursor-pointer hover:border-teal-300 transition group"
                >
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Active Leave Application
                    </span>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${currentLeaveSample.color}`}>
                      {currentLeaveSample.status}
                    </span>
                    <div className="text-[11px] font-medium text-slate-700 mt-1">
                      {currentLeaveSample.title}
                    </div>
                  </div>
                  <span className="text-[10px] text-teal-800 font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline">
                    View in Portal &rarr;
                  </span>
                </div>
              </div>

              {/* Help Ticket Preview Row */}
              <div 
                onClick={() => handleAction('/helpdesk')}
                className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex items-center justify-between gap-3 cursor-pointer hover:border-teal-300 transition group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Help Ticket · {currentTicketSample.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${currentTicketSample.color}`}>
                      {currentTicketSample.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-1">
                    {currentTicketSample.title}
                  </p>
                </div>

                <span className="text-[10px] font-semibold text-[#0e4a5c] group-hover:underline whitespace-nowrap">
                  View &rarr;
                </span>
              </div>

              {/* Sample Switcher button */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-teal-50">
                <span>Interactive preview</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSampleIndex((prev) => prev + 1);
                  }}
                  className="text-[11px] font-semibold text-[#0e4a5c] hover:underline cursor-pointer"
                >
                  Cycle sample data &rarr;
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Core Platform Modules */}
        <section className="space-y-6 pt-4">
          <div className="space-y-1">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
              Core Platform Modules
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
              Engineered for seamless everyday operations.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Module 1: Leave Management */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[#0d2836]">
                  Leave Management &amp; Accrual Tracking
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Monitor allocated annual leave quotas, submit absence requests with date ranges, and view approval statuses with zero guesswork.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleAction('/leave')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  Go to Leave Portal <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Module 2: Manager Approvals */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[#0d2836]">
                  Line Manager Approvals
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Review direct reports' pending leave applications, assess team coverage schedules, and approve or reject submissions with manager notes.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleAction('/approvals')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  Go to Approvals <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Module 3: Internal Help Desk */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[#0d2836]">
                  Internal Help Desk &amp; Incidents
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Raise IT, HR, and facility support tickets with severity levels (Low, Medium, High, Critical) and follow progress without scattered emails.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleAction('/helpdesk')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  Raise a Ticket <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Module 4: Support Queue & Admin */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[#0d2836]">
                  Support Agent Queue &amp; Administration
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Support agents manage assigned ticket queues and resolution notes, while administrators maintain organization roles and accounts.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleAction('/agent-queue')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  Go to Agent Queue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: How it Works */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
          <div className="lg:col-span-5 space-y-2">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
              Workflow Lifecycle
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
              A structured route from submission to resolution.
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-sm pt-1">
              Clear accountability and notifications ensure requests move forward without administrative bottlenecks.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
              <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h4 className="font-bold text-sm text-[#0d2836]">
                Submit Request
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose leave dates or log an IT/HR support ticket with relevant details.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
              <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h4 className="font-bold text-sm text-[#0d2836]">
                Review &amp; Assignment
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Line managers review absences, and support agents claim tickets based on priority.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
              <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h4 className="font-bold text-sm text-[#0d2836]">
                Resolution &amp; Logs
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automatic quota recalculation, status updates, and transparent audit history.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Built for Everyone in the Organization */}
        <section className="bg-[#e4f3f0] rounded-2xl border border-teal-200/80 p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold tracking-wider uppercase text-teal-800 block">
              Organizational Clarity
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
              Tailored workspaces for employees, managers, and agents.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-[#0d2836]">
                  For Employees
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Track individual PTO quotas, apply for sick or annual leaves, and get rapid workplace support through documented tickets.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleAction('/leave')}
                  className="text-xs font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Go to Employee Portal &rarr;
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-[#0d2836]">
                  For Managers &amp; Support Agents
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Approve department time-off requests, assign support tickets, resolve user issues, and manage team coverage.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleAction('/approvals')}
                  className="text-xs font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Go to Management &amp; Approvals &rarr;
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Dark Petrol Final CTA Banner */}
        <section className="bg-[#0f2e3d] rounded-2xl p-8 sm:p-12 text-center text-white space-y-5 shadow-sm">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-xl mx-auto leading-snug">
            Ready to streamline leave and workplace support?
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Sign in to access your organization workspace, submit requests, or manage direct reports.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center px-6 py-2.5 bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0a2734] font-bold text-sm rounded-xl shadow-xs transition"
              >
                Go to Dashboard &rarr;
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0a2734] font-bold text-sm rounded-xl shadow-xs transition"
                >
                  Sign In to Account
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-teal-200/40 text-white font-semibold text-sm rounded-xl shadow-xs transition"
                >
                  Register as Employee
                </Link>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-teal-100 bg-white/80 py-6 text-center text-xs text-slate-500">
        Employee Management &amp; Internal Help Desk System &bull; &copy; 2026 All rights reserved.
      </footer>
    </div>
  );
};
