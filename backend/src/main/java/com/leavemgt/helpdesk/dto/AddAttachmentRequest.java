package com.leavemgt.helpdesk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddAttachmentRequest {

    @NotBlank(message = "File name is required")
    private String fileName;

    private String mimeType;

    @NotNull(message = "File size in bytes is required")
    private Long fileSizeBytes;

    private UUID commentId;
}
