package com.leavemgt.leave.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.leave.dto.CreateLeavePolicyRequest;
import com.leavemgt.leave.dto.LeavePolicyDto;
import com.leavemgt.leave.service.LeavePolicyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/leave/policies")
public class LeavePolicyController {

    private final LeavePolicyService leavePolicyService;

    public LeavePolicyController(LeavePolicyService leavePolicyService) {
        this.leavePolicyService = leavePolicyService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<LeavePolicyDto>>> getActivePolicies() {
        List<LeavePolicyDto> policies = leavePolicyService.getActivePolicies();
        return ResponseEntity.ok(ApiResponse.success(policies, "Active leave policies retrieved successfully"));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<LeavePolicyDto>> createOrUpdatePolicy(@Valid @RequestBody CreateLeavePolicyRequest request) {
        LeavePolicyDto policy = leavePolicyService.createOrUpdatePolicy(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(policy, "Leave policy configured successfully"));
    }
}
