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

    // Frontend compatibility aliases for AdminDashboardPage
    public OffsetDateTime getRunAt() {
        return executedAt;
    }

    public int getProcessedCount() {
        return usersProcessed;
    }

    public int getSuccessCount() {
        return balancesAccrued;
    }

    public int getCarriedOverCount() {
        return balancesAccrued;
    }

    public int getExpiredCount() {
        return balancesAccrued;
    }
}
