package com.leavemgt.platform.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.helpdesk.entity.Ticket;
import com.leavemgt.helpdesk.entity.TicketStatus;
import com.leavemgt.helpdesk.repository.TicketRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.entity.EncashmentStatus;
import com.leavemgt.leave.entity.LeaveEncashmentRequest;
import com.leavemgt.leave.entity.LeaveRequest;
import com.leavemgt.leave.entity.LeaveRequestStatus;
import com.leavemgt.leave.repository.CompOffRequestRepository;
import com.leavemgt.leave.repository.LeaveEncashmentRequestRepository;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import com.leavemgt.platform.dto.ExecutiveAnalyticsSummary;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
@Slf4j
@org.springframework.transaction.annotation.Transactional(readOnly = true)
public class AdminAnalyticsController {

    private final UserRepository userRepository;
    private final LeaveRequestRepository leaveRequestRepository;
    private final CompOffRequestRepository compOffRequestRepository;
    private final LeaveEncashmentRequestRepository encashmentRepository;
    private final TicketRepository ticketRepository;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<ExecutiveAnalyticsSummary>> getExecutiveSummary() {
        try {
            LocalDate today = LocalDate.now();

            long totalEmployees = userRepository.count();

            long activeLeavesToday = leaveRequestRepository.countActiveLeavesOnDate(LeaveRequestStatus.APPROVED, today);
            long pendingLeaves = leaveRequestRepository.countByStatus(LeaveRequestStatus.PENDING);

            long pendingCompOff = compOffRequestRepository.countByStatus(com.leavemgt.leave.entity.CompOffStatus.PENDING);

            long pendingEncashments = encashmentRepository.countByStatus(EncashmentStatus.PENDING);
            BigDecimal totalApprovedDays = encashmentRepository.sumDaysRequestedByStatus(EncashmentStatus.APPROVED);
            if (totalApprovedDays == null) {
                totalApprovedDays = BigDecimal.ZERO;
            }

            List<Ticket> allTickets = ticketRepository.findAllWithCategory();
            long totalTickets = allTickets.size();

            long openTickets = allTickets.stream()
                    .filter(t -> t != null && t.getStatus() != TicketStatus.RESOLVED && t.getStatus() != TicketStatus.CLOSED)
                    .count();

            long resolvedTickets = allTickets.stream()
                    .filter(t -> t != null && (t.getStatus() == TicketStatus.RESOLVED || t.getStatus() == TicketStatus.CLOSED))
                    .count();

            long breachedTickets = allTickets.stream()
                    .filter(t -> t != null && Boolean.TRUE.equals(t.getSlaBreached()))
                    .count();

            double slaCompliance = totalTickets > 0
                    ? Math.round(((double) (totalTickets - breachedTickets) / totalTickets * 100.0) * 10.0) / 10.0
                    : 100.0;

            List<Ticket> ratedTickets = allTickets.stream()
                    .filter(t -> t != null && t.getCsatRating() != null && t.getCsatRating() > 0)
                    .toList();

            Double avgCsat = ratedTickets.isEmpty()
                    ? null
                    : Math.round(ratedTickets.stream().mapToInt(Ticket::getCsatRating).average().orElse(0.0) * 10.0) / 10.0;

            Map<String, Long> byPriority = allTickets.stream()
                    .filter(t -> t != null && t.getPriority() != null)
                    .collect(Collectors.groupingBy(t -> t.getPriority().name(), Collectors.counting()));

            Map<String, Long> byCategory = allTickets.stream()
                    .filter(t -> t != null && t.getCategory() != null && t.getCategory().getName() != null)
                    .collect(Collectors.groupingBy(t -> t.getCategory().getName(), Collectors.counting()));

            ExecutiveAnalyticsSummary summary = ExecutiveAnalyticsSummary.builder()
                    .totalEmployees(totalEmployees)
                    .activeLeavesToday(activeLeavesToday)
                    .pendingLeaveRequests(pendingLeaves)
                    .pendingCompOffClaims(pendingCompOff)
                    .pendingEncashmentClaims(pendingEncashments)
                    .totalApprovedEncashmentDays(totalApprovedDays)
                    .totalTickets(totalTickets)
                    .openTickets(openTickets)
                    .resolvedTickets(resolvedTickets)
                    .breachedTickets(breachedTickets)
                    .slaCompliancePercentage(slaCompliance)
                    .averageCsatRating(avgCsat)
                    .totalCsatResponses(ratedTickets.size())
                    .ticketsByPriority(byPriority)
                    .ticketsByCategory(byCategory)
                    .build();

            return ResponseEntity.ok(ApiResponse.success(summary, "Executive analytics retrieved successfully"));
        } catch (Exception e) {
            log.error("Failed to compile executive analytics summary: {}", e.getMessage(), e);
            ExecutiveAnalyticsSummary fallback = ExecutiveAnalyticsSummary.builder()
                    .totalEmployees(userRepository.count())
                    .slaCompliancePercentage(100.0)
                    .ticketsByPriority(Collections.emptyMap())
                    .ticketsByCategory(Collections.emptyMap())
                    .build();
            return ResponseEntity.ok(ApiResponse.success(fallback, "Executive analytics fallback summary"));
        }
    }
}
