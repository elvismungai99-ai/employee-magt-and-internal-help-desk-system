package com.leavemgt.helpdesk.dto;

import com.leavemgt.helpdesk.entity.TicketPriority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSlaPolicyRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must not exceed 100 characters")
    private String name;

    @NotNull(message = "Priority is required")
    private TicketPriority priority;

    @NotNull(message = "firstResponseTargetMinutes is required")
    @Min(value = 1, message = "firstResponseTargetMinutes must be at least 1")
    private Integer firstResponseTargetMinutes;

    @NotNull(message = "resolutionTargetMinutes is required")
    @Min(value = 1, message = "resolutionTargetMinutes must be at least 1")
    private Integer resolutionTargetMinutes;

    @Valid
    private EscalationRuleDto escalationRule;

    private String escalationRuleJson;
}
