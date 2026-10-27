package com.leavemgt.leave.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.leave.dto.ApprovalDecisionRequest;
import com.leavemgt.leave.dto.DepartmentOverlapResponse;
import com.leavemgt.leave.dto.TeamCapacityDayResponse;
import com.leavemgt.leave.dto.LeaveRequestResponse;
import com.leavemgt.leave.dto.SubmitLeaveRequest;
import com.leavemgt.leave.service.LeaveRequestService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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

    @GetMapping("/department-overlap")
    public ResponseEntity<ApiResponse<List<DepartmentOverlapResponse>>> getDepartmentOverlap(
            @RequestParam(value = "startDate", required = false) String startDateStr,
            @RequestParam(value = "endDate", required = false) String endDateStr,
            @RequestParam(value = "departmentId", required = false) String departmentIdStr,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        LocalDate startDate = parseDateOrDefault(startDateStr, LocalDate.now());
        LocalDate endDate = parseDateOrDefault(endDateStr, startDate.plusDays(30));
        if (startDate.isAfter(endDate)) {
            LocalDate tmp = startDate;
            startDate = endDate;
            endDate = tmp;
        }
        UUID departmentId = parseUuidOrNull(departmentIdStr);

        List<DepartmentOverlapResponse> overlaps = leaveRequestService.getDepartmentOverlap(callerId, startDate, endDate, departmentId);
        return ResponseEntity.ok(ApiResponse.success(overlaps, "Department overlap retrieved successfully"));
    }

    @GetMapping("/team-capacity")
    public ResponseEntity<ApiResponse<List<TeamCapacityDayResponse>>> getTeamCapacity(
            @RequestParam(value = "startDate", required = false) String startDateStr,
            @RequestParam(value = "endDate", required = false) String endDateStr,
            @RequestParam(value = "departmentId", required = false) String departmentIdStr,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        LocalDate startDate = parseDateOrDefault(startDateStr, LocalDate.now());
        LocalDate endDate = parseDateOrDefault(endDateStr, startDate.plusDays(30));
        if (startDate.isAfter(endDate)) {
            LocalDate tmp = startDate;
            startDate = endDate;
            endDate = tmp;
        }
        UUID departmentId = parseUuidOrNull(departmentIdStr);

        List<TeamCapacityDayResponse> capacity = leaveRequestService.getTeamCapacityHeatmap(callerId, startDate, endDate, departmentId);
        return ResponseEntity.ok(ApiResponse.success(capacity, "Team capacity retrieved successfully"));
    }

    @PostMapping(value = "/upload-attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadAttachment(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Unauthorized"));
        }

        String attachmentUrl = leaveRequestService.uploadAttachmentFile(file, callerId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(Map.of("attachmentUrl", attachmentUrl), "File uploaded successfully"));
    }

    @GetMapping("/attachments/{fileName:.+}")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable("fileName") String fileName) throws IOException {
        Resource resource = leaveRequestService.getAttachmentResource(fileName);
        String contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) contentType = "application/pdf";
        else if (lower.endsWith(".png")) contentType = "image/png";
        else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
        else if (lower.endsWith(".webp")) contentType = "image/webp";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .body(resource);
    }

    @GetMapping("/{id}/calendar.ics")
    public ResponseEntity<byte[]> exportCalendar(
            @PathVariable("id") UUID id,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        boolean isHrAdmin = isHrAdmin(authentication);
        byte[] icsData = leaveRequestService.exportCalendarIcs(id, callerId, isHrAdmin);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/calendar; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leave-" + id + ".ics\"")
                .body(icsData);
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

    private LocalDate parseDateOrDefault(String dateStr, LocalDate defaultVal) {
        if (dateStr == null || dateStr.isBlank() || dateStr.equalsIgnoreCase("undefined") || dateStr.equalsIgnoreCase("null")) {
            return defaultVal;
        }
        try {
            return LocalDate.parse(dateStr.trim());
        } catch (Exception e) {
            return defaultVal;
        }
    }

    private UUID parseUuidOrNull(String uuidStr) {
        if (uuidStr == null || uuidStr.isBlank() || uuidStr.equalsIgnoreCase("undefined") || uuidStr.equalsIgnoreCase("null")) {
            return null;
        }
        try {
            return UUID.fromString(uuidStr.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
