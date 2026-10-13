package com.leavemgt.leave.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.leave.dto.CompOffDecisionRequest;
import com.leavemgt.leave.dto.CompOffResponse;
import com.leavemgt.leave.dto.SubmitCompOffRequest;
import com.leavemgt.leave.service.CompOffService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/leave/comp-off")
public class CompOffController {

    private final CompOffService compOffService;

    public CompOffController(CompOffService compOffService) {
        this.compOffService = compOffService;
    }

    @PostMapping("/request")
    public ResponseEntity<ApiResponse<CompOffResponse>> submitRequest(
            @Valid @RequestBody SubmitCompOffRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        CompOffResponse response = compOffService.submitRequest(request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Compensatory off request submitted successfully"));
    }

    @GetMapping("/my-requests")
    public ResponseEntity<ApiResponse<List<CompOffResponse>>> getMyRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        List<CompOffResponse> responses = compOffService.getMyRequests(callerId);
        return ResponseEntity.ok(ApiResponse.success(responses, "My compensatory off requests retrieved"));
    }

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<CompOffResponse>>> getPendingRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        List<CompOffResponse> responses = compOffService.getPendingRequests(callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(responses, "Pending compensatory off requests retrieved"));
    }

    @GetMapping("/all")
    public ResponseEntity<ApiResponse<List<CompOffResponse>>> getAllRequests(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        List<CompOffResponse> responses = compOffService.getAllRequests(isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(responses, "All compensatory off requests retrieved"));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<CompOffResponse>> approveRequest(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) CompOffDecisionRequest decision,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        CompOffResponse response = compOffService.approveRequest(id, decision, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Compensatory off request approved and credited to leave balance"));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<CompOffResponse>> rejectRequest(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) CompOffDecisionRequest decision,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        CompOffResponse response = compOffService.rejectRequest(id, decision, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Compensatory off request rejected"));
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
