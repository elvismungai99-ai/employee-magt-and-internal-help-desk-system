package com.leavemgt.helpdesk.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloseTicketRequest {
    private String feedback;
}
