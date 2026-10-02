package com.leavemgt.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.helpdesk.repository.QueueMemberRepository;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.platform.entity.EventOutbox;
import com.leavemgt.platform.entity.Notification;
import com.leavemgt.platform.entity.NotificationChannel;
import com.leavemgt.platform.entity.NotificationStatus;
import com.leavemgt.platform.handler.DomainEventHandler;
import com.leavemgt.platform.repository.NotificationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@Slf4j
public class NotificationDispatcher implements DomainEventHandler {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final QueueMemberRepository queueMemberRepository;
    private final NotificationSender notificationSender;
    private final ObjectMapper objectMapper;

    public NotificationDispatcher(NotificationRepository notificationRepository,
                                  UserRepository userRepository,
                                  QueueMemberRepository queueMemberRepository,
                                  NotificationSender notificationSender,
                                  ObjectMapper objectMapper) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.queueMemberRepository = queueMemberRepository;
        this.notificationSender = notificationSender;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean canHandle(String eventType) {
        return "LeaveApproved".equalsIgnoreCase(eventType)
                || "SLABreached".equalsIgnoreCase(eventType)
                || "TicketAssigned".equalsIgnoreCase(eventType)
                || "TicketUnassigned".equalsIgnoreCase(eventType);
    }

    @Override
    @Transactional
    public void handle(EventOutbox event) throws Exception {
        JsonNode payload = objectMapper.readTree(event.getPayload());
        String eventType = event.getEventType();

        if ("LeaveApproved".equalsIgnoreCase(eventType)) {
            dispatchLeaveApproved(event, payload);
        } else if ("SLABreached".equalsIgnoreCase(eventType)) {
            dispatchSlaBreached(event, payload);
        } else if ("TicketUnassigned".equalsIgnoreCase(eventType)) {
            dispatchTicketUnassigned(event, payload);
        } else if ("TicketAssigned".equalsIgnoreCase(eventType)) {
            dispatchTicketAssigned(event, payload);
        }
    }

    private void dispatchLeaveApproved(EventOutbox event, JsonNode payload) {
        UUID employeeId = UUID.fromString(payload.get("employeeId").asText());
        String startDate = payload.get("startDate").asText();
        String endDate = payload.get("endDate").asText();

        userRepository.findById(employeeId).ifPresent(employee -> {
            String message = "Your leave request for " + startDate + " to " + endDate + " has been approved.";
            createAndSend(employee, event, NotificationChannel.EMAIL, message);
        });
    }

    private void dispatchSlaBreached(EventOutbox event, JsonNode payload) {
        String ticketNumber = payload.get("ticketNumber").asText();
        String priority = payload.has("priority") ? payload.get("priority").asText() : "UNKNOWN";
        String message = "SLA BREACH ALERT: Ticket " + ticketNumber + " (" + priority + ") has exceeded its SLA resolution deadline.";

        Set<User> recipients = new HashSet<>();

        // If assigned to an agent, alert the agent
        if (payload.has("assignedAgentId") && !payload.get("assignedAgentId").isNull() && !payload.get("assignedAgentId").asText().isBlank()) {
            try {
                UUID agentId = UUID.fromString(payload.get("assignedAgentId").asText());
                userRepository.findById(agentId).ifPresent(recipients::add);
            } catch (Exception ignored) {}
        }

        // Alert HR admins / supervisors
        List<User> hrAdmins = userRepository.findByRoleName("HR_ADMIN");
        recipients.addAll(hrAdmins);

        // Also alert queue members if queueId is present
        if (payload.has("queueId") && !payload.get("queueId").isNull() && !payload.get("queueId").asText().isBlank()) {
            try {
                UUID queueId = UUID.fromString(payload.get("queueId").asText());
                queueMemberRepository.findByQueueIdAndIsActiveTrue(queueId)
                        .forEach(qm -> recipients.add(qm.getAgentUser()));
            } catch (Exception ignored) {}
        }

        for (User recipient : recipients) {
            createAndSend(recipient, event, NotificationChannel.EMAIL, message);
            createAndSend(recipient, event, NotificationChannel.SLACK, message);
        }
    }

    private void dispatchTicketUnassigned(EventOutbox event, JsonNode payload) {
        String ticketNumber = payload.get("ticketNumber").asText();
        String message = "Ticket " + ticketNumber + " has been returned to the queue due to agent out-of-office.";

        if (payload.has("queueId") && !payload.get("queueId").isNull() && !payload.get("queueId").asText().isBlank()) {
            try {
                UUID queueId = UUID.fromString(payload.get("queueId").asText());
                queueMemberRepository.findByQueueIdAndIsActiveTrue(queueId).forEach(qm -> {
                    createAndSend(qm.getAgentUser(), event, NotificationChannel.EMAIL, message);
                });
            } catch (Exception ignored) {}
        }
    }

    private void dispatchTicketAssigned(EventOutbox event, JsonNode payload) {
        String ticketNumber = payload.get("ticketNumber").asText();
        if (payload.has("agentId") && !payload.get("agentId").isNull()) {
            UUID agentId = UUID.fromString(payload.get("agentId").asText());
            userRepository.findById(agentId).ifPresent(agent -> {
                String message = "Ticket " + ticketNumber + " has been assigned to you.";
                createAndSend(agent, event, NotificationChannel.EMAIL, message);
            });
        }
    }

    private void createAndSend(User recipient, EventOutbox event, NotificationChannel channel, String message) {
        Notification notification = Notification.builder()
                .recipient(recipient)
                .event(event)
                .channel(channel)
                .message(message)
                .status(NotificationStatus.PENDING)
                .build();

        Notification saved = notificationRepository.save(notification);

        try {
            notificationSender.send(saved);
            saved.setStatus(NotificationStatus.SENT);
            saved.setSentAt(OffsetDateTime.now());
        } catch (Exception e) {
            log.warn("Failed to dispatch notification {} to {}: {}", saved.getId(), recipient.getEmail(), e.getMessage());
            saved.setStatus(NotificationStatus.FAILED);
        }

        notificationRepository.save(saved);
    }

    /**
     * Retries all notifications currently in FAILED status.
     * Called during polling cycles.
     */
    @Transactional
    public int retryFailedNotifications() {
        List<Notification> failedList = notificationRepository.findByStatus(NotificationStatus.FAILED);
        int recovered = 0;

        for (Notification n : failedList) {
            try {
                notificationSender.send(n);
                n.setStatus(NotificationStatus.SENT);
                n.setSentAt(OffsetDateTime.now());
                notificationRepository.save(n);
                recovered++;
                log.info("Successfully retried notification {}", n.getId());
            } catch (Exception e) {
                log.warn("Retry failed for notification {}: {}", n.getId(), e.getMessage());
            }
        }

        return recovered;
    }
}
