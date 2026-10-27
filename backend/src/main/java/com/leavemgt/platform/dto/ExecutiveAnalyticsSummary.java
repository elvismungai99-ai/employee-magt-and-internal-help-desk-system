package com.leavemgt.platform.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutiveAnalyticsSummary {
    private long totalEmployees;
    private long activeLeavesToday;
    private long pendingLeaveRequests;
    private long pendingCompOffClaims;
    private long pendingEncashmentClaims;
    private BigDecimal totalApprovedEncashmentDays;

    private long totalTickets;
    private long openTickets;
    private long resolvedTickets;
    private long breachedTickets;
    private double slaCompliancePercentage;
    private Double averageCsatRating;
    private long totalCsatResponses;

    private Map<String, Long> ticketsByPriority;
    private Map<String, Long> ticketsByCategory;
}
