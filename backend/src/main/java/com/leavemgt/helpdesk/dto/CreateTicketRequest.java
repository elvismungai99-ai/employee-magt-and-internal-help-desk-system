package com.leavemgt.helpdesk.dto;

import com.leavemgt.helpdesk.entity.TicketPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateTicketRequest {

    @NotNull(message = "Category ID is required")
    private UUID categoryId;

    private UUID queueId;

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Description is required")
    private String description;

    private TicketPriority priority;

    private UUID leaveRequestId;
}
