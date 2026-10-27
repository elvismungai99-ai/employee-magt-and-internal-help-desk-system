package com.leavemgt.leave.controller;

import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.service.CalendarService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/leave/calendar")
@RequiredArgsConstructor
@Slf4j
public class CalendarController {

    private final CalendarService calendarService;
    private final UserRepository userRepository;

    @GetMapping("/my-leaves.ics")
    public ResponseEntity<byte[]> downloadMyLeavesIcs(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        log.info("Generating my-leaves.ics for user {}", callerId);
        String ics = calendarService.generateIcsForUser(callerId);
        byte[] bytes = ics.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/calendar; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"my_approved_leaves.ics\"")
                .body(bytes);
    }

    @GetMapping("/department.ics")
    public ResponseEntity<byte[]> downloadDepartmentLeavesIcs(Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        if (callerId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        User user = userRepository.findById(callerId).orElse(null);
        UUID deptId = user != null && user.getDepartment() != null ? user.getDepartment().getId() : null;

        log.info("Generating department.ics for department {}", deptId);
        String ics = deptId != null ? calendarService.generateIcsForDepartment(deptId) : calendarService.generateIcsForUser(callerId);
        byte[] bytes = ics.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/calendar; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"department_leaves.ics\"")
                .body(bytes);
    }

    private UUID extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UUID uuid) {
            return uuid;
        }
        return null;
    }
}
