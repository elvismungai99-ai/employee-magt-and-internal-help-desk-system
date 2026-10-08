// User and Identity types
export type UserRole = 'EMPLOYEE' | 'LINE_MANAGER' | 'SUPPORT_AGENT' | 'HR_ADMIN';

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  active?: boolean;
}

export interface ManagerSummary {
  id: string;
  fullName: string;
  email: string;
  relationshipType?: string;
  effectiveFrom?: string;
}

export interface UserProfile {
  id: string;
  employeeCode: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle?: string;
  phone?: string;
  status: string;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  roles: string[];
  permissions?: string[];
  manager?: ManagerSummary;
}

export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    code?: string;
    details?: string;
  };
  timestamp?: string;
}

// Leave Domain Types
export type LeaveRequestStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVOKED';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description?: string;
  defaultDaysPerYear: number;
  requiresApproval: boolean;
  isCarryForwardAllowed: boolean;
  maxCarryForwardDays: number;
  active: boolean;
}

export interface LeaveBalance {
  id: string;
  userId: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  entitledDays: number;
  accruedDays: number;
  usedDays: number;
  pendingDays: number;
  carriedOverDays: number;
  availableDays: number;
  updatedAt?: string;
}

export interface LeaveApproval {
  id: string;
  approverId: string;
  approverName?: string;
  approverEmail?: string;
  level: number;
  status: string;
  comments?: string;
  decidedAt?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  employeeName?: string;
  employeeEmail?: string;
  leaveTypeId: string;
  leaveTypeCode?: string;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveRequestStatus;
  attachmentUrl?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: 'MORNING' | 'AFTERNOON';
  delegateId?: string;
  delegateName?: string;
  approvals?: LeaveApproval[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SubmitLeaveRequestDto {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: 'MORNING' | 'AFTERNOON';
  delegateId?: string;
}

// Help Desk Domain Types
export type TicketStatus = 
  | 'NEW'
  | 'ASSIGNED'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'PENDING_USER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  defaultPriority: TicketPriority;
  active: boolean;
}

export interface SupportQueue {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  isInternal?: boolean;
  isInternalNote?: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  assigneeId?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAgentEmail?: string;
  categoryId: string;
  categoryName?: string;
  categoryCode?: string;
  queueId?: string;
  queueName?: string;
  slaPolicyId?: string;
  slaDueAt?: string;
  leaveRequestId?: string;
  leaveRequestSummary?: string;
  pausedAt?: string;
  totalPausedMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  comments?: TicketComment[];
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  commentId?: string;
  uploadedById: string;
  uploadedByName?: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType?: string;
  createdAt: string;
}

export interface CreateTicketDto {
  categoryId: string;
  queueId?: string;
  leaveRequestId?: string;
  title: string;
  description: string;
  priority?: TicketPriority;
}

export interface AddCommentDto {
  content: string;
  isInternalNote: boolean;
}

export interface ResolveTicketDto {
  resolutionNotes?: string;
}

export interface CloseTicketDto {
  feedback?: string;
}

// Admin / Platform Types
export interface AccrualRunResult {
  year: number;
  month: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  runAt: string;
  triggeredBy: string;
  completedAt?: string;
  status?: string;
}

export interface SlaMonitorRunResult {
  runAt: string;
  ticketsChecked: number;
  breachesDetected: number;
  breachesFlagged: number;
  completedAt?: string;
  status?: string;
}

export interface EventOutboxItem {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  retryCount: number;
  createdAt: string;
  processedAt?: string;
  lastError?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
