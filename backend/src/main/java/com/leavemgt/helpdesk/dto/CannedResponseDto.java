package com.leavemgt.helpdesk.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CannedResponseDto {
    private UUID id;
    private String title;
    private String shortcut;
    private String content;
    private UUID categoryId;
    private String categoryName;
    private OffsetDateTime createdAt;
}
