package com.leavemgt.helpdesk.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.helpdesk.entity.BreachType;
import com.leavemgt.helpdesk.entity.SlaBreachLog;
import com.leavemgt.helpdesk.entity.Ticket;
import com.leavemgt.helpdesk.entity.TicketStatus;
import com.leavemgt.helpdesk.repository.SlaBreachLogRepository;
import com.leavemgt.helpdesk.repository.TicketRepository;
import com.leavemgt.platform.service.EventPublisherService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

@Component
@Slf4j
public class SlaBreachMonitorEngine {

    private final TicketRepository ticketRepository;
    private final SlaBreachLogRepository breachLogRepository;
    private final EventPublisherService eventPublisherService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    private final AtomicReference<SlaMonitorRunResult> lastRun = new AtomicReference<>(null);

    public SlaBreachMonitorEngine(TicketRepository ticketRepository,
                                  SlaBreachLogRepository breachLogRepository,
                                  EventPublisherService eventPublisherService,
                                  ObjectMapper objectMapper,
                                  PlatformTransactionManager transactionManager) {
        this.ticketRepository = ticketRepository;
        this.breachLogRepository = breachLogRepository;
        this.eventPublisherService = eventPublisherService;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public SlaMonitorRunResult getLastRun() {
        return lastRun.get();
    }

    @Scheduled(fixedRateString = "${app.scheduling.sla-monitor-rate-ms:60000}")
    public SlaMonitorRunResult sweepBreachedTickets() {
        OffsetDateTime startTime = OffsetDateTime.now();
        List<Ticket> breachedTickets = ticketRepository.findBreachedTickets(
                startTime,
                List.of(TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.PENDING_USER)
        );

        int checkedCount = breachedTickets.size();
        int breachesProcessed = 0;

        for (Ticket ticket : breachedTickets) {
            boolean processed = processBreach(ticket.getId(), startTime);
            if (processed) {
                breachesProcessed++;
            }
        }

        String message = String.format("Checked %d overdue tickets; flagged and published %d new SLA breach event(s)",
                checkedCount, breachesProcessed);

        SlaMonitorRunResult result = SlaMonitorRunResult.builder()
                .executedAt(startTime)
                .status("SUCCESS")
                .ticketsChecked(checkedCount)
                .breachesDetected(breachesProcessed)
                .message(message)
                .build();

        lastRun.set(result);
        if (breachesProcessed > 0) {
            log.info("SLA breach sweep completed: {}", message);
        }

        return result;
    }

    /**
     * Atomically flags a single ticket as breached, logs the breach, and publishes an SLABreached event.
     * Guaranteed idempotent by checking affected rows from UPDATE ... WHERE sla_breached = false.
     */
    public boolean processBreach(UUID ticketId, OffsetDateTime now) {
        return Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            // Atomic update guard to prevent race condition across concurrent runs
            int updatedRows = ticketRepository.markSlaBreachedIfUnmarked(ticketId);
            if (updatedRows == 0) {
                log.debug("Ticket {} already marked as sla_breached by concurrent sweep. Skipping.", ticketId);
                return false;
            }

            Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
            if (ticket == null) {
                return false;
            }

            // Insert SlaBreachLog
            SlaBreachLog breachLog = SlaBreachLog.builder()
                    .ticket(ticket)
                    .slaPolicy(ticket.getSlaPolicy())
                    .breachType(BreachType.RESOLUTION)
                    .breachedAt(now)
                    .notificationSent(false)
                    .build();
            breachLogRepository.save(breachLog);

            // Parse escalation rules if present
            String escalateToRole = "HR_ADMIN";
            List<String> notifyChannels = List.of("EMAIL", "SLACK");

            if (ticket.getSlaPolicy() != null && ticket.getSlaPolicy().getEscalationRuleJson() != null) {
                try {
                    JsonNode ruleNode = objectMapper.readTree(ticket.getSlaPolicy().getEscalationRuleJson());
                    if (ruleNode.has("escalate_to_role")) {
                        escalateToRole = ruleNode.get("escalate_to_role").asText();
                    }
                    if (ruleNode.has("notify_channels") && ruleNode.get("notify_channels").isArray()) {
                        List<String> parsedChannels = new ArrayList<>();
                        ruleNode.get("notify_channels").forEach(ch -> parsedChannels.add(ch.asText()));
                        if (!parsedChannels.isEmpty()) {
                            notifyChannels = parsedChannels;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Could not parse escalation rule JSON for ticket {}: {}", ticket.getTicketNumber(), e.getMessage());
                }
            }

            // Publish SLABreached event to platform.event_outbox in the same transaction
            Map<String, Object> payload = new HashMap<>();
            payload.put("ticketId", ticket.getId().toString());
            payload.put("ticketNumber", ticket.getTicketNumber());
            payload.put("priority", ticket.getPriority().name());
            payload.put("queueId", ticket.getQueue() != null ? ticket.getQueue().getId().toString() : "");
            payload.put("assignedAgentId", ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getId().toString() : "");
            payload.put("breachType", BreachType.RESOLUTION.name());
            payload.put("slaDueAt", ticket.getSlaDueAt() != null ? ticket.getSlaDueAt().toString() : now.toString());
            payload.put("escalateToRole", escalateToRole);
            payload.put("notifyChannels", notifyChannels);

            eventPublisherService.publishEvent("SLABreached", "HELPDESK", payload);
            log.warn("Flagged ticket {} as SLA BREACHED [dueAt={}] and published event", ticket.getTicketNumber(), ticket.getSlaDueAt());
            return true;
        }));
    }
}
