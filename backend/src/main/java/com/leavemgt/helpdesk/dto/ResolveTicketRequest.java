package com.leavemgt.helpdesk.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResolveTicketRequest {
    private String resolutionNotes;
}
