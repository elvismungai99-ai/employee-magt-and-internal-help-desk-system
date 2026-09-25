package com.leavemgt.identity.service;

import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.dto.UserProfileResponse;
import com.leavemgt.identity.entity.*;
import com.leavemgt.identity.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final ReportingHierarchyRepository hierarchyRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       DepartmentRepository departmentRepository,
                       ReportingHierarchyRepository hierarchyRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentRepository = departmentRepository;
        this.hierarchyRepository = hierarchyRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return mapToUserProfileResponse(user);
    }

    @Transactional
    public UserProfileResponse createUserByAdmin(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail().toLowerCase().trim())) {
            throw new IllegalArgumentException("Email already in use");
        }

        Role role = roleRepository.findByName(request.getRoleName().toUpperCase().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid role: " + request.getRoleName()));

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new IllegalArgumentException("Invalid department ID"));
        }

        String employeeCode = request.getEmployeeCode();
        if (employeeCode == null || employeeCode.isBlank()) {
            employeeCode = "EMP-" + (10000 + new Random().nextInt(90000));
            while (userRepository.existsByEmployeeCode(employeeCode)) {
                employeeCode = "EMP-" + (10000 + new Random().nextInt(90000));
            }
        }

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .employeeCode(employeeCode)
                .jobTitle(request.getJobTitle() != null ? request.getJobTitle() : request.getRoleName())
                .phone(request.getPhone())
                .department(department)
                .status("ACTIVE")
                .roles(new HashSet<>(Collections.singletonList(role)))
                .build();

        User savedUser = userRepository.save(user);

        // Assign manager via reporting_hierarchy if provided
        if (request.getManagerId() != null) {
            User manager = userRepository.findById(request.getManagerId())
                    .orElseThrow(() -> new IllegalArgumentException("Manager user not found"));

            ReportingHierarchy hierarchy = ReportingHierarchy.builder()
                    .employee(savedUser)
                    .manager(manager)
                    .relationshipType("DIRECT")
                    .isActive(true)
                    .effectiveFrom(LocalDate.now())
                    .build();

            hierarchyRepository.save(hierarchy);
        }

        return mapToUserProfileResponse(savedUser);
    }

    @Transactional
    public UserProfileResponse assignManager(UUID employeeId, UUID managerId) {
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee user not found with ID: " + employeeId));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new IllegalArgumentException("Manager user not found with ID: " + managerId));

        // Deactivate any existing active hierarchy for this employee
        List<ReportingHierarchy> activeList = hierarchyRepository.findActiveHierarchyForEmployee(employeeId, LocalDate.now());
        for (ReportingHierarchy rh : activeList) {
            rh.setIsActive(false);
            rh.setEffectiveTo(LocalDate.now());
            hierarchyRepository.save(rh);
        }

        ReportingHierarchy hierarchy = ReportingHierarchy.builder()
                .employee(employee)
                .manager(manager)
                .relationshipType("DIRECT")
                .isActive(true)
                .effectiveFrom(LocalDate.now())
                .build();

        hierarchyRepository.save(hierarchy);

        return mapToUserProfileResponse(employee);
    }

    @Transactional(readOnly = true)
    public List<UserProfileResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToUserProfileResponse)
                .collect(Collectors.toList());
    }

    private UserProfileResponse mapToUserProfileResponse(User user) {
        UserProfileResponse.DepartmentDto deptDto = null;
        if (user.getDepartment() != null) {
            deptDto = UserProfileResponse.DepartmentDto.builder()
                    .id(user.getDepartment().getId())
                    .name(user.getDepartment().getName())
                    .code(user.getDepartment().getCode())
                    .build();
        }

        List<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());

        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getPermissionCode)
                .distinct()
                .collect(Collectors.toList());

        UserProfileResponse.ManagerSummaryDto managerDto = null;
        Optional<ReportingHierarchy> hierarchyOpt = hierarchyRepository.findCurrentManagerForEmployee(user.getId());
        if (hierarchyOpt.isPresent()) {
            User manager = hierarchyOpt.get().getManager();
            managerDto = UserProfileResponse.ManagerSummaryDto.builder()
                    .id(manager.getId())
                    .fullName(manager.getFullName())
                    .email(manager.getEmail())
                    .relationshipType(hierarchyOpt.get().getRelationshipType())
                    .effectiveFrom(hierarchyOpt.get().getEffectiveFrom())
                    .build();
        }

        return UserProfileResponse.builder()
                .id(user.getId())
                .employeeCode(user.getEmployeeCode())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .fullName(user.getFullName())
                .jobTitle(user.getJobTitle())
                .phone(user.getPhone())
                .status(user.getStatus())
                .department(deptDto)
                .roles(roles)
                .permissions(permissions)
                .manager(managerDto)
                .build();
    }
}
