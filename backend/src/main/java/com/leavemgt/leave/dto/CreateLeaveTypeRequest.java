package com.leavemgt.leave.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateLeaveTypeRequest {

    @NotBlank(message = "Leave type name is required")
    @Size(max = 100, message = "Name must be less than 100 characters")
    private String name;

    @NotBlank(message = "Leave type code is required")
    @Size(max = 20, message = "Code must be less than 20 characters")
    private String code;

    private String description;

    @Builder.Default
    private Boolean isPaid = true;

    @Builder.Default
    private Boolean requiresAttachment = false;
}
