package com.leavemgt.common.config;

import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.Permission;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.PermissionRepository;
import com.leavemgt.identity.repository.RoleRepository;
import com.leavemgt.identity.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(RoleRepository roleRepository,
                           PermissionRepository permissionRepository,
                           DepartmentRepository departmentRepository,
                           UserRepository userRepository,
                           PasswordEncoder passwordEncoder) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Starting identity seed data initialization...");

        // 1. Seed Permissions
        Map<String, Permission> permissions = initPermissions();

        // 2. Seed Roles with associated Permissions
        Map<String, Role> roles = initRoles(permissions);

        // 3. Seed Departments
        Map<String, Department> departments = initDepartments();

        // 4. Seed Default HR Admin
        initAdminUser(roles.get("HR_ADMIN"), departments.get("HR"));

        log.info("Identity seed data initialization completed successfully.");
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

    private void initAdminUser(Role adminRole, Department hrDept) {
        String adminEmail = "hr.admin@company.com";
        if (userRepository.findByEmail(adminEmail).isEmpty()) {
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

            userRepository.save(admin);
            log.info("Default HR Admin user created: {}", adminEmail);
        }
    }

    private record PermissionDefinition(String code, String domain, String description) {}
}
