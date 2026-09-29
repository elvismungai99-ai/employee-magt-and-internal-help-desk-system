package com.leavemgt.common.config;

import com.leavemgt.helpdesk.entity.SlaPolicy;
import com.leavemgt.helpdesk.entity.SupportQueue;
import com.leavemgt.helpdesk.entity.TicketCategory;
import com.leavemgt.helpdesk.entity.TicketPriority;
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
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

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
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Starting seed data initialization...");

        // 1. Seed Permissions
        Map<String, Permission> permissions = initPermissions();

        // 2. Seed Roles with associated Permissions
        Map<String, Role> roles = initRoles(permissions);

        // 3. Seed Departments
        Map<String, Department> departments = initDepartments();

        // 4. Seed Default HR Admin
        User adminUser = initAdminUser(roles.get("HR_ADMIN"), departments.get("HR"));

        // 5. Seed Kenyan Statutory Leave Types & Policies
        initLeaveTypesAndPolicies();

        // 6. Seed Help Desk Taxonomy (Queues, Categories, SLA Policies)
        initHelpdeskTaxonomy();

        // 7. Initialize balances for Admin User
        if (adminUser != null) {
            leaveBalanceService.initializeBalancesForUser(adminUser, Year.now().getValue());
        }

        log.info("Seed data initialization completed successfully.");
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

        return map;
    }

    private User initAdminUser(Role adminRole, Department hrDept) {
        String adminEmail = "hr.admin@company.com";
        Optional<User> existing = userRepository.findByEmail(adminEmail);
        if (existing.isPresent()) {
            return existing.get();
        }

        User admin = User.builder()
                .employeeCode("EMP-00001")
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode("Admin123!"))
                .firstName("System")
                .lastName("Admin")
                .jobTitle("HR Administrator")
                .phone("+254700000000")
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
