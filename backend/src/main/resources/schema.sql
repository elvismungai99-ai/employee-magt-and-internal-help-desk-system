--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4
--
-- Database Schema for Leave Management and Help Desk
--

--
-- Name: helpdesk; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS helpdesk;



--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS identity;



--
-- Name: leave; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS leave;



--
-- Name: platform; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS platform;





--
-- Name: queue_members; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.queue_members (
    queue_id uuid NOT NULL,
    agent_user_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by uuid
);



--
-- Name: sla_breach_logs; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.sla_breach_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sla_policy_id uuid,
    breach_type character varying(50) NOT NULL,
    breached_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notification_sent boolean DEFAULT false NOT NULL,
    escalated_at timestamp with time zone,
    CONSTRAINT sla_breach_logs_breach_type_check CHECK (((breach_type)::text = ANY ((ARRAY['FIRST_RESPONSE'::character varying, 'RESOLUTION'::character varying])::text[])))
);



--
-- Name: sla_policies; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.sla_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    priority character varying(20) NOT NULL,
    first_response_target_minutes integer NOT NULL,
    resolution_target_minutes integer NOT NULL,
    escalation_rule_json jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_response_before_resolution CHECK ((first_response_target_minutes < resolution_target_minutes)),
    CONSTRAINT sla_policies_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'URGENT'::character varying])::text[])))
);



--
-- Name: support_queues; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.support_queues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    email_alias character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: ticket_attachments; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    comment_id uuid,
    uploaded_by_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size_bytes bigint NOT NULL,
    mime_type character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: ticket_categories; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.ticket_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(30) NOT NULL,
    description text,
    default_priority character varying(20) DEFAULT 'MEDIUM'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ticket_categories_default_priority_check CHECK (((default_priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'URGENT'::character varying])::text[])))
);



--
-- Name: ticket_comments; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    is_internal_note boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: ticket_number_seq; Type: SEQUENCE; Schema: helpdesk; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS helpdesk.ticket_number_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: ticket_routing_history; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.ticket_routing_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    previous_agent_id uuid,
    new_agent_id uuid,
    reason character varying(50) NOT NULL,
    changed_by_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ticket_routing_history_reason_check CHECK (((reason)::text = ANY ((ARRAY['INITIAL_TRIAGE'::character varying, 'MANUAL_REASSIGN'::character varying, 'MANUAL'::character varying, 'OOO_REROUTE'::character varying, 'ESCALATION'::character varying])::text[])))
);



--
-- Name: tickets; Type: TABLE; Schema: helpdesk; Owner: postgres
--

CREATE TABLE IF NOT EXISTS helpdesk.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number character varying(50) NOT NULL,
    requester_id uuid NOT NULL,
    assigned_agent_id uuid,
    queue_id uuid,
    category_id uuid NOT NULL,
    sla_policy_id uuid,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(30) DEFAULT 'NEW'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'MEDIUM'::character varying NOT NULL,
    sla_due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    sla_breached boolean DEFAULT false NOT NULL,
    CONSTRAINT tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'URGENT'::character varying])::text[]))),
    CONSTRAINT tickets_status_check CHECK (((status)::text = ANY ((ARRAY['NEW'::character varying, 'ASSIGNED'::character varying, 'TRIAGED'::character varying, 'IN_PROGRESS'::character varying, 'PENDING_USER'::character varying, 'RESOLVED'::character varying, 'CLOSED'::character varying, 'REOPENED'::character varying])::text[])))
);



--
-- Name: departments; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    manager_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: permissions; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    permission_code character varying(100) NOT NULL,
    domain character varying(50) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: refresh_tokens; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: reporting_hierarchy; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.reporting_hierarchy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    manager_id uuid NOT NULL,
    relationship_type character varying(20) DEFAULT 'DIRECT'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by uuid,
    CONSTRAINT chk_no_self_reporting CHECK ((employee_id <> manager_id)),
    CONSTRAINT reporting_hierarchy_relationship_type_check CHECK (((relationship_type)::text = ANY ((ARRAY['DIRECT'::character varying, 'DOTTED_LINE'::character varying, 'DOTTED'::character varying])::text[])))
);



--
-- Name: role_permissions; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);



--
-- Name: roles; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    is_system_role boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: user_roles; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: users; Type: TABLE; Schema: identity; Owner: postgres
--

CREATE TABLE IF NOT EXISTS identity.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_code character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    department_id uuid,
    job_title character varying(100),
    phone character varying(50),
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying, 'PENDING_APPROVAL'::character varying, 'REJECTED'::character varying])::text[])))
);



--
-- Name: balance_transactions; Type: TABLE; Schema: leave; Owner: postgres
--

CREATE TABLE IF NOT EXISTS leave.balance_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_balance_id uuid NOT NULL,
    transaction_type character varying(30) NOT NULL,
    amount_days numeric(5,2) NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT balance_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['SCHEDULED_ACCRUAL'::character varying, 'MANUAL_ADJUSTMENT'::character varying, 'DEDUCTION'::character varying, 'REVERSAL'::character varying, 'CARRYOVER_RESET'::character varying])::text[])))
);



--
-- Name: leave_approvals; Type: TABLE; Schema: leave; Owner: postgres
--

CREATE TABLE IF NOT EXISTS leave.leave_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_request_id uuid NOT NULL,
    approver_id uuid NOT NULL,
    step_order integer DEFAULT 1 NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    comments text,
    actioned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT leave_approvals_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);



--
-- Name: leave_balances; Type: TABLE; Schema: leave; Owner: postgres
--

CREATE TABLE IF NOT EXISTS leave.leave_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    year integer NOT NULL,
    entitled_days numeric(5,2) DEFAULT 0.00 NOT NULL,
    accrued_days numeric(5,2) DEFAULT 0.00 NOT NULL,
    used_days numeric(5,2) DEFAULT 0.00 NOT NULL,
    pending_days numeric(5,2) DEFAULT 0.00 NOT NULL,
    carried_over_days numeric(5,2) DEFAULT 0.00 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_balance_integrity CHECK ((used_days <= (accrued_days + carried_over_days)))
);



--
-- Name: leave_policies; Type: TABLE; Schema: leave; Owner: postgres
--

CREATE TABLE IF NOT EXISTS leave.leave_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_type_id uuid NOT NULL,
    policy_name character varying(150) NOT NULL,
    annual_allowance numeric(5,2) DEFAULT 0.00 NOT NULL,
    monthly_accrual_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    max_carryover_days numeric(5,2) DEFAULT 0.00 NOT NULL,
    carryover_expiry_months integer DEFAULT 3 NOT NULL,
    effective_year integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: leave_requests; Type: TABLE; Schema: leave; Owner: postgres
--

CREATE TABLE IF NOT EXISTS leave.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(5,2) NOT NULL,
    reason text NOT NULL,
    status character varying(30) DEFAULT 'SUBMITTED'::character varying NOT NULL,
    attachment_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_leave_dates CHECK ((end_date >= start_date)),
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SUBMITTED'::character varying, 'PENDING_APPROVAL'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying, 'REVOKED'::character varying, 'DRAFT'::character varying])::text[])))
);



--
-- Name: leave_types; Type: TABLE; Schema: leave; Owner: postgres
--

CREATE TABLE IF NOT EXISTS leave.leave_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    is_paid boolean DEFAULT true NOT NULL,
    requires_attachment boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: out_of_office_records; Type: TABLE; Schema: leave; Owner: postgres
--

CREATE TABLE IF NOT EXISTS leave.out_of_office_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    sync_status character varying(30) DEFAULT 'SYNCED'::character varying NOT NULL,
    synced_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_event_id uuid,
    CONSTRAINT out_of_office_records_sync_status_check CHECK (((sync_status)::text = ANY ((ARRAY['PENDING'::character varying, 'SYNCED'::character varying, 'REVOKED'::character varying, 'FAILED'::character varying])::text[])))
);



--
-- Name: event_outbox; Type: TABLE; Schema: platform; Owner: postgres
--

CREATE TABLE IF NOT EXISTS platform.event_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(100) NOT NULL,
    source_domain character varying(20) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT event_outbox_source_domain_check CHECK (((source_domain)::text = ANY ((ARRAY['LEAVE'::character varying, 'HELPDESK'::character varying, 'IDENTITY'::character varying])::text[]))),
    CONSTRAINT event_outbox_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying, 'PUBLISHED'::character varying, 'FAILED'::character varying])::text[])))
);



--
-- Name: notifications; Type: TABLE; Schema: platform; Owner: postgres
--

CREATE TABLE IF NOT EXISTS platform.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    event_id uuid,
    channel character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    sent_at timestamp with time zone,
    message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT notifications_channel_check CHECK (((channel)::text = ANY ((ARRAY['EMAIL'::character varying, 'SLACK'::character varying])::text[]))),
    CONSTRAINT notifications_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SENT'::character varying, 'FAILED'::character varying])::text[])))
);



--
-- Name: queue_members queue_members_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.queue_members
    ADD CONSTRAINT queue_members_pkey PRIMARY KEY (queue_id, agent_user_id);


--
-- Name: sla_breach_logs sla_breach_logs_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.sla_breach_logs
    ADD CONSTRAINT sla_breach_logs_pkey PRIMARY KEY (id);


--
-- Name: sla_policies sla_policies_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);


--
-- Name: support_queues support_queues_name_key; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.support_queues
    ADD CONSTRAINT support_queues_name_key UNIQUE (name);


--
-- Name: support_queues support_queues_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.support_queues
    ADD CONSTRAINT support_queues_pkey PRIMARY KEY (id);


--
-- Name: ticket_attachments ticket_attachments_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_attachments
    ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: ticket_categories ticket_categories_code_key; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_categories
    ADD CONSTRAINT ticket_categories_code_key UNIQUE (code);


--
-- Name: ticket_categories ticket_categories_name_key; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_categories
    ADD CONSTRAINT ticket_categories_name_key UNIQUE (name);


--
-- Name: ticket_categories ticket_categories_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_categories
    ADD CONSTRAINT ticket_categories_pkey PRIMARY KEY (id);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: ticket_routing_history ticket_routing_history_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_routing_history
    ADD CONSTRAINT ticket_routing_history_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_number_key; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.tickets
    ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: sla_policies uq_sla_policies_name; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.sla_policies
    ADD CONSTRAINT uq_sla_policies_name UNIQUE (name);


--
-- Name: sla_policies uq_sla_policies_priority; Type: CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.sla_policies
    ADD CONSTRAINT uq_sla_policies_priority UNIQUE (priority);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_permission_code_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.permissions
    ADD CONSTRAINT permissions_permission_code_key UNIQUE (permission_code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: reporting_hierarchy reporting_hierarchy_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.reporting_hierarchy
    ADD CONSTRAINT reporting_hierarchy_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_employee_code_key; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_employee_code_key UNIQUE (employee_code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: balance_transactions balance_transactions_pkey; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.balance_transactions
    ADD CONSTRAINT balance_transactions_pkey PRIMARY KEY (id);


--
-- Name: leave_approvals leave_approvals_pkey; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_approvals
    ADD CONSTRAINT leave_approvals_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_policies leave_policies_pkey; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_policies
    ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_name_key; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_types
    ADD CONSTRAINT leave_types_name_key UNIQUE (name);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: out_of_office_records out_of_office_records_pkey; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.out_of_office_records
    ADD CONSTRAINT out_of_office_records_pkey PRIMARY KEY (id);


--
-- Name: out_of_office_records out_of_office_records_source_event_id_key; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.out_of_office_records
    ADD CONSTRAINT out_of_office_records_source_event_id_key UNIQUE (source_event_id);


--
-- Name: leave_balances uq_user_leave_year; Type: CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_balances
    ADD CONSTRAINT uq_user_leave_year UNIQUE (user_id, leave_type_id, year);


--
-- Name: event_outbox event_outbox_pkey; Type: CONSTRAINT; Schema: platform; Owner: postgres
--

ALTER TABLE ONLY platform.event_outbox
    ADD CONSTRAINT event_outbox_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: platform; Owner: postgres
--

ALTER TABLE ONLY platform.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: idx_comments_ticket; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_comments_ticket ON helpdesk.ticket_comments USING btree (ticket_id);


--
-- Name: idx_routing_history_ticket; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_routing_history_ticket ON helpdesk.ticket_routing_history USING btree (ticket_id);


--
-- Name: idx_sla_breach_ticket; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_sla_breach_ticket ON helpdesk.sla_breach_logs USING btree (ticket_id);


--
-- Name: idx_tickets_agent; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_tickets_agent ON helpdesk.tickets USING btree (assigned_agent_id, status);


--
-- Name: idx_tickets_queue; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_tickets_queue ON helpdesk.tickets USING btree (queue_id, status);


--
-- Name: idx_tickets_requester; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_tickets_requester ON helpdesk.tickets USING btree (requester_id, status);


--
-- Name: idx_tickets_sla_breached; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_tickets_sla_breached ON helpdesk.tickets USING btree (sla_due_at) WHERE (((status)::text <> ALL ((ARRAY['RESOLVED'::character varying, 'CLOSED'::character varying])::text[])) AND (sla_breached = false));


--
-- Name: idx_tickets_sla_due; Type: INDEX; Schema: helpdesk; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_tickets_sla_due ON helpdesk.tickets USING btree (sla_due_at) WHERE ((status)::text <> ALL ((ARRAY['RESOLVED'::character varying, 'CLOSED'::character varying])::text[]));


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON identity.refresh_tokens USING btree (user_id);


--
-- Name: idx_reporting_employee; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_reporting_employee ON identity.reporting_hierarchy USING btree (employee_id);


--
-- Name: idx_reporting_manager; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_reporting_manager ON identity.reporting_hierarchy USING btree (manager_id);


--
-- Name: idx_users_department; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_users_department ON identity.users USING btree (department_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_users_email ON identity.users USING btree (email);


--
-- Name: uq_one_active_direct_manager; Type: INDEX; Schema: identity; Owner: postgres
--

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_direct_manager ON identity.reporting_hierarchy USING btree (employee_id) WHERE (((relationship_type)::text = 'DIRECT'::text) AND (is_active = true));


--
-- Name: idx_leave_approvals_request; Type: INDEX; Schema: leave; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_leave_approvals_request ON leave.leave_approvals USING btree (leave_request_id, approver_id);


--
-- Name: idx_leave_balances_user; Type: INDEX; Schema: leave; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON leave.leave_balances USING btree (user_id, year);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: leave; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_user; Type: INDEX; Schema: leave; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave.leave_requests USING btree (user_id, status);


--
-- Name: idx_ooo_user_dates; Type: INDEX; Schema: leave; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_ooo_user_dates ON leave.out_of_office_records USING btree (user_id, start_date, end_date);


--
-- Name: idx_notifications_event; Type: INDEX; Schema: platform; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_notifications_event ON platform.notifications USING btree (event_id);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: platform; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON platform.notifications USING btree (recipient_id);


--
-- Name: idx_outbox_pending; Type: INDEX; Schema: platform; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON platform.event_outbox USING btree (created_at) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: queue_members queue_members_agent_user_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.queue_members
    ADD CONSTRAINT queue_members_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: queue_members queue_members_assigned_by_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.queue_members
    ADD CONSTRAINT queue_members_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES identity.users(id);


--
-- Name: queue_members queue_members_queue_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.queue_members
    ADD CONSTRAINT queue_members_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES helpdesk.support_queues(id) ON DELETE CASCADE;


--
-- Name: sla_breach_logs sla_breach_logs_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.sla_breach_logs
    ADD CONSTRAINT sla_breach_logs_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES helpdesk.sla_policies(id) ON DELETE RESTRICT;


--
-- Name: sla_breach_logs sla_breach_logs_ticket_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.sla_breach_logs
    ADD CONSTRAINT sla_breach_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES helpdesk.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_comment_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_attachments
    ADD CONSTRAINT ticket_attachments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES helpdesk.ticket_comments(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_attachments
    ADD CONSTRAINT ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES helpdesk.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_attachments
    ADD CONSTRAINT ticket_attachments_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES identity.users(id) ON DELETE RESTRICT;


--
-- Name: ticket_comments ticket_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_comments
    ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES identity.users(id) ON DELETE RESTRICT;


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES helpdesk.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_routing_history ticket_routing_history_changed_by_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_routing_history
    ADD CONSTRAINT ticket_routing_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES identity.users(id) ON DELETE SET NULL;


--
-- Name: ticket_routing_history ticket_routing_history_new_agent_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_routing_history
    ADD CONSTRAINT ticket_routing_history_new_agent_id_fkey FOREIGN KEY (new_agent_id) REFERENCES identity.users(id) ON DELETE SET NULL;


--
-- Name: ticket_routing_history ticket_routing_history_previous_agent_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_routing_history
    ADD CONSTRAINT ticket_routing_history_previous_agent_id_fkey FOREIGN KEY (previous_agent_id) REFERENCES identity.users(id) ON DELETE SET NULL;


--
-- Name: ticket_routing_history ticket_routing_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.ticket_routing_history
    ADD CONSTRAINT ticket_routing_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES helpdesk.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_assigned_agent_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.tickets
    ADD CONSTRAINT tickets_assigned_agent_id_fkey FOREIGN KEY (assigned_agent_id) REFERENCES identity.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_category_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.tickets
    ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES helpdesk.ticket_categories(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_queue_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.tickets
    ADD CONSTRAINT tickets_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES helpdesk.support_queues(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_requester_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.tickets
    ADD CONSTRAINT tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES identity.users(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: helpdesk; Owner: postgres
--

ALTER TABLE ONLY helpdesk.tickets
    ADD CONSTRAINT tickets_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES helpdesk.sla_policies(id) ON DELETE SET NULL;


--
-- Name: departments fk_departments_manager; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.departments
    ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES identity.users(id) ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: reporting_hierarchy reporting_hierarchy_assigned_by_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.reporting_hierarchy
    ADD CONSTRAINT reporting_hierarchy_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES identity.users(id);


--
-- Name: reporting_hierarchy reporting_hierarchy_employee_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.reporting_hierarchy
    ADD CONSTRAINT reporting_hierarchy_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: reporting_hierarchy reporting_hierarchy_manager_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.reporting_hierarchy
    ADD CONSTRAINT reporting_hierarchy_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES identity.users(id) ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES identity.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES identity.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES identity.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: postgres
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES identity.departments(id) ON DELETE SET NULL;


--
-- Name: balance_transactions balance_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.balance_transactions
    ADD CONSTRAINT balance_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES identity.users(id) ON DELETE SET NULL;


--
-- Name: balance_transactions balance_transactions_leave_balance_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.balance_transactions
    ADD CONSTRAINT balance_transactions_leave_balance_id_fkey FOREIGN KEY (leave_balance_id) REFERENCES leave.leave_balances(id) ON DELETE CASCADE;


--
-- Name: leave_approvals leave_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_approvals
    ADD CONSTRAINT leave_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES identity.users(id) ON DELETE RESTRICT;


--
-- Name: leave_approvals leave_approvals_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_approvals
    ADD CONSTRAINT leave_approvals_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES leave.leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_balances leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_balances
    ADD CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave.leave_types(id) ON DELETE RESTRICT;


--
-- Name: leave_balances leave_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_balances
    ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: leave_policies leave_policies_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_policies
    ADD CONSTRAINT leave_policies_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave.leave_types(id) ON DELETE RESTRICT;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave.leave_types(id) ON DELETE RESTRICT;


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: out_of_office_records out_of_office_records_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.out_of_office_records
    ADD CONSTRAINT out_of_office_records_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES leave.leave_requests(id) ON DELETE CASCADE;


--
-- Name: out_of_office_records out_of_office_records_user_id_fkey; Type: FK CONSTRAINT; Schema: leave; Owner: postgres
--

ALTER TABLE ONLY leave.out_of_office_records
    ADD CONSTRAINT out_of_office_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: platform; Owner: postgres
--

ALTER TABLE ONLY platform.notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES platform.event_outbox(id);


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: platform; Owner: postgres
--

ALTER TABLE ONLY platform.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES identity.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 9xgHWlg52qn2Q8gNR9gGb4r9uZNZTS2mbWQfYydl8MfBAvfF7BTm120CwBmGVNe


