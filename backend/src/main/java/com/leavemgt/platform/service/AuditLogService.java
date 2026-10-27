package com.leavemgt.platform.service;

import com.leavemgt.platform.dto.AuditLogResponse;
import com.leavemgt.platform.entity.AuditLog;
import com.leavemgt.platform.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(UUID actorId, String actorEmail, String action, String entityType, String entityId, String details, String ipAddress) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .timestamp(OffsetDateTime.now())
                    .actorId(actorId)
                    .actorEmail(actorEmail)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .details(details)
                    .ipAddress(ipAddress)
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.warn("Failed to record audit log for action {}: {}", action, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogs(String action, String entityType, String actorEmail, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLog> logPage;

        boolean noFilters = (action == null || action.isBlank()) &&
                            (entityType == null || entityType.isBlank()) &&
                            (actorEmail == null || actorEmail.isBlank());

        if (noFilters) {
            logPage = auditLogRepository.findAllByOrderByTimestampDesc(pageable);
        } else {
            logPage = auditLogRepository.searchLogs(
                    action != null && !action.isBlank() ? action : null,
                    entityType != null && !entityType.isBlank() ? entityType : null,
                    actorEmail != null && !actorEmail.isBlank() ? actorEmail.trim() : null,
                    pageable
            );
        }

        return logPage.map(this::mapToResponse);
    }

    private AuditLogResponse mapToResponse(AuditLog a) {
        return AuditLogResponse.builder()
                .id(a.getId())
                .timestamp(a.getTimestamp())
                .actorId(a.getActorId())
                .actorEmail(a.getActorEmail())
                .action(a.getAction())
                .entityType(a.getEntityType())
                .entityId(a.getEntityId())
                .details(a.getDetails())
                .ipAddress(a.getIpAddress())
                .build();
    }
}
