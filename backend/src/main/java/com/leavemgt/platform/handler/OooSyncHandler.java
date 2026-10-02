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

        // 2. Insert OutOfOfficeRecord tagged with source_event_id
        OutOfOfficeRecord oooRecord = OutOfOfficeRecord.builder()
                .leaveRequest(leaveRequest)
                .user(employee)
                .startDate(startDate)
                .endDate(endDate)
                .syncStatus(OooSyncStatus.SYNCED)
                .sourceEventId(event.getId())
                .build();
        oooRecordRepository.save(oooRecord);
        log.info("Created OutOfOfficeRecord for employee {} ({} to {}) linked to event {}",
                employee.getEmail(), startDate, endDate, event.getId());

        // 3. Query open tickets assigned to employee
        List<Ticket> openTickets = ticketRepository.findOpenTicketsByAssignedAgentId(
                employeeId,
                List.of(TicketStatus.RESOLVED, TicketStatus.CLOSED)
        );

        // 4. For each ticket, unassign and return to queue with OOO_REROUTE routing history
        for (Ticket ticket : openTickets) {
            User previousAgent = ticket.getAssignedAgent();
            ticket.setAssignedAgent(null);
            ticket.setStatus(TicketStatus.TRIAGED); // Back in queue ready for reassignment
            ticketRepository.save(ticket);

            TicketRoutingHistory history = TicketRoutingHistory.builder()
                    .ticket(ticket)
                    .previousAgent(previousAgent)
                    .newAgent(null)
                    .reason("OOO_REROUTE")
                    .changedBy(previousAgent)
                    .build();
            routingHistoryRepository.save(history);

            log.info("Unassigned ticket {} from OOO agent {}: status set to TRIAGED",
                    ticket.getTicketNumber(), employee.getEmail());

            // 5. Publish follow-up TicketUnassigned event for notifications
            eventPublisherService.publishEvent(
                    "TicketUnassigned",
                    "HELPDESK",
                    Map.of(
                            "ticketId", ticket.getId().toString(),
                            "ticketNumber", ticket.getTicketNumber(),
                            "queueId", ticket.getQueue() != null ? ticket.getQueue().getId().toString() : "",
                            "previousAgentId", employeeId.toString(),
                            "reason", "OOO_REROUTE"
                    )
            );
        }
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
