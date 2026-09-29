package com.leavemgt.leave.dto;

import com.leavemgt.leave.entity.ApprovalStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveApprovalResponse {
    private UUID id;
    private UUID approverId;
    private String approverName;
    private String approverEmail;
    private Integer stepOrder;
    private ApprovalStatus status;
    private String comments;
    private OffsetDateTime actionedAt;
}
