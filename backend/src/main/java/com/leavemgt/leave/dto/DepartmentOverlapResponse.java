package com.leavemgt.leave.dto;

import com.leavemgt.leave.entity.LeaveRequestStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentOverlapResponse {
    private UUID requestId;
    private UUID userId;
    private String employeeName;
    private String employeeEmail;
    private String departmentName;
    private String leaveTypeName;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal totalDays;
    private LeaveRequestStatus status;
}
