package com.leavemgt.identity.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApproveRegistrationRequest {
    private UUID managerId;
    private UUID departmentId;
}
