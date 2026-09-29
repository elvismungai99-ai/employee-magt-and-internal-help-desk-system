package com.leavemgt.helpdesk.dto;

import com.leavemgt.helpdesk.entity.TicketPriority;
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
public class SlaPolicyResponse {
    private UUID id;
    private String name;
    private TicketPriority priority;
    private Integer firstResponseTargetMinutes;
    private Integer resolutionTargetMinutes;
    private EscalationRuleDto escalationRule;
    private String escalationRuleJson;
    private Boolean isActive;
    private OffsetDateTime createdAt;
}
