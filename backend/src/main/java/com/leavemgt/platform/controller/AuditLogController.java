package com.leavemgt.platform.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.platform.dto.AuditLogResponse;
import com.leavemgt.platform.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
@lombok.extern.slf4j.Slf4j
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AuditLogResponse>>> getAuditLogs(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String actorEmail,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<AuditLogResponse> logs = auditLogService.getAuditLogs(action, entityType, actorEmail, page, size);
            return ResponseEntity.ok(ApiResponse.success(logs, "Audit logs retrieved successfully"));
        } catch (Exception e) {
            log.error("Error retrieving audit logs: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.success(Page.empty(), "No audit logs available"));
        }
    }
}
