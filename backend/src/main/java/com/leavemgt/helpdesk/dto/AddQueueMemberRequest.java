package com.leavemgt.helpdesk.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddQueueMemberRequest {
    @NotNull(message = "Agent user ID is required")
    private UUID agentUserId;
}
