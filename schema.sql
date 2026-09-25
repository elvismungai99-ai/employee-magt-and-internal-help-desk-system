-- ==============================================================================
-- EMPLOYEE MANAGEMENT AND INTERNAL HELP DESK SYSTEM
-- Database: PostgreSQL 14+
-- Schema: public
-- ==============================================================================

-- Drop existing custom schemas if they exist (to migrate cleanly to public)
DROP SCHEMA IF EXISTS identity CASCADE;
DROP SCHEMA IF EXISTS leave CASCADE;
DROP SCHEMA IF EXISTS helpdesk CASCADE;

-- Optional: Drop existing public tables if re-running
DROP TABLE IF EXISTS public.sla_breach_logs CASCADE;
DROP TABLE IF EXISTS public.ticket_routing_history CASCADE;
DROP TABLE IF EXISTS public.ticket_attachments CASCADE;
DROP TABLE IF EXISTS public.ticket_comments CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.sla_policies CASCADE;
DROP TABLE IF EXISTS public.queue_members CASCADE;
DROP TABLE IF EXISTS public.support_queues CASCADE;
DROP TABLE IF EXISTS public.ticket_categories CASCADE;

DROP TABLE IF EXISTS public.out_of_office_records CASCADE;
DROP TABLE IF EXISTS public.leave_approvals CASCADE;
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TABLE IF EXISTS public.balance_transactions CASCADE;
DROP TABLE IF EXISTS public.leave_balances CASCADE;
DROP TABLE IF EXISTS public.leave_policies CASCADE;
DROP TABLE IF EXISTS public.leave_types CASCADE;

DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.reporting_hierarchy CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- ==============================================================================
-- 1. IDENTITY & RBAC (Shared Core)
-- ==============================================================================

-- Departments
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    manager_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users (Employees, Line Managers, HR Admins, Support Agents)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    job_title VARCHAR(100),
    phone VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Deferred FK for Department Manager
ALTER TABLE public.departments 
    ADD CONSTRAINT fk_departments_manager 
    FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Reporting Hierarchy (Line Manager Approval Chains)
CREATE TABLE public.reporting_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    relationship_type VARCHAR(20) NOT NULL DEFAULT 'DIRECT' CHECK (relationship_type IN ('DIRECT', 'DOTTED')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_no_self_reporting CHECK (employee_id <> manager_id)
);

-- Roles (RBAC)
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permissions
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permissions Junction
CREATE TABLE public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User-Roles Junction
CREATE TABLE public.user_roles (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- ==============================================================================
-- 2. LEAVE DOMAIN
-- ==============================================================================

-- Leave Types Catalog
CREATE TABLE public.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Policy Engine Rules
CREATE TABLE public.leave_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
    policy_name VARCHAR(150) NOT NULL,
    annual_allowance NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    monthly_accrual_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    max_carryover_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    carryover_expiry_months INT NOT NULL DEFAULT 3,
    effective_year INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Balance & Accrual Engine Balances
CREATE TABLE public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
    year INT NOT NULL,
    entitled_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    accrued_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    used_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    pending_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    carried_over_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_leave_year UNIQUE (user_id, leave_type_id, year)
);

-- Balance Ledger / Accrual Transactions
CREATE TABLE public.balance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_balance_id UUID NOT NULL REFERENCES public.leave_balances(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('SCHEDULED_ACCRUAL', 'MANUAL_ADJUSTMENT', 'DEDUCTION', 'REVERSAL', 'CARRYOVER_RESET')),
    amount_days NUMERIC(5,2) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Leave Requests (State Machine Entity)
CREATE TABLE public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(5,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED')),
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

-- Multi-stage Approval Workflow
CREATE TABLE public.leave_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    step_order INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    comments TEXT,
    actioned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OOO Sync Records (Event Pipeline -> Out of Office Sync)
CREATE TABLE public.out_of_office_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    sync_status VARCHAR(30) NOT NULL DEFAULT 'SYNCED' CHECK (sync_status IN ('PENDING', 'SYNCED', 'REVOKED', 'FAILED')),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. HELP DESK DOMAIN
-- ==============================================================================

-- Ticket Classification Categories
CREATE TABLE public.ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(30) NOT NULL UNIQUE,
    description TEXT,
    default_priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (default_priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Support Queues (Routing pools / Tier teams)
CREATE TABLE public.support_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    email_alias VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Queue Membership (Support Agents)
CREATE TABLE public.queue_members (
    queue_id UUID NOT NULL REFERENCES public.support_queues(id) ON DELETE CASCADE,
    agent_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, agent_user_id)
);

-- SLA Policies (SLA Monitoring Engine)
CREATE TABLE public.sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    first_response_target_minutes INT NOT NULL,
    resolution_target_minutes INT NOT NULL,
    escalation_rule_json JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tickets (Triage & Lifecycle)
CREATE TABLE public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    assigned_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    queue_id UUID REFERENCES public.support_queues(id) ON DELETE SET NULL,
    category_id UUID NOT NULL REFERENCES public.ticket_categories(id) ON DELETE RESTRICT,
    sla_policy_id UUID REFERENCES public.sla_policies(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'TRIAGED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED', 'REOPENED')),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    sla_due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Collaboration: Ticket Comments & Internal Notes
CREATE TABLE public.ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Collaboration: Attachments
CREATE TABLE public.ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
    uploaded_by_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Triage & OOO Re-routing History (Flow a in architecture)
CREATE TABLE public.ticket_routing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    previous_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    new_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('INITIAL_TRIAGE', 'MANUAL_REASSIGN', 'OOO_REROUTE', 'ESCALATION')),
    changed_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SLA Breach Logs & Escalations (Flow b in architecture)
CREATE TABLE public.sla_breach_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    sla_policy_id UUID REFERENCES public.sla_policies(id) ON DELETE RESTRICT,
    breach_type VARCHAR(50) NOT NULL CHECK (breach_type IN ('FIRST_RESPONSE', 'RESOLUTION')),
    breached_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    escalated_at TIMESTAMPTZ
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==============================================================================

-- Identity Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department_id);
CREATE INDEX IF NOT EXISTS idx_reporting_employee ON public.reporting_hierarchy(employee_id);
CREATE INDEX IF NOT EXISTS idx_reporting_manager ON public.reporting_hierarchy(manager_id);

-- Leave Indexes
CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON public.leave_balances(user_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_approvals_request ON public.leave_approvals(leave_request_id, approver_id);
CREATE INDEX IF NOT EXISTS idx_ooo_user_dates ON public.out_of_office_records(user_id, start_date, end_date);

-- Help Desk Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON public.tickets(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_agent ON public.tickets(assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_queue ON public.tickets(queue_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due ON public.tickets(sla_due_at) WHERE status NOT IN ('RESOLVED', 'CLOSED');
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_routing_history_ticket ON public.ticket_routing_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_breach_ticket ON public.sla_breach_logs(ticket_id);
