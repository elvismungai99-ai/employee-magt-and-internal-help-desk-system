package com.leavemgt.identity.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.identity.dto.AssignManagerRequest;
import com.leavemgt.identity.dto.ReportingHierarchyResponse;
import com.leavemgt.identity.service.HierarchyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/identity/hierarchy")
public class HierarchyController {

    private final HierarchyService hierarchyService;

    public HierarchyController(HierarchyService hierarchyService) {
        this.hierarchyService = hierarchyService;
    }

    @PostMapping("/assign")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<ReportingHierarchyResponse>> assignManager(
            @Valid @RequestBody AssignManagerRequest request,
            Authentication authentication) {
        UUID adminUserId = extractUserId(authentication);
        ReportingHierarchyResponse response = hierarchyService.assignManager(request, adminUserId);
        return ResponseEntity.ok(ApiResponse.success(response, "Manager assigned successfully"));
    }

    @GetMapping("/my-manager")
    public ResponseEntity<ApiResponse<ReportingHierarchyResponse>> getMyManager(Authentication authentication) {
        UUID employeeId = extractUserId(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized"));
        }
        ReportingHierarchyResponse response = hierarchyService.getMyCurrentManager(employeeId);
        return ResponseEntity.ok(ApiResponse.success(response, "Current manager retrieved successfully"));
    }

    @GetMapping("/my-subordinates")
    public ResponseEntity<ApiResponse<List<ReportingHierarchyResponse>>> getMySubordinates(Authentication authentication) {
        UUID managerId = extractUserId(authentication);
        if (managerId == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized"));
        }
        List<ReportingHierarchyResponse> subordinates = hierarchyService.getMyDirectSubordinates(managerId);
        return ResponseEntity.ok(ApiResponse.success(subordinates, "Subordinates retrieved successfully"));
    }

    @GetMapping("/{userId}/subordinates")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<List<ReportingHierarchyResponse>>> getSubordinatesForUser(
            @PathVariable("userId") UUID userId) {
        List<ReportingHierarchyResponse> subordinates = hierarchyService.getSubordinatesForUser(userId);
        return ResponseEntity.ok(ApiResponse.success(subordinates, "User subordinates retrieved successfully"));
    }

    private UUID extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UUID uuid) {
            return uuid;
        }
        return null;
    }
}
