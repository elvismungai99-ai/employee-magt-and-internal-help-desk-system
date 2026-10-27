package com.leavemgt.helpdesk.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateCannedResponseRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Shortcut is required (e.g., #vpn-fix)")
    private String shortcut;

    @NotBlank(message = "Content is required")
    private String content;

    private UUID categoryId;
}
