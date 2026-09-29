package com.leavemgt.helpdesk.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.helpdesk.dto.*;
import com.leavemgt.helpdesk.service.HelpdeskTaxonomyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/helpdesk")
public class HelpdeskTaxonomyController {

    private final HelpdeskTaxonomyService taxonomyService;

    public HelpdeskTaxonomyController(HelpdeskTaxonomyService taxonomyService) {
        this.taxonomyService = taxonomyService;
    }

    // =========================================================================
    // 1. TICKET CATEGORIES
    // =========================================================================

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<TicketCategoryResponse>>> getCategories() {
        List<TicketCategoryResponse> categories = taxonomyService.getActiveCategories();
        return ResponseEntity.ok(ApiResponse.success(categories, "Ticket categories retrieved successfully"));
    }

    @PostMapping("/categories")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<TicketCategoryResponse>> createCategory(
            @Valid @RequestBody CreateTicketCategoryRequest request) {
        TicketCategoryResponse response = taxonomyService.createCategory(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Ticket category created successfully"));
    }

    // =========================================================================
    // 2. SUPPORT QUEUES
    // =========================================================================

    @GetMapping("/queues")
    public ResponseEntity<ApiResponse<List<SupportQueueResponse>>> getQueues() {
        List<SupportQueueResponse> queues = taxonomyService.getActiveQueues();
        return ResponseEntity.ok(ApiResponse.success(queues, "Support queues retrieved successfully"));
    }

    @PostMapping("/queues")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<SupportQueueResponse>> createQueue(
            @Valid @RequestBody CreateSupportQueueRequest request) {
        SupportQueueResponse response = taxonomyService.createQueue(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Support queue created successfully"));
    }

    // =========================================================================
    // 3. QUEUE MEMBERSHIP
    // =========================================================================

    @GetMapping("/queues/{queueId}/members")
    public ResponseEntity<ApiResponse<List<QueueMemberResponse>>> getQueueMembers(
            @PathVariable("queueId") UUID queueId) {
        List<QueueMemberResponse> members = taxonomyService.getQueueMembers(queueId);
        return ResponseEntity.ok(ApiResponse.success(members, "Queue members retrieved successfully"));
    }

    @PostMapping("/queues/{queueId}/members")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<QueueMemberResponse>> addQueueMember(
            @PathVariable("queueId") UUID queueId,
            @Valid @RequestBody AddQueueMemberRequest request,
            Authentication authentication) {
        UUID adminUserId = extractUserId(authentication);
        QueueMemberResponse response = taxonomyService.addAgentToQueue(queueId, request.getAgentUserId(), adminUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Support agent added to queue successfully"));
    }

    // =========================================================================
    // 4. SLA POLICIES
    // =========================================================================

    @GetMapping("/sla-policies")
    public ResponseEntity<ApiResponse<List<SlaPolicyResponse>>> getSlaPolicies() {
        List<SlaPolicyResponse> policies = taxonomyService.getActiveSlaPolicies();
        return ResponseEntity.ok(ApiResponse.success(policies, "SLA policies retrieved successfully"));
    }

    @PostMapping("/sla-policies")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<SlaPolicyResponse>> createSlaPolicy(
            @Valid @RequestBody CreateSlaPolicyRequest request) {
        SlaPolicyResponse response = taxonomyService.createSlaPolicy(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "SLA policy created successfully"));
    }

    private UUID extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UUID uuid) {
            return uuid;
        }
        return null;
    }
}
