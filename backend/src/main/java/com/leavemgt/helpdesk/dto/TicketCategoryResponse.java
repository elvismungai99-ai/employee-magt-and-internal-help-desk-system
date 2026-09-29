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
public class TicketCategoryResponse {
    private UUID id;
    private String name;
    private String code;
    private String description;
    private TicketPriority defaultPriority;
    private Boolean isActive;
    private OffsetDateTime createdAt;
}
