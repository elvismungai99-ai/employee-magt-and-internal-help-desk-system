package com.leavemgt.leave.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveBalanceResponse {
    private UUID id;
    private UUID userId;
    private UUID leaveTypeId;
    private String leaveTypeCode;
    private String leaveTypeName;
    private Integer year;
    private BigDecimal entitledDays;
    private BigDecimal accruedDays;
    private BigDecimal usedDays;
    private BigDecimal pendingDays;
    private BigDecimal carriedOverDays;
    private BigDecimal availableDays;
    private OffsetDateTime updatedAt;
}
