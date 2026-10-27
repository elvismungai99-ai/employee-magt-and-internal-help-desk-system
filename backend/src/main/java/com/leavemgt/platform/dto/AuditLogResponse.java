package com.leavemgt.platform.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogResponse {
    private UUID id;
    private OffsetDateTime timestamp;
    private UUID actorId;
    private String actorEmail;
    private String action;
    private String entityType;
    private String entityId;
    private String details;
    private String ipAddress;
}
