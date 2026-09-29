package com.leavemgt.helpdesk.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EscalationRuleDto {

    @NotNull(message = "warnAtPercent is required")
    @Min(value = 1, message = "warnAtPercent must be at least 1")
    @Max(value = 100, message = "warnAtPercent cannot exceed 100")
    private Integer warnAtPercent;

    @NotBlank(message = "escalateToRole is required")
    private String escalateToRole;

    @Builder.Default
    private List<String> notifyChannels = new ArrayList<>();
}
