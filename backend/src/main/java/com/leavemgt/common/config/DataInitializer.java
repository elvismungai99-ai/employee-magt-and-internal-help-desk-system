package com.leavemgt.common.config;

import com.leavemgt.helpdesk.entity.CannedResponse;
import com.leavemgt.helpdesk.entity.KnowledgeBaseArticle;
import com.leavemgt.helpdesk.entity.SlaPolicy;
import com.leavemgt.helpdesk.entity.SupportQueue;
import com.leavemgt.helpdesk.entity.TicketCategory;
import com.leavemgt.helpdesk.entity.TicketPriority;
import com.leavemgt.helpdesk.repository.CannedResponseRepository;
import com.leavemgt.helpdesk.repository.KnowledgeBaseArticleRepository;
import com.leavemgt.helpdesk.repository.SlaPolicyRepository;
import com.leavemgt.helpdesk.repository.SupportQueueRepository;
import com.leavemgt.helpdesk.repository.TicketCategoryRepository;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.Permission;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.PermissionRepository;
import com.leavemgt.identity.repository.RoleRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.entity.LeavePolicy;
import com.leavemgt.leave.entity.LeaveType;
import com.leavemgt.leave.repository.LeavePolicyRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import com.leavemgt.leave.service.LeaveBalanceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Year;
import java.util.*;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final LeaveTypeRepository leaveTypeRepository;
    private final LeavePolicyRepository leavePolicyRepository;
    private final LeaveBalanceService leaveBalanceService;
    private final TicketCategoryRepository ticketCategoryRepository;
    private final SupportQueueRepository supportQueueRepository;
    private final SlaPolicyRepository slaPolicyRepository;
    private final KnowledgeBaseArticleRepository knowledgeBaseArticleRepository;
    private final CannedResponseRepository cannedResponseRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @org.springframework.beans.factory.annotation.Value("${app.seed-admin-user:false}")
    private boolean seedAdminUser;

    @org.springframework.beans.factory.annotation.Value("${app.admin.email:}")
    private String adminEmail;

    @org.springframework.beans.factory.annotation.Value("${app.admin.password:}")
    private String adminPassword;

    @org.springframework.beans.factory.annotation.Value("${app.admin.employee-code:EMP-00001}")
    private String adminEmployeeCode;

    @org.springframework.beans.factory.annotation.Value("${app.admin.first-name:System}")
    private String adminFirstName;

    @org.springframework.beans.factory.annotation.Value("${app.admin.last-name:Admin}")
    private String adminLastName;

    @org.springframework.beans.factory.annotation.Value("${app.admin.job-title:HR Administrator}")
    private String adminJobTitle;

    @org.springframework.beans.factory.annotation.Value("${app.admin.phone:}")
    private String adminPhone;

    public DataInitializer(RoleRepository roleRepository,
                           PermissionRepository permissionRepository,
                           DepartmentRepository departmentRepository,
                           UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           LeaveTypeRepository leaveTypeRepository,
                           LeavePolicyRepository leavePolicyRepository,
                           LeaveBalanceService leaveBalanceService,
                           TicketCategoryRepository ticketCategoryRepository,
                           SupportQueueRepository supportQueueRepository,
                           SlaPolicyRepository slaPolicyRepository,
                           KnowledgeBaseArticleRepository knowledgeBaseArticleRepository,
                           CannedResponseRepository cannedResponseRepository,
                           org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.leaveTypeRepository = leaveTypeRepository;
        this.leavePolicyRepository = leavePolicyRepository;
        this.leaveBalanceService = leaveBalanceService;
        this.ticketCategoryRepository = ticketCategoryRepository;
        this.supportQueueRepository = supportQueueRepository;
        this.slaPolicyRepository = slaPolicyRepository;
        this.knowledgeBaseArticleRepository = knowledgeBaseArticleRepository;
        this.cannedResponseRepository = cannedResponseRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        log.info("Starting seed data initialization...");

        // 0. Dynamic schema patches (ensures missing entity columns exist in DB across environments)
        applySchemaPatches();

        // 1. Seed Permissions
        Map<String, Permission> permissions = initPermissions();

        // 2. Seed Roles with associated Permissions
        Map<String, Role> roles = initRoles(permissions);

        // 3. Seed Departments
        Map<String, Department> departments = initDepartments();

        // 4. Seed Default HR Admin (Only if explicitly enabled via app.seed-admin-user; disabled by default)
        if (seedAdminUser) {
            User adminUser = initAdminUser(roles.get("HR_ADMIN"), departments.get("HR"));
            if (adminUser != null) {
                leaveBalanceService.initializeBalancesForUser(adminUser, Year.now().getValue());
            }
        }

        // 5. Seed Kenyan Statutory Leave Types & Policies
        initLeaveTypesAndPolicies();

        // 6. Seed Help Desk Taxonomy (Queues, Categories, SLA Policies)
        initHelpdeskTaxonomy();

        // 7. Seed Knowledge Base Articles & Canned Responses
        initKnowledgeBaseAndCannedResponses();

        log.info("Seed data initialization completed successfully.");
    }

    private void applySchemaPatches() {
        String[] schemas = {
                "CREATE SCHEMA IF NOT EXISTS leave",
                "CREATE SCHEMA IF NOT EXISTS identity",
                "CREATE SCHEMA IF NOT EXISTS helpdesk",
                "CREATE SCHEMA IF NOT EXISTS platform"
        };

        for (String sql : schemas) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception e) {
                log.debug("Schema creation skipped: {}", e.getMessage());
            }
        }

        // Schema patches for leave domain
        String[] leavePatches = {
                "ALTER TABLE leave.leave_requests ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE",
                "UPDATE leave.leave_requests SET is_half_day = FALSE WHERE is_half_day IS NULL",
                "ALTER TABLE leave.leave_requests ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(20)",
                "ALTER TABLE leave.leave_requests ADD COLUMN IF NOT EXISTS delegate_id UUID",
                "CREATE TABLE IF NOT EXISTS leave.out_of_office_records (" +
                        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), " +
                        "leave_request_id UUID NOT NULL, " +
                        "user_id UUID NOT NULL, " +
                        "delegate_id UUID, " +
                        "start_date DATE NOT NULL, " +
                        "end_date DATE NOT NULL, " +
                        "sync_status VARCHAR(30) NOT NULL DEFAULT 'SYNCED', " +
                        "synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                        "source_event_id UUID UNIQUE)",
                "ALTER TABLE leave.out_of_office_records ADD COLUMN IF NOT EXISTS delegate_id UUID"
        };

        for (String sql : leavePatches) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception e) {
                log.debug("Leave schema patch skipped: {}", e.getMessage());
            }
        }

        // Ensure balance_transactions check constraint permits all TransactionType values (including ENCASHMENT and COMP_OFF_CREDIT)
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE leave.balance_transactions DROP CONSTRAINT IF EXISTS balance_transactions_transaction_type_check; " +
                    "ALTER TABLE leave.balance_transactions ADD CONSTRAINT balance_transactions_transaction_type_check " +
                    "CHECK (transaction_type IN ('SCHEDULED_ACCRUAL', 'MANUAL_ADJUSTMENT', 'DEDUCTION', 'REVERSAL', 'CARRYOVER_RESET', 'COMP_OFF_CREDIT', 'ENCASHMENT'))"
            );
        } catch (Exception e) {
            log.debug("Leave balance_transactions constraint patch skipped: {}", e.getMessage());
        }

        // Safe check for public schema tables if ever present
        try {
            Integer hasPublicLeave = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests'",
                    Integer.class
            );
            if (hasPublicLeave != null && hasPublicLeave > 0) {
                jdbcTemplate.execute("ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE");
                jdbcTemplate.execute("UPDATE public.leave_requests SET is_half_day = FALSE WHERE is_half_day IS NULL");
                jdbcTemplate.execute("ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(20)");
                jdbcTemplate.execute("ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS delegate_id UUID");
            }
        } catch (Exception e) {
            log.debug("Public leave_requests patch skipped: {}", e.getMessage());
        }

        try {
            Integer hasPublicOoo = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'out_of_office_records'",
                    Integer.class
            );
            if (hasPublicOoo != null && hasPublicOoo > 0) {
                jdbcTemplate.execute("ALTER TABLE public.out_of_office_records ADD COLUMN IF NOT EXISTS delegate_id UUID");
            }
        } catch (Exception e) {
            log.debug("Public out_of_office_records patch skipped: {}", e.getMessage());
        }

        try {
            Integer hasPublicBt = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'balance_transactions'",
                    Integer.class
            );
            if (hasPublicBt != null && hasPublicBt > 0) {
                jdbcTemplate.execute(
                        "ALTER TABLE public.balance_transactions DROP CONSTRAINT IF EXISTS balance_transactions_transaction_type_check; " +
                        "ALTER TABLE public.balance_transactions ADD CONSTRAINT balance_transactions_transaction_type_check " +
                        "CHECK (transaction_type IN ('SCHEDULED_ACCRUAL', 'MANUAL_ADJUSTMENT', 'DEDUCTION', 'REVERSAL', 'CARRYOVER_RESET', 'COMP_OFF_CREDIT', 'ENCASHMENT'))"
                );
            }
        } catch (Exception e) {
            log.debug("Public balance_transactions patch skipped: {}", e.getMessage());
        }

        // Ensure notifications channel check constraint permits WEBHOOK
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE platform.notifications DROP CONSTRAINT IF EXISTS notifications_channel_check; " +
                    "ALTER TABLE platform.notifications ADD CONSTRAINT notifications_channel_check " +
                    "CHECK (channel IN ('EMAIL', 'SLACK', 'WEBHOOK'))"
            );
        } catch (Exception e) {
            log.debug("Platform notifications constraint patch skipped: {}", e.getMessage());
        }

        // Schema patches for Knowledge Base, Canned Responses, CSAT, Document Upload, and Audit Logs
        String[] enterprisePatches = {
                "CREATE TABLE IF NOT EXISTS helpdesk.knowledge_base_articles (" +
                        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), " +
                        "title VARCHAR(255) NOT NULL, " +
                        "slug VARCHAR(255) NOT NULL, " +
                        "content TEXT NOT NULL, " +
                        "category_id UUID, " +
                        "tags VARCHAR(255), " +
                        "is_published BOOLEAN DEFAULT true NOT NULL, " +
                        "view_count INTEGER DEFAULT 0 NOT NULL, " +
                        "helpful_count INTEGER DEFAULT 0 NOT NULL, " +
                        "created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, " +
                        "updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL)",
                "CREATE TABLE IF NOT EXISTS helpdesk.canned_responses (" +
                        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), " +
                        "title VARCHAR(100) NOT NULL, " +
                        "shortcut VARCHAR(50) NOT NULL, " +
                        "content TEXT NOT NULL, " +
                        "category_id UUID, " +
                        "created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL)",
                "ALTER TABLE helpdesk.tickets ADD COLUMN IF NOT EXISTS csat_rating INTEGER",
                "ALTER TABLE helpdesk.tickets ADD COLUMN IF NOT EXISTS csat_feedback VARCHAR(1000)",
                "ALTER TABLE helpdesk.tickets ADD COLUMN IF NOT EXISTS csat_submitted_at TIMESTAMPTZ",
                "ALTER TABLE leave.leave_requests ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
                "ALTER TABLE leave.leave_requests ADD COLUMN IF NOT EXISTS document_name VARCHAR(255)",
                "CREATE TABLE IF NOT EXISTS platform.audit_logs (" +
                        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), " +
                        "timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, " +
                        "actor_id UUID, " +
                        "actor_email VARCHAR(255), " +
                        "action VARCHAR(100) NOT NULL, " +
                        "entity_type VARCHAR(100) NOT NULL, " +
                        "entity_id VARCHAR(100), " +
                        "details TEXT, " +
                        "ip_address VARCHAR(50))"
        };

        for (String sql : enterprisePatches) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception e) {
                log.debug("Enterprise schema patch skipped: {}", e.getMessage());
            }
        }
    }

    private Map<String, Permission> initPermissions() {
        List<PermissionDefinition> defs = List.of(
                new PermissionDefinition("LEAVE_APPLY", "LEAVE", "Apply for leave requests"),
                new PermissionDefinition("LEAVE_VIEW_OWN", "LEAVE", "View own leave requests and balances"),
                new PermissionDefinition("LEAVE_APPROVE", "LEAVE", "Approve or reject subordinate leave requests"),
                new PermissionDefinition("LEAVE_ADMIN", "LEAVE", "Full leave management and policy administration"),
                new PermissionDefinition("TICKET_CREATE", "TICKET", "Create support tickets"),
                new PermissionDefinition("TICKET_VIEW_OWN", "TICKET", "View own submitted tickets"),
                new PermissionDefinition("TICKET_ASSIGN", "TICKET", "Assign support tickets to agents"),
                new PermissionDefinition("TICKET_RESOLVE", "TICKET", "Resolve and manage support tickets"),
                new PermissionDefinition("USER_MANAGE", "IDENTITY", "Create and manage system user accounts"),
                new PermissionDefinition("DEPARTMENT_MANAGE", "IDENTITY", "Manage company departments and structure")
        );

        Map<String, Permission> map = new HashMap<>();
        for (PermissionDefinition def : defs) {
            Permission perm = permissionRepository.findByPermissionCode(def.code())
                    .orElseGet(() -> permissionRepository.save(Permission.builder()
                            .permissionCode(def.code())
                            .domain(def.domain())
                            .description(def.description())
                            .build()));
            map.put(def.code(), perm);
        }
        return map;
    }

    private Map<String, Role> initRoles(Map<String, Permission> perms) {
        Map<String, Role> map = new HashMap<>();

        // EMPLOYEE
        map.put("EMPLOYEE", getOrCreateRole("EMPLOYEE", "Standard employee role", true, Set.of(
                perms.get("LEAVE_APPLY"),
                perms.get("LEAVE_VIEW_OWN"),
                perms.get("TICKET_CREATE"),
                perms.get("TICKET_VIEW_OWN")
        )));

        // LINE_MANAGER
        map.put("LINE_MANAGER", getOrCreateRole("LINE_MANAGER", "Department and line manager role", true, Set.of(
                perms.get("LEAVE_APPLY"),
                perms.get("LEAVE_VIEW_OWN"),
                perms.get("LEAVE_APPROVE"),
                perms.get("TICKET_CREATE"),
                perms.get("TICKET_VIEW_OWN")
        )));

        // SUPPORT_AGENT
        map.put("SUPPORT_AGENT", getOrCreateRole("SUPPORT_AGENT", "Internal IT / HR support agent", true, Set.of(
                perms.get("LEAVE_APPLY"),
                perms.get("LEAVE_VIEW_OWN"),
                perms.get("TICKET_CREATE"),
                perms.get("TICKET_VIEW_OWN"),
                perms.get("TICKET_ASSIGN"),
                perms.get("TICKET_RESOLVE")
        )));

        // HR_ADMIN
        map.put("HR_ADMIN", getOrCreateRole("HR_ADMIN", "HR and system administrator with full access", true,
                new HashSet<>(perms.values())
        ));

        return map;
    }

    private Role getOrCreateRole(String roleName, String description, boolean isSystem, Set<Permission> permissions) {
        return roleRepository.findByName(roleName).map(existing -> {
            if (existing.getPermissions() == null || existing.getPermissions().isEmpty()) {
                existing.setPermissions(new HashSet<>(permissions));
                return roleRepository.save(existing);
            }
            return existing;
        }).orElseGet(() -> {
            Role role = Role.builder()
                    .name(roleName)
                    .description(description)
                    .isSystemRole(isSystem)
                    .permissions(new HashSet<>(permissions))
                    .build();
            return roleRepository.save(role);
        });
    }

    private Map<String, Department> initDepartments() {
        Map<String, Department> map = new HashMap<>();

        Department hr = departmentRepository.findByCode("HR").orElseGet(() ->
                departmentRepository.save(Department.builder()
                        .name("Human Resources")
                        .code("HR")
                        .build())
        );
        map.put("HR", hr);

        Department it = departmentRepository.findByCode("IT").orElseGet(() ->
                departmentRepository.save(Department.builder()
                        .name("Information Technology")
                        .code("IT")
                        .build())
        );
        map.put("IT", it);

        Department fin = departmentRepository.findByCode("FIN").orElseGet(() ->
                departmentRepository.save(Department.builder()
                        .name("Finance & Accounting")
                        .code("FIN")
                        .build())
        );
        map.put("FIN", fin);

        Department exec = departmentRepository.findByCode("EXEC").orElseGet(() ->
                departmentRepository.save(Department.builder()
                        .name("Executive Management")
                        .code("EXEC")
                        .build())
        );
        map.put("EXEC", exec);

        return map;
    }

    private User initAdminUser(Role adminRole, Department hrDept) {
        if (adminEmail == null || adminEmail.isBlank() || adminPassword == null || adminPassword.isBlank()) {
            log.info("Admin seeding requested via configuration, but email or password is not provided. Skipping admin account creation.");
            return null;
        }

        Optional<User> existing = userRepository.findByEmail(adminEmail);
        if (existing.isPresent()) {
            return existing.get();
        }

        User admin = User.builder()
                .employeeCode(adminEmployeeCode)
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .firstName(adminFirstName)
                .lastName(adminLastName)
                .jobTitle(adminJobTitle)
                .phone(adminPhone)
                .department(hrDept)
                .status("ACTIVE")
                .roles(new HashSet<>(Collections.singletonList(adminRole)))
                .build();

        User saved = userRepository.save(admin);
        log.info("Default HR Admin user created: {}", adminEmail);
        return saved;
    }

    private void initLeaveTypesAndPolicies() {
        int currentYear = Year.now().getValue();

        List<LeaveTypeSeedDefinition> seeds = List.of(
                new LeaveTypeSeedDefinition(
                        "ANNUAL",
                        "Annual Leave",
                        "Statutory annual leave entitlement under Employment Act 2007 (21 working days per year)",
                        true,
                        false,
                        "Standard Annual Leave Policy",
                        new BigDecimal("21.00"),
                        new BigDecimal("1.75"),
                        new BigDecimal("7.00"),
                        3
                ),
                new LeaveTypeSeedDefinition(
                        "SICK",
                        "Sick Leave",
                        "Statutory sick leave entitlement under Employment Act 2007 (up to 30 days)",
                        true,
                        true,
                        "Standard Statutory Sick Leave Policy",
                        new BigDecimal("30.00"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        0
                ),
                new LeaveTypeSeedDefinition(
                        "MATERNITY",
                        "Maternity Leave",
                        "Statutory maternity leave under Employment Act 2007 (3 calendar months / 90 days fully paid)",
                        true,
                        true,
                        "Statutory Maternity Leave Policy",
                        new BigDecimal("90.00"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        0
                ),
                new LeaveTypeSeedDefinition(
                        "PATERNITY",
                        "Paternity Leave",
                        "Statutory paternity leave under Employment Act 2007 (2 weeks / 14 calendar days fully paid)",
                        true,
                        false,
                        "Statutory Paternity Leave Policy",
                        new BigDecimal("14.00"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        0
                ),
                new LeaveTypeSeedDefinition(
                        "CASUAL",
                        "Casual Leave",
                        "Short duration leave for urgent personal or family emergencies",
                        true,
                        false,
                        "Company Casual Leave Policy",
                        new BigDecimal("10.00"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        0
                )
        );

        for (LeaveTypeSeedDefinition seed : seeds) {
            LeaveType leaveType = leaveTypeRepository.findByCode(seed.code()).orElseGet(() ->
                    leaveTypeRepository.save(LeaveType.builder()
                            .code(seed.code())
                            .name(seed.name())
                            .description(seed.description())
                            .isPaid(seed.isPaid())
                            .requiresAttachment(seed.requiresAttachment())
                            .isActive(true)
                            .build())
            );

            // Check if active policy already exists for this type and year
            Optional<LeavePolicy> existingPolicy = leavePolicyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(leaveType.getId(), currentYear);
            if (existingPolicy.isEmpty()) {
                LeavePolicy policy = LeavePolicy.builder()
                        .leaveType(leaveType)
                        .policyName(seed.policyName())
                        .annualAllowance(seed.annualAllowance())
                        .monthlyAccrualRate(seed.monthlyAccrualRate())
                        .maxCarryoverDays(seed.maxCarryoverDays())
                        .carryoverExpiryMonths(seed.carryoverExpiryMonths())
                        .effectiveYear(currentYear)
                        .isActive(true)
                        .build();

                leavePolicyRepository.save(policy);
            }
        }
        log.info("Initialized Kenyan statutory leave types and policies for year {}", currentYear);
    }

    private void initHelpdeskTaxonomy() {
        // Ensure ticket number sequence exists
        try {
            jdbcTemplate.execute("CREATE SEQUENCE IF NOT EXISTS helpdesk.ticket_number_seq START WITH 1001 INCREMENT BY 1");
        } catch (Exception e) {
            log.warn("Ticket sequence creation check returned: {}", e.getMessage());
        }

        // 1. Support Queues
        List<QueueDefinition> queueDefs = List.of(
                new QueueDefinition("Tier 1 Support", "General helpdesk triage and Tier 1 customer queries", "tier1-support@company.com"),
                new QueueDefinition("IT Networks & Infrastructure", "Core networks, VPN, Wi-Fi, and connectivity", "networks@company.com"),
                new QueueDefinition("Hardware Support", "Laptops, monitors, peripherals, and repair", "hardware@company.com"),
                new QueueDefinition("Access & Identity Management", "Single sign-on, account provisioning, and access permissions", "access-mgmt@company.com")
        );
        for (QueueDefinition def : queueDefs) {
            if (!supportQueueRepository.existsByName(def.name())) {
                supportQueueRepository.save(SupportQueue.builder()
                        .name(def.name())
                        .description(def.description())
                        .emailAlias(def.emailAlias())
                        .isActive(true)
                        .build());
            }
        }

        // 2. Ticket Categories
        List<CategoryDefinition> catDefs = List.of(
                new CategoryDefinition("IT Hardware & Peripherals", "IT_HARDWARE", "Issues related to laptops, monitors, chargers, and workstation hardware", TicketPriority.HIGH),
                new CategoryDefinition("Access & Permissions Request", "ACCESS_REQUEST", "System access, role changes, credentials, and software license grants", TicketPriority.MEDIUM),
                new CategoryDefinition("Software Bug & Application Issues", "SOFTWARE_ISSUE", "Software malfunctions, crashes, and internal tooling bugs", TicketPriority.MEDIUM),
                new CategoryDefinition("Network & Connectivity", "NETWORK", "Office Wi-Fi, VPN connectivity, internet outages, and LAN issues", TicketPriority.HIGH),
                new CategoryDefinition("HR & Payroll Queries", "HR_QUERY", "General human resources, benefits, payroll, and workplace queries", TicketPriority.LOW)
        );
        for (CategoryDefinition def : catDefs) {
            if (!ticketCategoryRepository.existsByCode(def.code())) {
                ticketCategoryRepository.save(TicketCategory.builder()
                        .name(def.name())
                        .code(def.code())
                        .description(def.description())
                        .defaultPriority(def.defaultPriority())
                        .isActive(true)
                        .build());
            }
        }

        // 3. SLA Policies
        List<SlaDefinition> slaDefs = List.of(
                new SlaDefinition("Critical / Urgent SLA", TicketPriority.URGENT, 15, 120,
                        "{\"warnAtPercent\": 75, \"escalateToRole\": \"SUPPORT_LEAD\", \"notifyChannels\": [\"EMAIL\", \"IN_APP\", \"SLACK\"]}"),
                new SlaDefinition("High Priority SLA", TicketPriority.HIGH, 60, 480,
                        "{\"warnAtPercent\": 80, \"escalateToRole\": \"SUPPORT_LEAD\", \"notifyChannels\": [\"EMAIL\", \"IN_APP\"]}"),
                new SlaDefinition("Standard Medium SLA", TicketPriority.MEDIUM, 240, 1440,
                        "{\"warnAtPercent\": 85, \"escalateToRole\": \"SUPPORT_AGENT\", \"notifyChannels\": [\"EMAIL\"]}"),
                new SlaDefinition("Low Priority SLA", TicketPriority.LOW, 480, 2880,
                        "{\"warnAtPercent\": 90, \"escalateToRole\": \"SUPPORT_AGENT\", \"notifyChannels\": [\"EMAIL\"]}")
        );
        for (SlaDefinition def : slaDefs) {
            if (!slaPolicyRepository.existsByPriority(def.priority())) {
                slaPolicyRepository.save(SlaPolicy.builder()
                        .name(def.name())
                        .priority(def.priority())
                        .firstResponseTargetMinutes(def.firstResponseMinutes())
                        .resolutionTargetMinutes(def.resolutionMinutes())
                        .escalationRuleJson(def.escalationRuleJson())
                        .isActive(true)
                        .build());
            }
        }
        log.info("Initialized Help Desk queues, categories, and SLA policies.");
    }

    private void initKnowledgeBaseAndCannedResponses() {
        // 1. Canned Responses
        if (cannedResponseRepository.count() == 0) {
            TicketCategory itCat = ticketCategoryRepository.findByCode("NETWORK").orElse(null);
            TicketCategory accessCat = ticketCategoryRepository.findByCode("ACCESS_REQUEST").orElse(null);

            cannedResponseRepository.save(CannedResponse.builder()
                    .title("VPN Connection Troubleshooting")
                    .shortcut("#vpn-fix")
                    .content("Please verify your MFA token has not expired. Restart the OpenVPN client and reconnect to vpn.company.com. If the handshake fails, clear your DNS cache with 'ipconfig /flushdns' and retry.")
                    .category(itCat)
                    .build());

            cannedResponseRepository.save(CannedResponse.builder()
                    .title("Password Reset Sent")
                    .shortcut("#pwd-reset")
                    .content("A temporary password reset link has been dispatched to your registered alternate email address. Please click the link and configure your new passphrase within 15 minutes.")
                    .category(accessCat)
                    .build());

            cannedResponseRepository.save(CannedResponse.builder()
                    .title("Requesting Additional Information")
                    .shortcut("#need-info")
                    .content("To assist you further with this ticket, please reply with screenshots of any error codes, your workstation machine name, and the exact steps taken prior to encountering the issue.")
                    .build());

            cannedResponseRepository.save(CannedResponse.builder()
                    .title("Incident Resolved Confirmation")
                    .shortcut("#resolved-confirm")
                    .content("We have applied a fix to resolve this reported incident. Please verify on your side. If everything works as expected, you can submit your feedback via the 5-star survey rating below.")
                    .build());

            log.info("Initialized default IT Support canned macro responses.");
        }

        // 2. Knowledge Base Articles
        if (knowledgeBaseArticleRepository.count() == 0) {
            TicketCategory netCat = ticketCategoryRepository.findByCode("NETWORK").orElse(null);
            TicketCategory accessCat = ticketCategoryRepository.findByCode("ACCESS_REQUEST").orElse(null);
            TicketCategory hrCat = ticketCategoryRepository.findByCode("HR_QUERY").orElse(null);
            TicketCategory hardCat = ticketCategoryRepository.findByCode("IT_HARDWARE").orElse(null);

            knowledgeBaseArticleRepository.save(KnowledgeBaseArticle.builder()
                    .title("How to Connect to Corporate Office VPN (GlobalProtect / OpenVPN)")
                    .slug("how-to-connect-to-corporate-office-vpn")
                    .content("### Corporate VPN Connection Guide\n\n1. Ensure you have an active internet connection.\n2. Open your VPN client from the system tray.\n3. Enter the portal gateway: `vpn.company.com`.\n4. Input your corporate username and password.\n5. When prompted, enter the 6-digit TOTP code generated in Google Authenticator or Microsoft Authenticator.\n\n*Note: If you receive 'Certificate Expired', re-download the IT root certificate from the intranet.*")
                    .category(netCat)
                    .tags("vpn, network, remote, connectivity, security")
                    .isPublished(true)
                    .viewCount(24)
                    .helpfulCount(18)
                    .build());

            knowledgeBaseArticleRepository.save(KnowledgeBaseArticle.builder()
                    .title("Self-Service Password Reset and Account Unlock Guide")
                    .slug("self-service-password-reset-and-account-unlock-guide")
                    .content("### Resetting Your Corporate Password\n\n- Visit `https://auth.company.com/reset-password`\n- Enter your Employee Code or Corporate Email Address.\n- Verify your identity using SMS OTP or Authenticator app.\n- Choose a strong passphrase with at least 10 characters, including upper, lower, number, and special symbols.\n\nIf your account is locked after 5 failed attempts, wait 15 minutes for the lockout window to reset automatically or open a high-priority ticket.")
                    .category(accessCat)
                    .tags("password, reset, credentials, auth, lock, account")
                    .isPublished(true)
                    .viewCount(35)
                    .helpfulCount(29)
                    .build());

            knowledgeBaseArticleRepository.save(KnowledgeBaseArticle.builder()
                    .title("Annual Leave Entitlement, Accruals & Encashment Rules (Kenya Statutory)")
                    .slug("annual-leave-entitlement-accruals-and-encashment-rules")
                    .content("### Statutory Leave Policy & Encashment Guidelines\n\n- **Annual Entitlement**: Permanent employees earn 21 working days per calendar year, accrued at 1.75 days per completed month of service.\n- **Kenyan Public Holidays**: Official national gazetted holidays are excluded from leave deductions.\n- **Leave Encashment**: Eligible employees with earned annual leave balances exceeding 10 days may request encashment of up to 10 days per fiscal year upon Line Manager and HR Admin approval.\n- Payouts are computed using your gross basic daily rate and reflected on your month-end payslip.")
                    .category(hrCat)
                    .tags("leave, annual, accrual, encashment, payout, kenya, statutory")
                    .isPublished(true)
                    .viewCount(52)
                    .helpfulCount(41)
                    .build());

            knowledgeBaseArticleRepository.save(KnowledgeBaseArticle.builder()
                    .title("Compensatory Off (Comp-Off) Submission & Claim Rules")
                    .slug("compensatory-off-comp-off-submission-and-claim-rules")
                    .content("### Overtime Compensatory Off Policy\n\n- Employees who perform pre-approved official work on weekends or gazetted public holidays are eligible for 1 comp-off credit per full workday (8 hours).\n- Claims must be logged via the **Leave Portal ➔ Compensatory Off Claims** within 30 days of the duty date.\n- Approved credits are added to your available leave ledger under `COMP_OFF_CREDIT`.")
                    .category(hrCat)
                    .tags("comp-off, overtime, weekend, holiday, credit, claim")
                    .isPublished(true)
                    .viewCount(19)
                    .helpfulCount(15)
                    .build());

            knowledgeBaseArticleRepository.save(KnowledgeBaseArticle.builder()
                    .title("Troubleshooting USB-C Docking Station & Dual Monitor Displays")
                    .slug("troubleshooting-usb-c-docking-station-dual-monitors")
                    .content("### External Display & Docking Diagnostics\n\n1. Disconnect the USB-C dock power cable and laptop for 10 seconds to power-cycle the DisplayLink chip.\n2. Reconnect power first, then plug into your laptop Thunderbolt/USB-C port.\n3. On Windows, press `Win + P` and verify display mode is set to **Extend**.\n4. Check Windows Update for the latest OEM Display Driver.")
                    .category(hardCat)
                    .tags("hardware, display, monitor, dock, usb-c, dual-screen")
                    .isPublished(true)
                    .viewCount(14)
                    .helpfulCount(9)
                    .build());

            log.info("Initialized default Knowledge Base articles.");
        }
    }

    private record PermissionDefinition(String code, String domain, String description) {}

    private record LeaveTypeSeedDefinition(
            String code,
            String name,
            String description,
            boolean isPaid,
            boolean requiresAttachment,
            String policyName,
            BigDecimal annualAllowance,
            BigDecimal monthlyAccrualRate,
            BigDecimal maxCarryoverDays,
            int carryoverExpiryMonths
    ) {}

    private record QueueDefinition(String name, String description, String emailAlias) {}
    private record CategoryDefinition(String name, String code, String description, TicketPriority defaultPriority) {}
    private record SlaDefinition(String name, TicketPriority priority, int firstResponseMinutes, int resolutionMinutes, String escalationRuleJson) {}
}
