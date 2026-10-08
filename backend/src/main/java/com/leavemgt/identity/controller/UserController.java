package com.leavemgt.identity.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.identity.dto.ApproveRegistrationRequest;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.dto.UserProfileResponse;
import com.leavemgt.identity.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/identity/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getCurrentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UUID userId)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized"));
        }

        UserProfileResponse profile = userService.getCurrentUserProfile(userId);
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<java.util.List<UserProfileResponse>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.success(userService.getAllUsers()));
    }

    @GetMapping("/colleagues")
    public ResponseEntity<ApiResponse<java.util.List<UserProfileResponse>>> getActiveColleagues() {
        return ResponseEntity.ok(ApiResponse.success(userService.getAllActiveUsers()));
    }

    @GetMapping("/pending-approvals")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<java.util.List<UserProfileResponse>>> getPendingApprovals() {
        return ResponseEntity.ok(ApiResponse.success(userService.getPendingRegistrations()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<UserProfileResponse>> approveUser(
            @PathVariable("id") UUID userId,
            @RequestBody(required = false) ApproveRegistrationRequest request) {
        UUID managerId = request != null ? request.getManagerId() : null;
        UUID deptId = request != null ? request.getDepartmentId() : null;
        UserProfileResponse profile = userService.approveUserRegistration(userId, managerId, deptId);
        return ResponseEntity.ok(ApiResponse.success(profile, "User registration approved and account activated successfully"));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<UserProfileResponse>> rejectUser(
            @PathVariable("id") UUID userId,
            @RequestBody(required = false) java.util.Map<String, String> request) {
        String reason = request != null ? request.get("reason") : null;
        UserProfileResponse profile = userService.rejectUserRegistration(userId, reason);
        return ResponseEntity.ok(ApiResponse.success(profile, "User registration rejected"));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<UserProfileResponse>> createUserByAdmin(@Valid @RequestBody CreateUserRequest request) {
        UserProfileResponse createdUser = userService.createUserByAdmin(request);
        return ResponseEntity.ok(ApiResponse.success(createdUser, "User account created successfully by administrator"));
    }

    @PutMapping("/{id}/manager")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<UserProfileResponse>> assignManager(
            @PathVariable("id") UUID employeeId,
            @RequestBody java.util.Map<String, UUID> request) {
        UUID managerId = request.get("managerId");
        if (managerId == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("managerId is required"));
        }
        UserProfileResponse profile = userService.assignManager(employeeId, managerId);
        return ResponseEntity.ok(ApiResponse.success(profile, "Manager assigned successfully"));
    }
}

