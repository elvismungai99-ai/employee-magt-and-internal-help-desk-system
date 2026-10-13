package com.leavemgt.leave.dto;

import com.leavemgt.leave.entity.EncashmentStatus;
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
public class LeaveEncashmentResponse {
    private UUID id;
    private UUID userId;
    private String employeeName;
    private String employeeEmail;
    private String departmentName;
    private UUID leaveTypeId;
    private String leaveTypeName;
    private BigDecimal daysRequested;
    private Integer year;
    private String reason;
    private EncashmentStatus status;
    private UUID approvedById;
    private String approvedByName;
    private String comments;
    private OffsetDateTime actionedAt;
    private OffsetDateTime createdAt;
}
