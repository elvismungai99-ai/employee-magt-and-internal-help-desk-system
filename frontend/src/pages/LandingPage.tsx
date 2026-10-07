import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  BookOpen, 
  LayoutGrid, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Visual Direction Selector state (interactive)
  const [selectedDirection, setSelectedDirection] = useState('1 - Blue & mint');

  // Interactive sample state for "Today at a glance" widget
  const [sampleIndex, setSampleIndex] = useState(0);
  const sampleLeaveRequests = [
    { title: 'Annual Leave (3 days)', status: 'Awaiting approval', color: 'bg-teal-50 text-teal-800 border-teal-200' },
    { title: 'Sick Leave (1 day)', status: 'Approved', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { title: 'Personal Time (2 days)', status: 'Under review', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  ];

  const sampleTickets = [
    { id: '#1842', desc: 'VPN Authentication error', status: 'In progress', color: 'bg-sky-50 text-sky-800 border-sky-200' },
    { id: '#1845', desc: 'Payroll deduction query', status: 'Assigned', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    { id: '#1839', desc: 'Hardware monitor setup', status: 'Resolved', color: 'bg-teal-50 text-teal-800 border-teal-200' },
  ];

  const directions = [
    '1 - Blue & mint',
    '2 - Coral & navy',
    '3 - Violet & teal',
    '4 - Dark & electric',
    '5 - Cream & forest',
  ];

  const currentLeaveSample = sampleLeaveRequests[sampleIndex % sampleLeaveRequests.length];
  const currentTicketSample = sampleTickets[sampleIndex % sampleTickets.length];

  return (
    <div className="min-h-screen bg-[#f2f8f8] text-[#0d2836] flex flex-col font-sans selection:bg-teal-200 selection:text-teal-900">
      {/* Top Navbar */}
      <header className="border-b border-teal-100 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#0e4a5c] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-[#083543] transition">
              W
            </div>
            <span className="font-bold text-[#0d2836] text-lg tracking-tight">
              WorkHub
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600 hidden sm:inline">
                  Signed in as <strong className="text-[#0d2836]">{user?.fullName || user?.firstName}</strong>
                </span>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-[#0e4a5c] hover:text-[#083543] transition px-3 py-1.5"
                >
                  Explore the workspace
                </Link>
                <Link
                  to="/login"
                  className="px-4 py-2 bg-[#0e4a5c] hover:bg-[#083543] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-20">
        {/* Visual Direction Selector Bar */}
        <section className="bg-white rounded-2xl border border-teal-100/80 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-3">
            <span className="font-bold tracking-wider uppercase text-slate-500 text-[11px]">
              Choose a visual direction
            </span>
            <span className="text-slate-400 text-[11px]">
              Your selection is saved for next time.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {directions.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDirection(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedDirection === d
                    ? 'bg-[#0e4a5c] text-white shadow-2xs font-semibold'
                    : 'bg-[#f5faf9] text-slate-600 hover:text-slate-900 hover:bg-[#eaf5f3]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center pt-2 sm:pt-4">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e3f4f1] text-[#0e4a5c] text-xs font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0e4a5c]" />
              One Employee Workspace
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0d2836] leading-[1.15] tracking-tight">
              Manage leave and get workplace support in one place.
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
              WorkHub makes time-off planning, team visibility, and help desk support feel simple, clear, and connected.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={isAuthenticated ? '/leave' : '/login'}
                className="px-5 py-2.5 bg-[#0e4a5c] hover:bg-[#083543] text-white text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-2"
              >
                Request leave
              </Link>
              <Link
                to={isAuthenticated ? '/helpdesk' : '/login'}
                className="px-5 py-2.5 bg-white border border-teal-200 text-[#0e4a5c] hover:bg-[#f0f9f8] text-sm font-semibold rounded-xl shadow-xs transition"
              >
                Get help
              </Link>
            </div>
          </div>

          {/* Interactive Workspace Card: Today at a glance */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-teal-50">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
                    Your Workspace
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
                <div className="bg-[#eef7f6] p-4 rounded-xl border border-teal-100/60">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Leave balance
                  </span>
                  <div className="text-2xl font-bold text-[#0e4a5c] mt-1">
                    12.5 days
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Available this year
                  </span>
                </div>

                <div className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Next leave request
                    </span>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${currentLeaveSample.color}`}>
                      {currentLeaveSample.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSampleIndex((prev) => prev + 1)}
                    className="mt-3 text-[10px] font-semibold text-[#0e4a5c] hover:underline text-left cursor-pointer"
                  >
                    Update sample &rarr;
                  </button>
                </div>
              </div>

              {/* Help Ticket Preview Row */}
              <div className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Help ticket · {currentTicketSample.id}
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-semibold border ${currentTicketSample.color}`}>
                      {currentTicketSample.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {currentTicketSample.desc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSampleIndex((prev) => prev + 1)}
                  className="px-2.5 py-1 bg-white border border-teal-200 text-[#0e4a5c] rounded text-[10px] font-semibold hover:bg-teal-50 transition whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  Update sample
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Everything in Context */}
        <section className="space-y-6 pt-6">
          <div className="space-y-1">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
              Everything in Context
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
              Less admin chasing. More confident workdays.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#0d2836]">
                Leave requests, made clear
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                See your balance, choose dates, and understand exactly where each request stands.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#0d2836]">
                Approvals and team calendars
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Give managers the context to approve quickly while teams plan around availability.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#0d2836]">
                Submit and track help tickets
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Send a request to the right support team and follow progress without extra follow-ups.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-200 transition space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#0d2836]">
                Knowledge and announcements
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Find reliable answers, policy guidance, and timely workplace updates in one home.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: How it Works */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-6">
          <div className="lg:col-span-5 space-y-2">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
              How it Works
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
              A calmer route from request to resolution.
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-sm pt-1">
              WorkHub removes ambiguity from the everyday moments that keep teams moving.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
              <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h4 className="font-bold text-sm text-[#0d2836]">
                Choose what you need
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Request time away or describe an issue in a few focused details.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
              <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h4 className="font-bold text-sm text-[#0d2836]">
                Stay in the loop
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Get clear status updates, ownership, and helpful next steps.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-teal-100 p-5 shadow-xs space-y-3">
              <div className="w-7 h-7 rounded-full bg-[#0e4a5c] text-white flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h4 className="font-bold text-sm text-[#0d2836]">
                Move forward
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Make plans with confidence and get back to meaningful work.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Built for People at Work */}
        <section className="bg-[#e4f3f0] rounded-2xl border border-teal-200/80 p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold tracking-wider uppercase text-teal-800 block">
              Built for People at Work
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
              One shared source of clarity for employees and support teams.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-2">
              <h3 className="font-bold text-sm text-[#0d2836]">
                For employees
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Spend less time wondering who to ask, what is pending, or where the latest guidance lives.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-2">
              <h3 className="font-bold text-sm text-[#0d2836]">
                For HR and support teams
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Create consistent service experiences with visibility, accountability, and fewer manual handoffs.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Dark Petrol Final CTA Banner */}
        <section className="bg-[#0f2e3d] rounded-2xl p-8 sm:p-12 text-center text-white space-y-5 shadow-sm">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-xl mx-auto leading-snug">
            Work feels better when the next step is obvious.
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Try the leave request demo and see how one connected workspace can bring more ease to everyday operations.
          </p>
          <div className="pt-2">
            <Link
              to={isAuthenticated ? '/leave' : '/login'}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0a2734] font-bold text-sm rounded-xl shadow-xs transition"
            >
              Try a leave request
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-teal-100 bg-white/70 py-6 text-center text-xs text-slate-500">
        WorkHub · A cleaner way to manage time and support.
      </footer>
    </div>
  );
};
