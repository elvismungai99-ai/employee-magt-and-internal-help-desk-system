package com.leavemgt.helpdesk.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArticleResponse {
    private UUID id;
    private String title;
    private String slug;
    private String content;
    private UUID categoryId;
    private String categoryName;
    private String tags;
    private Boolean isPublished;
    private Integer viewCount;
    private Integer helpfulCount;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
