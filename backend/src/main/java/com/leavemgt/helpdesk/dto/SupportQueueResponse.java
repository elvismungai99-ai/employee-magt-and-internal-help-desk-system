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
public class SupportQueueResponse {
    private UUID id;
    private String name;
    private String description;
    private String emailAlias;
    private Boolean isActive;
    private Integer memberCount;
    private OffsetDateTime createdAt;
}
