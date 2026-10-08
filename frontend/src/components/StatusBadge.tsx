import React from 'react';
import { LeaveRequestStatus, TicketPriority, TicketStatus } from '../types';

interface StatusBadgeProps {
  status?: LeaveRequestStatus | TicketStatus | string;
  priority?: TicketPriority | string;
  className?: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  priority,
  className = '',
  showDot = true,
}) => {
  if (priority) {
    let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    let dotColor = 'bg-slate-400';

    switch (priority) {
      case 'LOW':
        badgeClasses = 'bg-slate-50 text-slate-700 border-slate-200';
        dotColor = 'bg-slate-400';
        break;
      case 'MEDIUM':
        badgeClasses = 'bg-teal-50 text-[#0e4a5c] border-teal-200';
        dotColor = 'bg-teal-600';
        break;
      case 'HIGH':
        badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        dotColor = 'bg-amber-500';
        break;
      case 'URGENT':
        badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
        dotColor = 'bg-rose-600';
        break;
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClasses} ${className}`}
      >
        {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
        <span>{priority}</span>
      </span>
    );
  }

  if (status) {
    let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    let dotColor = 'bg-slate-400';
    let label = status.replace(/_/g, ' ');

    switch (status) {
      // Positive/Approved/Resolved
      case 'APPROVED':
      case 'RESOLVED':
        badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        dotColor = 'bg-emerald-600';
        break;

      // Pending/Waiting
      case 'PENDING':
      case 'SUBMITTED':
      case 'PENDING_APPROVAL':
        badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        dotColor = 'bg-amber-500';
        break;

      case 'PENDING_USER':
        badgeClasses = 'bg-sky-50 text-sky-800 border-sky-200 font-semibold';
        dotColor = 'bg-sky-600';
        label = 'Waiting on Requester';
        break;

      // In Progress / Active Triage
      case 'NEW':
        badgeClasses = 'bg-[#e3f4f1] text-[#0e4a5c] border-teal-200 font-bold';
        dotColor = 'bg-[#0e4a5c]';
        break;

      case 'ASSIGNED':
      case 'TRIAGED':
        badgeClasses = 'bg-[#f0f9f8] text-[#0e4a5c] border-teal-200';
        dotColor = 'bg-teal-600';
        break;

      case 'IN_PROGRESS':
        badgeClasses = 'bg-[#eef7f6] text-[#0e4a5c] border-teal-300 font-semibold';
        dotColor = 'bg-[#0e4a5c]';
        break;

      case 'REOPENED':
        badgeClasses = 'bg-orange-50 text-orange-800 border-orange-200 font-semibold';
        dotColor = 'bg-orange-500';
        break;

      // Negative/Rejected/Cancelled
      case 'REJECTED':
      case 'CANCELLED':
      case 'REVOKED':
        badgeClasses = 'bg-rose-50 text-rose-800 border-rose-200';
        dotColor = 'bg-rose-500';
        break;

      // Neutral/Draft/Closed
      case 'CLOSED':
      case 'DRAFT':
        badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
        dotColor = 'bg-slate-400';
        break;
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClasses} ${className}`}
      >
        {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
        <span className="capitalize">{label.toLowerCase()}</span>
      </span>
    );
  }

  return null;
};
