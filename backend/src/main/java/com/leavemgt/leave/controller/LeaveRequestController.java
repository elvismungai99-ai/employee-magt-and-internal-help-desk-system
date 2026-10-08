package com.leavemgt.leave.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.leave.dto.ApprovalDecisionRequest;
import com.leavemgt.leave.dto.LeaveRequestResponse;
import com.leavemgt.leave.dto.SubmitLeaveRequest;
import com.leavemgt.leave.service.LeaveRequestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/leave/requests")
public class LeaveRequestController {

    private final LeaveRequestService leaveRequestService;

    public LeaveRequestController(LeaveRequestService leaveRequestService) {
        this.leaveRequestService = leaveRequestService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<LeaveRequestResponse>> submitRequest(
            @Valid @RequestBody SubmitLeaveRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        LeaveRequestResponse response = leaveRequestService.submitRequest(request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Leave request submitted successfully"));
    }

    @GetMapping("/my-requests")
    public ResponseEntity<ApiResponse<List<LeaveRequestResponse>>> getMyRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        List<LeaveRequestResponse> responses = leaveRequestService.getMyRequests(callerId);
        return ResponseEntity.ok(ApiResponse.success(responses, "Leave requests retrieved successfully"));
    }

    @GetMapping("/all")
    public ResponseEntity<ApiResponse<List<LeaveRequestResponse>>> getAllRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        List<LeaveRequestResponse> responses = leaveRequestService.getAllRequests(callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(responses, "All leave requests retrieved successfully"));
    }

    @GetMapping("/pending-approvals")
    public ResponseEntity<ApiResponse<List<LeaveRequestResponse>>> getPendingApprovals(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        List<LeaveRequestResponse> responses = leaveRequestService.getPendingApprovalsForCaller(callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(responses, "Pending approvals retrieved successfully"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LeaveRequestResponse>> getRequestById(
            @PathVariable("id") UUID id,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        LeaveRequestResponse response = leaveRequestService.getRequestById(id, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Leave request details retrieved successfully"));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<LeaveRequestResponse>> approveRequest(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) ApprovalDecisionRequest decision,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        LeaveRequestResponse response = leaveRequestService.approveRequest(id, decision, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Leave request approved successfully"));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<LeaveRequestResponse>> rejectRequest(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) ApprovalDecisionRequest decision,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        LeaveRequestResponse response = leaveRequestService.rejectRequest(id, decision, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Leave request rejected successfully"));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<LeaveRequestResponse>> cancelRequest(
            @PathVariable("id") UUID id,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        LeaveRequestResponse response = leaveRequestService.cancelRequest(id, callerId);
        return ResponseEntity.ok(ApiResponse.success(response, "Leave request cancelled successfully"));
    }

    private UUID extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UUID uuid) {
            return uuid;
        }
        return null;
    }

    private boolean isHrAdmin(Authentication authentication) {
        if (authentication == null) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_HR_ADMIN".equals(a.getAuthority()) || "HR_ADMIN".equals(a.getAuthority()));
    }
}
