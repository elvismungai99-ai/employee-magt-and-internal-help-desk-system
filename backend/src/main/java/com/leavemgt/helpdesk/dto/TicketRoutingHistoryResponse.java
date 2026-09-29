package com.leavemgt.helpdesk.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketRoutingHistoryResponse {
    private UUID id;
    private UUID ticketId;
    private UUID previousAgentId;
    private String previousAgentName;
    private UUID newAgentId;
    private String newAgentName;
    private String reason;
    private UUID changedById;
    private String changedByName;
    private OffsetDateTime createdAt;
}
