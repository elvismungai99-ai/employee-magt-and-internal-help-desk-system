package com.leavemgt.helpdesk.engine;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlaMonitorRunResult {
    private OffsetDateTime executedAt;
    private String status;
    private int ticketsChecked;
    private int breachesDetected;
    private String message;
}
