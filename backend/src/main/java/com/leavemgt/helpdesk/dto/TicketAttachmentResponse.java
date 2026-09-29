package com.leavemgt.helpdesk.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketAttachmentResponse {
    private UUID id;
    private UUID ticketId;
    private UUID commentId;
    private UUID uploadedById;
    private String uploadedByName;
    private String fileName;
    private String filePath;
    private Long fileSizeBytes;
    private String mimeType;
    private OffsetDateTime createdAt;
}
