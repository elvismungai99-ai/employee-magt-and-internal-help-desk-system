package com.leavemgt.leave.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.leave.dto.AdjustBalanceRequest;
import com.leavemgt.leave.dto.LeaveBalanceResponse;
import com.leavemgt.leave.service.LeaveBalanceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Year;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/leave/balances")
public class LeaveBalanceController {

    private final LeaveBalanceService leaveBalanceService;

    public LeaveBalanceController(LeaveBalanceService leaveBalanceService) {
        this.leaveBalanceService = leaveBalanceService;
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<LeaveBalanceResponse>>> getMyBalances(
            @RequestParam(name = "year", required = false) Integer year,
            Authentication authentication) {
        UUID userId = extractUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized"));
        }

        int targetYear = (year != null) ? year : Year.now().getValue();
        List<LeaveBalanceResponse> balances = leaveBalanceService.getMyBalances(userId, targetYear);
        return ResponseEntity.ok(ApiResponse.success(balances, "Leave balances retrieved successfully"));
    }

    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<List<LeaveBalanceResponse>>> getUserBalances(
            @PathVariable("userId") UUID userId,
            @RequestParam(name = "year", required = false) Integer year) {
        int targetYear = (year != null) ? year : Year.now().getValue();
        List<LeaveBalanceResponse> balances = leaveBalanceService.getUserBalances(userId, targetYear);
        return ResponseEntity.ok(ApiResponse.success(balances, "User leave balances retrieved successfully"));
    }

    @PostMapping("/{balanceId}/adjust")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<LeaveBalanceResponse>> adjustBalance(
            @PathVariable("balanceId") UUID balanceId,
            @Valid @RequestBody AdjustBalanceRequest request,
            Authentication authentication) {
        UUID adminUserId = extractUserId(authentication);
        LeaveBalanceResponse response = leaveBalanceService.adjustBalance(balanceId, request, adminUserId);
        return ResponseEntity.ok(ApiResponse.success(response, "Leave balance adjusted successfully"));
    }

    private UUID extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UUID uuid) {
            return uuid;
        }
        return null;
    }
}
