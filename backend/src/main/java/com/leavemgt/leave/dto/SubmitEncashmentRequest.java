package com.leavemgt.leave.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitEncashmentRequest {

    @NotNull(message = "Leave type ID is required")
    private UUID leaveTypeId;

    @NotNull(message = "Days to encash is required")
    @DecimalMin(value = "0.50", message = "Encashment must be at least 0.5 days")
    private BigDecimal daysRequested;

    @NotBlank(message = "Reason is required")
    private String reason;
}
