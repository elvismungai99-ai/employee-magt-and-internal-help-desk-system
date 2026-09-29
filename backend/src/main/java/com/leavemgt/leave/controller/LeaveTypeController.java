package com.leavemgt.leave.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.leave.dto.CreateLeaveTypeRequest;
import com.leavemgt.leave.dto.LeaveTypeDto;
import com.leavemgt.leave.service.LeaveTypeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/leave/types")
public class LeaveTypeController {

    private final LeaveTypeService leaveTypeService;

    public LeaveTypeController(LeaveTypeService leaveTypeService) {
        this.leaveTypeService = leaveTypeService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<LeaveTypeDto>>> getActiveLeaveTypes() {
        List<LeaveTypeDto> types = leaveTypeService.getActiveLeaveTypes();
        return ResponseEntity.ok(ApiResponse.success(types, "Active leave types retrieved successfully"));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<LeaveTypeDto>> createLeaveType(@Valid @RequestBody CreateLeaveTypeRequest request) {
        LeaveTypeDto created = leaveTypeService.createLeaveType(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Leave type created successfully"));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<LeaveTypeDto>> deactivateLeaveType(@PathVariable("id") UUID id) {
        LeaveTypeDto deactivated = leaveTypeService.deactivateLeaveType(id);
        return ResponseEntity.ok(ApiResponse.success(deactivated, "Leave type deactivated successfully"));
    }
}
