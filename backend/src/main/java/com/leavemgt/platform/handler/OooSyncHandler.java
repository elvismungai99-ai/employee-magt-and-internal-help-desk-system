package com.leavemgt.platform.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.helpdesk.entity.Ticket;
import com.leavemgt.helpdesk.entity.TicketRoutingHistory;
import com.leavemgt.helpdesk.entity.TicketStatus;
import com.leavemgt.helpdesk.repository.TicketRepository;
import com.leavemgt.helpdesk.repository.TicketRoutingHistoryRepository;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.entity.LeaveRequest;
import com.leavemgt.leave.entity.OooSyncStatus;
import com.leavemgt.leave.entity.OutOfOfficeRecord;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import com.leavemgt.leave.repository.OutOfOfficeRecordRepository;
import com.leavemgt.platform.entity.EventOutbox;
import com.leavemgt.platform.service.EventPublisherService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
public class OooSyncHandler implements DomainEventHandler {

    private final OutOfOfficeRecordRepository oooRecordRepository;
    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;
    private final TicketRepository ticketRepository;
    private final TicketRoutingHistoryRepository routingHistoryRepository;
    private final EventPublisherService eventPublisherService;
    private final ObjectMapper objectMapper;

    public OooSyncHandler(OutOfOfficeRecordRepository oooRecordRepository,
                          LeaveRequestRepository leaveRequestRepository,
                          UserRepository userRepository,
                          TicketRepository ticketRepository,
                          TicketRoutingHistoryRepository routingHistoryRepository,
                          EventPublisherService eventPublisherService,
                          ObjectMapper objectMapper) {
        this.oooRecordRepository = oooRecordRepository;
        this.leaveRequestRepository = leaveRequestRepository;
        this.userRepository = userRepository;
        this.ticketRepository = ticketRepository;
        this.routingHistoryRepository = routingHistoryRepository;
        this.eventPublisherService = eventPublisherService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean canHandle(String eventType) {
        return "LeaveApproved".equalsIgnoreCase(eventType) || "LeaveCancelled".equalsIgnoreCase(eventType);
    }

    @Override
    @Transactional
    public void handle(EventOutbox event) throws Exception {
        if ("LeaveApproved".equalsIgnoreCase(event.getEventType())) {
            handleLeaveApproved(event);
        } else if ("LeaveCancelled".equalsIgnoreCase(event.getEventType())) {
            handleLeaveCancelled(event);
        }
    }

    private void handleLeaveApproved(EventOutbox event) throws Exception {
        // 1. Idempotency guard: check if already processed for this event ID
        if (oooRecordRepository.existsBySourceEventId(event.getId())) {
            log.info("Event {} already processed by OooSyncHandler. Skipping duplicate.", event.getId());
            return;
        }

        JsonNode payload = objectMapper.readTree(event.getPayload());
        UUID employeeId = UUID.fromString(payload.get("employeeId").asText());
        UUID leaveRequestId = UUID.fromString(payload.get("leaveRequestId").asText());
        LocalDate startDate = LocalDate.parse(payload.get("startDate").asText());
        LocalDate endDate = LocalDate.parse(payload.get("endDate").asText());

        LeaveRequest leaveRequest = leaveRequestRepository.findById(leaveRequestId)
                .orElseThrow(() -> new IllegalStateException("LeaveRequest not found: " + leaveRequestId));
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalStateException("User not found: " + employeeId));

        UUID delegateId = null;
        if (payload.has("delegateId") && !payload.get("delegateId").asText().isBlank()) {
            try {
                delegateId = UUID.fromString(payload.get("delegateId").asText());
            } catch (Exception ignored) {}
        }
        User delegate = delegateId != null ? userRepository.findById(delegateId).orElse(null) : null;

        // 2. Insert OutOfOfficeRecord tagged with source_event_id and delegate
        OutOfOfficeRecord oooRecord = OutOfOfficeRecord.builder()
                .leaveRequest(leaveRequest)
                .user(employee)
                .delegate(delegate)
                .startDate(startDate)
                .endDate(endDate)
                .syncStatus(OooSyncStatus.SYNCED)
                .sourceEventId(event.getId())
                .build();
        oooRecordRepository.save(oooRecord);
        log.info("Created OutOfOfficeRecord for employee {} ({} to {}, delegate={}) linked to event {}",
                employee.getEmail(), startDate, endDate, delegate != null ? delegate.getEmail() : "NONE", event.getId());

        // 3. Reroute open tickets assigned to employee (transfers to delegate if active and not OOO, else returns to queue)
        int reroutedCount = rerouteOpenTicketsForEmployee(employeeId, employee.getEmail(), "OOO_REROUTE", delegate);
        log.info("OOO sync processed for employee {}: {} ticket(s) re-routed", employee.getEmail(), reroutedCount);
    }

    /**
     * Daily background sweep that ensures any agent currently out of office on this date
     * does not have active tickets assigned to them (e.g. if assigned in the interim).
     */
    @org.springframework.scheduling.annotation.Scheduled(cron = "${app.scheduling.ooo-sweep-cron:0 0 6 * * *}")
    @Transactional
    public int sweepActiveOooRecords() {
        LocalDate today = LocalDate.now();
        List<OutOfOfficeRecord> activeRecords = oooRecordRepository
                .findBySyncStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                        OooSyncStatus.SYNCED, today, today);

        if (activeRecords.isEmpty()) {
            return 0;
        }

        int totalRerouted = 0;
        for (OutOfOfficeRecord record : activeRecords) {
            if (record.getUser() != null) {
                totalRerouted += rerouteOpenTicketsForEmployee(
                        record.getUser().getId(),
                        record.getUser().getEmail(),
                        "OOO_DAILY_SWEEP",
                        record.getDelegate()
                );
            }
        }

        if (totalRerouted > 0) {
            log.info("Daily OOO sweep completed: rerouted {} ticket(s) across {} active OOO agent(s)",
                    totalRerouted, activeRecords.size());
        }
        return totalRerouted;
    }

    /**
     * Atomically transfers open tickets for an OOO employee to their designated coverage delegate,
     * or unassigns them back to queue triage if no delegate is available.
     */
    public int rerouteOpenTicketsForEmployee(UUID employeeId, String employeeEmail, String reason, User delegate) {
        List<Ticket> openTickets = ticketRepository.findOpenTicketsByAssignedAgentId(
                employeeId,
                List.of(TicketStatus.RESOLVED, TicketStatus.CLOSED)
        );

        LocalDate today = LocalDate.now();
        boolean canAssignToDelegate = delegate != null
                && "ACTIVE".equalsIgnoreCase(delegate.getStatus())
                && !oooRecordRepository.isUserCurrentlyOoo(delegate.getId(), OooSyncStatus.SYNCED, today);

        for (Ticket ticket : openTickets) {
            User previousAgent = ticket.getAssignedAgent();

            if (canAssignToDelegate) {
                // Transfer ownership directly to nominated coverage delegate
                ticket.setAssignedAgent(delegate);
                ticket.setStatus(TicketStatus.ASSIGNED);
                ticketRepository.save(ticket);

                String delegateReason = "Reassigned to designated coverage delegate (" + delegate.getFullName() + ") while " + employeeEmail + " is on approved leave";
                TicketRoutingHistory history = TicketRoutingHistory.builder()
                        .ticket(ticket)
                        .previousAgent(previousAgent)
                        .newAgent(delegate)
                        .reason(delegateReason)
                        .changedBy(previousAgent)
                        .build();
                routingHistoryRepository.save(history);

                log.info("Transferred ticket {} from OOO agent {} to delegate {}",
                        ticket.getTicketNumber(), employeeEmail, delegate.getEmail());

                eventPublisherService.publishEvent(
                        "TicketAssigned",
                        "HELPDESK",
                        Map.of(
                                "ticketId", ticket.getId().toString(),
                                "ticketNumber", ticket.getTicketNumber(),
                                "assignedAgentId", delegate.getId().toString(),
                                "assignedAgentName", delegate.getFullName(),
                                "reason", delegateReason
                        )
                );
            } else {
                // Return to queue triage
                ticket.setAssignedAgent(null);
                ticket.setStatus(TicketStatus.TRIAGED);
                ticketRepository.save(ticket);

                TicketRoutingHistory history = TicketRoutingHistory.builder()
                        .ticket(ticket)
                        .previousAgent(previousAgent)
                        .newAgent(null)
                        .reason(reason)
                        .changedBy(previousAgent)
                        .build();
                routingHistoryRepository.save(history);

                log.info("Unassigned ticket {} from OOO agent {} (reason={}): status set to TRIAGED",
                        ticket.getTicketNumber(), employeeEmail, reason);

                eventPublisherService.publishEvent(
                        "TicketUnassigned",
                        "HELPDESK",
                        Map.of(
                                "ticketId", ticket.getId().toString(),
                                "ticketNumber", ticket.getTicketNumber(),
                                "queueId", ticket.getQueue() != null ? ticket.getQueue().getId().toString() : "",
                                "previousAgentId", employeeId.toString(),
                                "reason", reason
                        )
                );
            }
        }
        return openTickets.size();
    }

    private void handleLeaveCancelled(EventOutbox event) throws Exception {
        JsonNode payload = objectMapper.readTree(event.getPayload());
        UUID leaveRequestId = UUID.fromString(payload.get("leaveRequestId").asText());

        List<OutOfOfficeRecord> records = oooRecordRepository.findByLeaveRequestId(leaveRequestId);
        for (OutOfOfficeRecord record : records) {
            record.setSyncStatus(OooSyncStatus.REVOKED);
            oooRecordRepository.save(record);
            log.info("Revoked OutOfOfficeRecord {} for cancelled leave request {}", record.getId(), leaveRequestId);
        }
    }
}
