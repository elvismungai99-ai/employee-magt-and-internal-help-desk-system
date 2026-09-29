package com.leavemgt.helpdesk.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignTicketRequest {

    @NotNull(message = "Agent User ID is required")
    private UUID agentUserId;

    private String reason;
}
