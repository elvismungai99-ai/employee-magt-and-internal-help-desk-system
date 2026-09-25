package com.leavemgt.identity.service;

import com.leavemgt.identity.dto.AssignManagerRequest;
import com.leavemgt.identity.dto.ReportingHierarchyResponse;
import com.leavemgt.identity.entity.RelationshipType;
import com.leavemgt.identity.entity.ReportingHierarchy;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.ReportingHierarchyRepository;
import com.leavemgt.identity.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HierarchyService {

    private static final Set<String> ALLOWED_MANAGER_ROLES = Set.of(
            "LINE_MANAGER", "ROLE_LINE_MANAGER",
            "MANAGER", "ROLE_MANAGER",
            "HR_ADMIN", "ROLE_HR_ADMIN"
    );

    private final ReportingHierarchyRepository hierarchyRepository;
    private final UserRepository userRepository;

    public HierarchyService(ReportingHierarchyRepository hierarchyRepository,
                            UserRepository userRepository) {
        this.hierarchyRepository = hierarchyRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ReportingHierarchyResponse assignManager(AssignManagerRequest request, UUID assignedByAdminId) {
        if (request.getEmployeeId() == null || request.getManagerId() == null) {
            throw new IllegalArgumentException("Both employeeId and managerId are required");
        }

        UUID employeeId = request.getEmployeeId();
        UUID managerId = request.getManagerId();
        RelationshipType relationshipType = request.getRelationshipType() != null 
                ? request.getRelationshipType() 
                : RelationshipType.DIRECT;

        // 1. Rule: No self-reporting
        if (employeeId.equals(managerId)) {
            throw new IllegalArgumentException("Employee cannot be assigned as their own manager");
        }

        // 2. Fetch employee and manager
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee user not found with ID: " + employeeId));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new IllegalArgumentException("Manager user not found with ID: " + managerId));

        User assignedByUser = null;
        if (assignedByAdminId != null) {
            assignedByUser = userRepository.findById(assignedByAdminId).orElse(null);
        }

        // 3. Rule: Both users must be ACTIVE
        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new IllegalArgumentException("Cannot assign hierarchy: employee is not in ACTIVE status (current: " + employee.getStatus() + ")");
        }
        if (!"ACTIVE".equalsIgnoreCase(manager.getStatus())) {
            throw new IllegalArgumentException("Cannot assign hierarchy: proposed manager is not in ACTIVE status (current: " + manager.getStatus() + ")");
        }

        // 4. Rule: Manager must hold a role that can manage (LINE_MANAGER or HR_ADMIN)
        boolean hasManagerRole = manager.getRoles().stream()
                .map(Role::getName)
                .anyMatch(ALLOWED_MANAGER_ROLES::contains);

        if (!hasManagerRole) {
            throw new IllegalArgumentException("Proposed manager does not possess managerial privileges (requires LINE_MANAGER or HR_ADMIN role)");
        }

        // 5. Rule: No cycles (walk upward from proposed manager to verify employee is not already an ancestor)
        validateNoCycles(employeeId, managerId);

        // 6. Rule: Reassignment closes history, never deletes it (for DIRECT relationships)
        if (relationshipType == RelationshipType.DIRECT) {
            List<ReportingHierarchy> existingDirectRows = hierarchyRepository.findActiveDirectRowsForEmployee(employeeId);
            for (ReportingHierarchy existingRow : existingDirectRows) {
                existingRow.setIsActive(false);
                existingRow.setEffectiveTo(LocalDate.now());
                hierarchyRepository.save(existingRow);
            }
            hierarchyRepository.flush();
        }

        // 7. Insert the new active reporting relationship
        ReportingHierarchy newHierarchy = ReportingHierarchy.builder()
                .employee(employee)
                .manager(manager)
                .relationshipType(relationshipType)
                .isActive(true)
                .effectiveFrom(LocalDate.now())
                .assignedBy(assignedByUser)
                .build();

        ReportingHierarchy savedHierarchy = hierarchyRepository.save(newHierarchy);

        return mapToHierarchyResponse(savedHierarchy);
    }

    @Transactional(readOnly = true)
    public ReportingHierarchyResponse getMyCurrentManager(UUID employeeId) {
        if (employeeId == null) {
            throw new IllegalArgumentException("Employee ID is required");
        }
        return hierarchyRepository.findCurrentManagerForEmployee(employeeId)
                .map(this::mapToHierarchyResponse)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<ReportingHierarchyResponse> getMyDirectSubordinates(UUID managerId) {
        if (managerId == null) {
            throw new IllegalArgumentException("Manager ID is required");
        }
        return hierarchyRepository.findActiveSubordinatesForManagerAndType(managerId, RelationshipType.DIRECT, LocalDate.now())
                .stream()
                .map(this::mapToHierarchyResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ReportingHierarchyResponse> getSubordinatesForUser(UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found with ID: " + userId);
        }
        return hierarchyRepository.findActiveSubordinatesForManagerAndType(userId, RelationshipType.DIRECT, LocalDate.now())
                .stream()
                .map(this::mapToHierarchyResponse)
                .collect(Collectors.toList());
    }

    private void validateNoCycles(UUID employeeId, UUID proposedManagerId) {
        UUID current = proposedManagerId;
        Set<UUID> visited = new HashSet<>();
        visited.add(current);

        while (current != null) {
            if (current.equals(employeeId)) {
                throw new IllegalArgumentException("Cycle detected in reporting hierarchy: employee cannot appear in manager's reporting chain");
            }

            Optional<ReportingHierarchy> parentHierarchy = hierarchyRepository.findCurrentManagerForEmployee(current);
            if (parentHierarchy.isPresent() && parentHierarchy.get().getManager() != null) {
                UUID nextManager = parentHierarchy.get().getManager().getId();
                if (visited.contains(nextManager)) {
                    // Loop detected in existing data, stop traversal to prevent infinite loop
                    break;
                }
                visited.add(nextManager);
                current = nextManager;
            } else {
                break;
            }
        }
    }

    public ReportingHierarchyResponse mapToHierarchyResponse(ReportingHierarchy rh) {
        if (rh == null) {
            return null;
        }

        ReportingHierarchyResponse.UserSummaryDto employeeDto = null;
        if (rh.getEmployee() != null) {
            User emp = rh.getEmployee();
            employeeDto = ReportingHierarchyResponse.UserSummaryDto.builder()
                    .id(emp.getId())
                    .employeeCode(emp.getEmployeeCode())
                    .fullName(emp.getFullName())
                    .email(emp.getEmail())
                    .jobTitle(emp.getJobTitle())
                    .departmentName(emp.getDepartment() != null ? emp.getDepartment().getName() : null)
                    .departmentCode(emp.getDepartment() != null ? emp.getDepartment().getCode() : null)
                    .build();
        }

        ReportingHierarchyResponse.UserSummaryDto managerDto = null;
        if (rh.getManager() != null) {
            User mgr = rh.getManager();
            managerDto = ReportingHierarchyResponse.UserSummaryDto.builder()
                    .id(mgr.getId())
                    .employeeCode(mgr.getEmployeeCode())
                    .fullName(mgr.getFullName())
                    .email(mgr.getEmail())
                    .jobTitle(mgr.getJobTitle())
                    .departmentName(mgr.getDepartment() != null ? mgr.getDepartment().getName() : null)
                    .departmentCode(mgr.getDepartment() != null ? mgr.getDepartment().getCode() : null)
                    .build();
        }

        ReportingHierarchyResponse.AssignedBySummaryDto assignedByDto = null;
        if (rh.getAssignedBy() != null) {
            User assigner = rh.getAssignedBy();
            assignedByDto = ReportingHierarchyResponse.AssignedBySummaryDto.builder()
                    .id(assigner.getId())
                    .fullName(assigner.getFullName())
                    .email(assigner.getEmail())
                    .build();
        }

        return ReportingHierarchyResponse.builder()
                .id(rh.getId())
                .employee(employeeDto)
                .manager(managerDto)
                .relationshipType(rh.getRelationshipType())
                .isActive(rh.getIsActive())
                .effectiveFrom(rh.getEffectiveFrom())
                .effectiveTo(rh.getEffectiveTo())
                .assignedBy(assignedByDto)
                .createdAt(rh.getCreatedAt())
                .build();
    }
}
