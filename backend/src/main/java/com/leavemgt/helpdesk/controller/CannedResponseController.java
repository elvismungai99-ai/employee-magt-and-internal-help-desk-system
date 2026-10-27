package com.leavemgt.helpdesk.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.helpdesk.dto.CannedResponseDto;
import com.leavemgt.helpdesk.dto.CreateCannedResponseRequest;
import com.leavemgt.helpdesk.service.CannedResponseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/helpdesk/canned-responses")
@RequiredArgsConstructor
public class CannedResponseController {

    private final CannedResponseService cannedResponseService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN', 'ROLE_SUPPORT_AGENT', 'SUPPORT_AGENT')")
    public ResponseEntity<ApiResponse<List<CannedResponseDto>>> getAllCannedResponses() {
        List<CannedResponseDto> responses = cannedResponseService.getAllCannedResponses();
        return ResponseEntity.ok(ApiResponse.success(responses, "Canned responses retrieved successfully"));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN', 'ROLE_SUPPORT_AGENT', 'SUPPORT_AGENT')")
    public ResponseEntity<ApiResponse<CannedResponseDto>> createCannedResponse(
            @Valid @RequestBody CreateCannedResponseRequest request) {
        CannedResponseDto created = cannedResponseService.createCannedResponse(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Canned response created successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteCannedResponse(@PathVariable UUID id) {
        cannedResponseService.deleteCannedResponse(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Canned response deleted successfully"));
    }
}
