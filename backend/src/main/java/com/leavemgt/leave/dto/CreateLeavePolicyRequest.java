package com.leavemgt.leave.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
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
public class CreateLeavePolicyRequest {

    @NotNull(message = "Leave type ID is required")
    private UUID leaveTypeId;

    @NotBlank(message = "Policy name is required")
    private String policyName;

    @NotNull(message = "Annual allowance is required")
    @DecimalMin(value = "0.0", message = "Annual allowance must be greater than or equal to 0")
    private BigDecimal annualAllowance;

    @Builder.Default
    @DecimalMin(value = "0.0", message = "Monthly accrual rate must be greater than or equal to 0")
    private BigDecimal monthlyAccrualRate = BigDecimal.ZERO;

    @Builder.Default
    @DecimalMin(value = "0.0", message = "Max carryover days must be greater than or equal to 0")
    private BigDecimal maxCarryoverDays = BigDecimal.ZERO;

    @Builder.Default
    @Min(value = 0, message = "Carryover expiry months must be greater than or equal to 0")
    private Integer carryoverExpiryMonths = 3;

    @NotNull(message = "Effective year is required")
    @Min(value = 2000, message = "Effective year must be valid")
    private Integer effectiveYear;
}
