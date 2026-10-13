package com.leavemgt.leave.dto;

import com.leavemgt.leave.entity.CompOffStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompOffResponse {
    private UUID id;
    private UUID userId;
    private String employeeName;
    private String employeeEmail;
    private String departmentName;
    private LocalDate workedDate;
    private BigDecimal daysEarned;
    private String reason;
    private CompOffStatus status;
    private UUID approverId;
    private String approverName;
    private String comments;
    private OffsetDateTime actionedAt;
    private OffsetDateTime createdAt;
}
