import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Users, 
  LifeBuoy, 
  ShieldCheck, 
  LayoutGrid, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  FileText,
  Layers,
  Inbox,
  UserCheck
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { hasRole } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16 selection:bg-teal-200 selection:text-teal-900">
      
      {/* Hero Section: System Landing & Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e3f4f1] text-[#0e4a5c] text-xs font-bold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0e4a5c]" />
            One Employee Workspace
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0d2836] leading-[1.18] tracking-tight">
            Manage leave and get workplace support in one place.
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
            A unified operations workspace where employee time-off planning, team visibility, and internal help desk support feel simple, clear, and connected.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/leave"
              className="px-5 py-2.5 bg-[#0e4a5c] hover:bg-[#083543] text-white text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4" /> Request leave
            </Link>
            <Link
              to="/helpdesk"
              className="px-5 py-2.5 bg-white border border-teal-200 text-[#0e4a5c] hover:bg-[#f0f9f8] text-sm font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
            >
              <LifeBuoy className="w-4 h-4" /> Get help
            </Link>
          </div>
        </div>

        {/* Illustrative Sample Showcase Card (No Personal User Data Exposed) */}
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

            {/* Sub-cards: Illustrative Workflow Samples */}
            <div className="grid grid-cols-2 gap-3">
              {/* Leave Balance Sample Card */}
              <div className="bg-[#eef7f6] p-4 rounded-xl border border-teal-100/60 block">
                <span className="text-[11px] text-slate-500 font-medium block">
                  Leave balance
                </span>
                <div className="text-2xl font-bold text-[#0e4a5c] mt-1">
                  12.5 days
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Available this year
                </span>
                <Link
                  to="/leave"
                  className="mt-2 text-[10px] font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1"
                >
                  Open leave portal &rarr;
                </Link>
              </div>

              {/* Next Leave Request Sample Card */}
              <div className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex flex-col justify-between block">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Next leave request
                  </span>
                  <div className="mt-1.5 space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      Awaiting approval
                    </span>
                    <div className="text-[11px] font-medium text-slate-700 truncate">
                      Annual Leave
                    </div>
                  </div>
                </div>
                <Link
                  to="/leave"
                  className="text-[10px] font-semibold text-[#0e4a5c] mt-2 block hover:underline"
                >
                  Track requests &rarr;
                </Link>
              </div>
            </div>

            {/* Help Ticket Preview Sample Row */}
            <div className="bg-[#f7fbfa] p-4 rounded-xl border border-teal-100/60 flex items-center justify-between gap-3 block">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Help ticket &bull; #1042
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    In progress
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">
                  IT equipment setup &amp; workspace configuration
                </p>
              </div>

              <Link
                to="/helpdesk"
                className="text-[10px] font-semibold text-[#0e4a5c] hover:underline whitespace-nowrap ml-2"
              >
                Open &rarr;
              </Link>
            </div>

            {/* System Info Notice */}
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-teal-50">
              <span>Interactive Platform Preview</span>
              <span className="text-teal-700 font-medium">Step-by-step navigation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: System Capabilities & Module Steps */}
      <section className="space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
            Everything in Context
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0d2836]">
            Less admin chasing. More confident workdays.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
            Each section of the system has dedicated tools designed to handle organization requests with complete transparency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Step 1: Leave Requests */}
          <Link 
            to="/leave"
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              Leave requests, made clear
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              See your quota balance, choose dates with automatic working day exclusion, and understand exactly where each application stands in the approval chain.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              Explore leave portal &rarr;
            </span>
          </Link>

          {/* Step 2: Approvals and Team Calendars */}
          <Link 
            to="/approvals"
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              Approvals and team calendars
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Give managers full team visibility to review applications quickly, avoid coverage gaps, and coordinate department availability smoothly.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              View manager approvals &rarr;
            </span>
          </Link>

          {/* Step 3: Help Desk */}
          <Link 
            to="/helpdesk"
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              Submit and track help tickets
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Send technical, hardware, facility, or HR inquiries directly to dedicated support queues and monitor response progress with clear SLA tracking.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              Open internal help desk &rarr;
            </span>
          </Link>

          {/* Step 4: Knowledge and Administration */}
          <Link 
            to={hasRole('HR_ADMIN') ? '/admin' : (hasRole('SUPPORT_AGENT') ? '/agent-queue' : '/leave')}
            className="bg-white rounded-2xl border border-teal-100 p-6 shadow-xs hover:border-teal-300 hover:shadow-sm transition space-y-3 group block"
          >
            <div className="w-9 h-9 rounded-xl bg-[#e3f4f1] text-[#0e4a5c] flex items-center justify-center group-hover:bg-[#0e4a5c] group-hover:text-white transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0d2836]">
              Knowledge and announcements
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Find reliable statutory policies, entitlement guidelines, organization standards, and timely workplace updates in one unified home.
            </p>
            <span className="text-xs font-semibold text-[#0e4a5c] inline-flex items-center gap-1 group-hover:underline pt-1">
              {hasRole('HR_ADMIN') ? 'Access admin center &rarr;' : 'Explore guidelines &rarr;'}
            </span>
          </Link>
        </div>
      </section>

      {/* Section 3: How it Works (3 Clear Operational Steps) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
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
              Request time away or describe an internal issue in a few focused, guided steps.
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
              Get clear status updates, assigned ownership, and helpful next steps without chasing.
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
              Make plans with confidence, receive swift resolution, and get back to meaningful work.
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
          <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-[#0d2836]">
                For employees
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Spend less time wondering who to ask, what is pending, or where the latest guidance lives. Self-service tools give you immediate answers.
              </p>
            </div>
            <Link
              to="/leave"
              className="text-xs font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1"
            >
              Access leave &amp; ticket tools &rarr;
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-teal-100/80 p-6 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-[#0d2836]">
                For HR and support teams
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Create consistent service experiences with visibility, accountability, audit logging, and fewer manual handoffs across the company.
              </p>
            </div>
            <Link
              to="/approvals"
              className="text-xs font-semibold text-[#0e4a5c] hover:underline inline-flex items-center gap-1"
            >
              Access manager queue &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Section 5: What Each Section Contains (System Navigation Guide) */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400 block">
            System Guide
          </span>
          <h2 className="text-base sm:text-lg font-bold text-[#0d2836]">
            What each step in the platform provides
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card A: Leave Section */}
          <div className="bg-white rounded-xl border border-teal-100 p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-[#0e4a5c]">
              <Calendar className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#0d2836]">
                Leave Portal
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Statutory leave balance quotas (Annual, Sick, Maternity, Paternity, Casual), date range validator, submission modal, and status tracking.
            </p>
            <Link to="/leave" className="text-xs text-[#0e4a5c] font-semibold hover:underline block pt-1">
              Go to Leave Portal &rarr;
            </Link>
          </div>

          {/* Card B: Help Desk Section */}
          <div className="bg-white rounded-xl border border-teal-100 p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-[#0e4a5c]">
              <LifeBuoy className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#0d2836]">
                Internal Help Desk
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Technical ticket submission, priority settings (Low, Medium, High, Urgent), automated category routing, and real-time resolution updates.
            </p>
            <Link to="/helpdesk" className="text-xs text-[#0e4a5c] font-semibold hover:underline block pt-1">
              Go to Help Desk &rarr;
            </Link>
          </div>

          {/* Card C: Manager Approvals */}
          <div className="bg-white rounded-xl border border-teal-100 p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-[#0e4a5c]">
              <UserCheck className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#0d2836]">
                Manager Approvals
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Department leave queue for line managers and HR admins to review, approve, or reject subordinate leave requests with notes.
            </p>
            <Link to="/approvals" className="text-xs text-[#0e4a5c] font-semibold hover:underline block pt-1">
              Go to Approvals &rarr;
            </Link>
          </div>

          {/* Card D: Support Agent Queue */}
          <div className="bg-white rounded-xl border border-teal-100 p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-[#0e4a5c]">
              <Inbox className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#0d2836]">
                Agent Queue
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Triage console for support agents to pick up unassigned tickets, investigate issues, update resolution status, and meet SLA timers.
            </p>
            <Link to="/agent-queue" className="text-xs text-[#0e4a5c] font-semibold hover:underline block pt-1">
              Go to Agent Queue &rarr;
            </Link>
          </div>

          {/* Card E: Administration */}
          <div className="bg-white rounded-xl border border-teal-100 p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-[#0e4a5c]">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#0d2836]">
                Admin Console
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Organization user management, employee verification and account approvals, department hierarchies, and system configuration.
            </p>
            <Link to="/admin" className="text-xs text-[#0e4a5c] font-semibold hover:underline block pt-1">
              Go to Admin Console &rarr;
            </Link>
          </div>

          {/* Card F: Policy & Compliance */}
          <div className="bg-white rounded-xl border border-teal-100 p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-[#0e4a5c]">
              <FileText className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#0d2836]">
                Statutory Compliance
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Employment Act 2007 standard policies, paid leave rules, SLA turnaround thresholds, and organizational transparency.
            </p>
            <Link to="/leave" className="text-xs text-[#0e4a5c] font-semibold hover:underline block pt-1">
              View Policy Terms &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Section 6: Dark Petrol Final CTA Banner */}
      <section className="bg-[#0f2e3d] rounded-2xl p-8 sm:p-12 text-center text-white space-y-4 shadow-sm">
        <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-xl mx-auto leading-snug">
          Work feels better when the next step is obvious.
        </h2>
        <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          Select any tool above to manage your leave requests, check team approvals, or get internal technical help desk assistance.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/leave"
            className="inline-flex items-center justify-center px-6 py-2.5 bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0a2734] font-bold text-sm rounded-xl shadow-xs transition cursor-pointer"
          >
            Request leave now
          </Link>
          <Link
            to="/helpdesk"
            className="inline-flex items-center justify-center px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl border border-white/20 transition cursor-pointer"
          >
            Submit a help ticket
          </Link>
        </div>
      </section>
    </div>
  );
};
