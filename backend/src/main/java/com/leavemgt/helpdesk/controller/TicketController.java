package com.leavemgt.helpdesk.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.helpdesk.dto.*;
import com.leavemgt.helpdesk.service.TicketService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/helpdesk/tickets")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    // =========================================================================
    // 1. TICKET CREATION & LISTING
    // =========================================================================

    @PostMapping
    public ResponseEntity<ApiResponse<TicketResponse>> createTicket(
            @Valid @RequestBody CreateTicketRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        TicketResponse response = ticketService.createTicket(request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Ticket created successfully"));
    }

    @GetMapping("/my-tickets")
    public ResponseEntity<ApiResponse<List<TicketResponse>>> getMyTickets(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        List<TicketResponse> responses = ticketService.getMyTickets(callerId);
        return ResponseEntity.ok(ApiResponse.success(responses, "My tickets retrieved successfully"));
    }

    @GetMapping("/queue")
    public ResponseEntity<ApiResponse<List<TicketResponse>>> getQueueTickets(
            @RequestParam(name = "queueId", required = false) UUID queueId,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        List<TicketResponse> responses = ticketService.getQueueTickets(callerId, queueId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(responses, "Queue tickets retrieved successfully"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketResponse>> getTicketById(
            @PathVariable("id") UUID id,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        boolean isSupportAgent = isSupportAgent(authentication);
        TicketResponse response = ticketService.getTicketById(id, callerId, isHrAdmin, isSupportAgent);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket retrieved successfully"));
    }

    // =========================================================================
    // 2. ASSIGNMENT & COMMENTS
    // =========================================================================

    @PostMapping("/{id}/assign")
    public ResponseEntity<ApiResponse<TicketResponse>> assignTicket(
            @PathVariable("id") UUID id,
            @Valid @RequestBody AssignTicketRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        TicketResponse response = ticketService.assignTicket(id, request, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket assigned successfully"));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<ApiResponse<TicketCommentResponse>> addComment(
            @PathVariable("id") UUID id,
            @Valid @RequestBody AddCommentRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        boolean isSupportAgent = isSupportAgent(authentication);
        TicketCommentResponse response = ticketService.addComment(id, request, callerId, isHrAdmin, isSupportAgent);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Comment added successfully"));
    }

    // =========================================================================
    // 3. STATUS TRANSITIONS
    // =========================================================================

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<TicketResponse>> resolveTicket(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) ResolveTicketRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        TicketResponse response = ticketService.resolveTicket(id, request, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket marked as RESOLVED"));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<ApiResponse<TicketResponse>> closeTicket(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) CloseTicketRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        TicketResponse response = ticketService.closeTicket(id, request, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket CLOSED successfully"));
    }

    @PostMapping("/{id}/reopen")
    public ResponseEntity<ApiResponse<TicketResponse>> reopenTicket(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        String reason = body != null ? body.get("reason") : null;
        TicketResponse response = ticketService.reopenTicket(id, reason, callerId, isHrAdmin);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket REOPENED successfully"));
    }

    // =========================================================================
    // 4. ATTACHMENTS & HISTORY
    // =========================================================================

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<TicketAttachmentResponse>> addAttachment(
            @PathVariable("id") UUID id,
            @Valid @RequestBody AddAttachmentRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        TicketAttachmentResponse response = ticketService.addAttachment(id, request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Attachment uploaded successfully"));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<ApiResponse<List<TicketRoutingHistoryResponse>>> getRoutingHistory(
            @PathVariable("id") UUID id,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }
        boolean isHrAdmin = isHrAdmin(authentication);
        boolean isSupportAgent = isSupportAgent(authentication);
        List<TicketRoutingHistoryResponse> response = ticketService.getTicketRoutingHistory(id, callerId, isHrAdmin, isSupportAgent);
        return ResponseEntity.ok(ApiResponse.success(response, "Routing history retrieved successfully"));
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

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

    private boolean isSupportAgent(Authentication authentication) {
        if (authentication == null) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPPORT_AGENT".equals(a.getAuthority()) || "SUPPORT_AGENT".equals(a.getAuthority()));
    }
}
