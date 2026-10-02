package com.leavemgt.leave.engine;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccrualRunResult {
    private OffsetDateTime executedAt;
    private int year;
    private int month;
    private String triggeredBy;
    private String status;
    private int usersProcessed;
    private int balancesAccrued;
    private int skippedCount;
    private int failureCount;
    private String message;
}
