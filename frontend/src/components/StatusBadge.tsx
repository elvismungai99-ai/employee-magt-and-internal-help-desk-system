import React from 'react';
import { LeaveRequestStatus, TicketPriority, TicketStatus } from '../types';

interface StatusBadgeProps {
  status?: LeaveRequestStatus | TicketStatus | string;
  priority?: TicketPriority | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, priority, className = '' }) => {
  if (priority) {
    let colorClasses = 'bg-gray-100 text-gray-800 border-gray-200';
    switch (priority) {
      case 'LOW':
        colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'MEDIUM':
        colorClasses = 'bg-yellow-50 text-yellow-700 border-yellow-200';
        break;
      case 'HIGH':
        colorClasses = 'bg-orange-50 text-orange-700 border-orange-200';
        break;
      case 'URGENT':
        colorClasses = 'bg-red-50 text-red-700 border-red-200 font-semibold';
        break;
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses} ${className}`}>
        {priority}
      </span>
    );
  }

  if (status) {
    let colorClasses = 'bg-gray-100 text-gray-800 border-gray-200';
    switch (status) {
      // Leave statuses
      case 'APPROVED':
        colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'PENDING':
      case 'SUBMITTED':
        colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'REJECTED':
      case 'CANCELLED':
      case 'REVOKED':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'DRAFT':
        colorClasses = 'bg-slate-50 text-slate-700 border-slate-200';
        break;

      // Ticket statuses
      case 'NEW':
        colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
        break;
      case 'ASSIGNED':
      case 'TRIAGED':
        colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        break;
      case 'IN_PROGRESS':
        colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'PENDING_USER':
        colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'RESOLVED':
        colorClasses = 'bg-teal-50 text-teal-700 border-teal-200';
        break;
      case 'CLOSED':
        colorClasses = 'bg-zinc-100 text-zinc-700 border-zinc-300';
        break;
      case 'REOPENED':
        colorClasses = 'bg-orange-50 text-orange-700 border-orange-200';
        break;
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses} ${className}`}>
        {status.replace('_', ' ')}
      </span>
    );
  }

  return null;
};
