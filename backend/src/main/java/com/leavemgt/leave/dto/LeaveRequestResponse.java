package com.leavemgt.leave.dto;

import com.leavemgt.leave.entity.LeaveRequestStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveRequestResponse {
    private UUID id;
    private UUID userId;
    private String employeeName;
    private String employeeEmail;
    private UUID leaveTypeId;
    private String leaveTypeCode;
    private String leaveTypeName;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal totalDays;
    private String reason;
    private LeaveRequestStatus status;
    private String attachmentUrl;
    private List<LeaveApprovalResponse> approvals;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
