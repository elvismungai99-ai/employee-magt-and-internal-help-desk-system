package com.leavemgt.leave.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.leave.dto.EncashmentDecisionRequest;
import com.leavemgt.leave.dto.LeaveEncashmentResponse;
import com.leavemgt.leave.dto.SubmitEncashmentRequest;
import com.leavemgt.leave.service.LeaveEncashmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/leave/encashment")
public class LeaveEncashmentController {

    private final LeaveEncashmentService encashmentService;

    public LeaveEncashmentController(LeaveEncashmentService encashmentService) {
        this.encashmentService = encashmentService;
    }

    @PostMapping("/request")
    public ResponseEntity<ApiResponse<LeaveEncashmentResponse>> submitRequest(
            @Valid @RequestBody SubmitEncashmentRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        LeaveEncashmentResponse response = encashmentService.submitRequest(request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Leave encashment request submitted successfully"));
    }

    @GetMapping("/my-requests")
    public ResponseEntity<ApiResponse<List<LeaveEncashmentResponse>>> getMyRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        List<LeaveEncashmentResponse> responses = encashmentService.getMyRequests(callerId);
        return ResponseEntity.ok(ApiResponse.success(responses, "My leave encashment requests retrieved"));
    }

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<LeaveEncashmentResponse>>> getPendingRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        List<LeaveEncashmentResponse> responses = encashmentService.getPendingRequests();
        return ResponseEntity.ok(ApiResponse.success(responses, "Pending leave encashment requests retrieved"));
    }

    @GetMapping("/all")
    public ResponseEntity<ApiResponse<List<LeaveEncashmentResponse>>> getAllRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        List<LeaveEncashmentResponse> responses = encashmentService.getAllRequests();
        return ResponseEntity.ok(ApiResponse.success(responses, "All leave encashment requests retrieved"));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<LeaveEncashmentResponse>> approveRequest(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) EncashmentDecisionRequest decision,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        LeaveEncashmentResponse response = encashmentService.approveRequest(id, decision, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Leave encashment request approved and balance deducted"));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<LeaveEncashmentResponse>> rejectRequest(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) EncashmentDecisionRequest decision,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        LeaveEncashmentResponse response = encashmentService.rejectRequest(id, decision, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Leave encashment request rejected"));
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
