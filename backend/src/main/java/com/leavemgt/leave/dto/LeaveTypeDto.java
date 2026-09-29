package com.leavemgt.leave.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveTypeDto {
    private UUID id;
    private String name;
    private String code;
    private String description;
    private Boolean isPaid;
    private Boolean requiresAttachment;
    private Boolean isActive;
}
