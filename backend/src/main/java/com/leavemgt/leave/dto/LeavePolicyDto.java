package com.leavemgt.leave.dto;

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
public class LeavePolicyDto {
    private UUID id;
    private UUID leaveTypeId;
    private String leaveTypeCode;
    private String leaveTypeName;
    private String policyName;
    private BigDecimal annualAllowance;
    private BigDecimal monthlyAccrualRate;
    private BigDecimal maxCarryoverDays;
    private Integer carryoverExpiryMonths;
    private Integer effectiveYear;
    private Boolean isActive;
}
