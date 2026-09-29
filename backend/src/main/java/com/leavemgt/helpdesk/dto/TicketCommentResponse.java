package com.leavemgt.helpdesk.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketCommentResponse {
    private UUID id;
    private UUID ticketId;
    private UUID authorId;
    private String authorName;
    private String authorEmail;
    private String content;
    private Boolean isInternal;
    private Boolean isInternalNote;
    private OffsetDateTime createdAt;
}
