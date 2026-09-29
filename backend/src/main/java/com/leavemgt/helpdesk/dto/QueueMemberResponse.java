package com.leavemgt.helpdesk.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueueMemberResponse {
    private UUID queueId;
    private String queueName;
    private UUID agentUserId;
    private String agentName;
    private String agentEmail;
    private Boolean isActive;
    private OffsetDateTime assignedAt;
    private UUID assignedById;
    private String assignedByName;
}
