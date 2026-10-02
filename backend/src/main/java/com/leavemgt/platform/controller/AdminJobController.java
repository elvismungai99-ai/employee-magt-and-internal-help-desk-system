package com.leavemgt.platform.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.helpdesk.engine.SlaBreachMonitorEngine;
import com.leavemgt.helpdesk.engine.SlaMonitorRunResult;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.engine.AccrualRunResult;
import com.leavemgt.leave.engine.BalanceAccrualEngine;
import com.leavemgt.platform.dto.ManualAccrualTriggerRequest;
import com.leavemgt.platform.entity.EventOutbox;
import com.leavemgt.platform.entity.OutboxStatus;
import com.leavemgt.platform.repository.EventOutboxRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
@Slf4j
public class AdminJobController {

    private final BalanceAccrualEngine balanceAccrualEngine;
    private final SlaBreachMonitorEngine slaBreachMonitorEngine;
    private final EventOutboxRepository outboxRepository;
    private final UserRepository userRepository;

    public AdminJobController(BalanceAccrualEngine balanceAccrualEngine,
                              SlaBreachMonitorEngine slaBreachMonitorEngine,
                              EventOutboxRepository outboxRepository,
                              UserRepository userRepository) {
        this.balanceAccrualEngine = balanceAccrualEngine;
        this.slaBreachMonitorEngine = slaBreachMonitorEngine;
        this.outboxRepository = outboxRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/jobs/accrual/last-run")
    public ResponseEntity<ApiResponse<AccrualRunResult>> getLastAccrualRun() {
        AccrualRunResult result = balanceAccrualEngine.getLastRun();
        return ResponseEntity.ok(ApiResponse.success(result, "Last accrual run retrieved successfully"));
    }

    @GetMapping("/jobs/sla-monitor/last-run")
    public ResponseEntity<ApiResponse<SlaMonitorRunResult>> getLastSlaMonitorRun() {
        SlaMonitorRunResult result = slaBreachMonitorEngine.getLastRun();
        return ResponseEntity.ok(ApiResponse.success(result, "Last SLA monitor run retrieved successfully"));
    }

    @GetMapping("/events")
    public ResponseEntity<ApiResponse<Page<EventOutbox>>> getOutboxEvents(
            @RequestParam(name = "status", required = false) OutboxStatus status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<EventOutbox> events;
        if (status != null) {
            events = outboxRepository.findByStatusOrderByCreatedAtDesc(status, pageRequest);
        } else {
            events = outboxRepository.findAllByOrderByCreatedAtDesc(pageRequest);
        }
        return ResponseEntity.ok(ApiResponse.success(events, "Recent event outbox entries retrieved successfully"));
    }

    @PostMapping("/jobs/accrual/trigger")
    public ResponseEntity<ApiResponse<AccrualRunResult>> triggerAccrual(
            @RequestBody(required = false) ManualAccrualTriggerRequest request,
            Authentication authentication) {
        UUID callerId = extractUserId(authentication);
        String callerIdentifier = "HR_ADMIN";

        if (callerId != null) {
            User caller = userRepository.findById(callerId).orElse(null);
            if (caller != null) {
                callerIdentifier = caller.getEmail();
            }
        }

        LocalDate now = LocalDate.now();
        int year = (request != null && request.getYear() != null) ? request.getYear() : now.getYear();
        int month = (request != null && request.getMonth() != null) ? request.getMonth() : now.getMonthValue();

        log.info("Manual accrual triggered by HR Admin: {} for period {}/{}", callerIdentifier, month, year);
        AccrualRunResult result = balanceAccrualEngine.runAccrual(year, month, callerIdentifier);

        return ResponseEntity.ok(ApiResponse.success(result, "Accrual executed successfully"));
    }

    private UUID extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UUID uuid) {
            return uuid;
        }
        return null;
    }
}
