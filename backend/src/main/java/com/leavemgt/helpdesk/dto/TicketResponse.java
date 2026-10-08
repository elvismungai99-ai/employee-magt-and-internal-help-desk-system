package com.leavemgt.helpdesk.dto;

import com.leavemgt.helpdesk.entity.TicketPriority;
import com.leavemgt.helpdesk.entity.TicketStatus;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResponse {
    private UUID id;
    private String ticketNumber;
    private String title;
    private String description;
    private TicketStatus status;
    private TicketPriority priority;

    private UUID requesterId;
    private String requesterName;
    private String requesterEmail;

    // Both assigneeId and assignedAgentId provided for convenience
    private UUID assigneeId;
    private UUID assignedAgentId;
    private String assignedAgentName;
    private String assignedAgentEmail;

    private UUID categoryId;
    private String categoryName;
    private String categoryCode;

    private UUID queueId;
    private String queueName;

    private UUID slaPolicyId;
    private OffsetDateTime slaDueAt;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime resolvedAt;
    private OffsetDateTime closedAt;

    private List<TicketCommentResponse> comments;
    private List<TicketAttachmentResponse> attachments;
}
