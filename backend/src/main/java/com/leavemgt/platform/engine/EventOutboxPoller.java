package com.leavemgt.platform.engine;

import com.leavemgt.notification.service.NotificationDispatcher;
import com.leavemgt.platform.entity.EventOutbox;
import com.leavemgt.platform.entity.OutboxStatus;
import com.leavemgt.platform.handler.DomainEventHandler;
import com.leavemgt.platform.repository.EventOutboxRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.List;

@Component
@Slf4j
public class EventOutboxPoller {

    private final EventOutboxRepository outboxRepository;
    private final List<DomainEventHandler> eventHandlers;
    private final NotificationDispatcher notificationDispatcher;
    private final TransactionTemplate transactionTemplate;

    public EventOutboxPoller(EventOutboxRepository outboxRepository,
                             List<DomainEventHandler> eventHandlers,
                             NotificationDispatcher notificationDispatcher,
                             PlatformTransactionManager transactionManager) {
        this.outboxRepository = outboxRepository;
        this.eventHandlers = eventHandlers;
        this.notificationDispatcher = notificationDispatcher;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedDelayString = "${app.scheduling.outbox-poll-interval-ms:5000}")
    public int pollAndProcess() {
        List<EventOutbox> pendingEvents = outboxRepository.findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus.PENDING);
        if (pendingEvents.isEmpty()) {
            return 0;
        }

        log.debug("Found {} pending outbox event(s) to process", pendingEvents.size());
        int processedCount = 0;

        for (EventOutbox pending : pendingEvents) {
            boolean success = processSingleEvent(pending.getId());
            if (success) {
                processedCount++;
            }
        }

        // Retry any previously failed notifications
        try {
            notificationDispatcher.retryFailedNotifications();
        } catch (Exception e) {
            log.warn("Error retrying failed notifications: {}", e.getMessage());
        }

        return processedCount;
    }

    /**
     * Processes a single event in its own isolated transaction to prevent batch failures.
     */
    public boolean processSingleEvent(java.util.UUID eventId) {
        return Boolean.TRUE.equals(transactionTemplate.execute(status -> {
            EventOutbox event = outboxRepository.findById(eventId).orElse(null);
            if (event == null || event.getStatus() != OutboxStatus.PENDING) {
                return false;
            }

            event.setStatus(OutboxStatus.PROCESSING);
            outboxRepository.saveAndFlush(event);

            try {
                for (DomainEventHandler handler : eventHandlers) {
                    if (handler.canHandle(event.getEventType())) {
                        handler.handle(event);
                    }
                }

                event.setStatus(OutboxStatus.PUBLISHED);
                event.setPublishedAt(OffsetDateTime.now());
                outboxRepository.save(event);
                log.info("Successfully published outbox event [id={}, type={}]", event.getId(), event.getEventType());
                return true;
            } catch (Exception e) {
                log.error("Failed to process outbox event [id={}, type={}]: {}", event.getId(), event.getEventType(), e.getMessage(), e);
                event.setStatus(OutboxStatus.FAILED);
                outboxRepository.save(event);
                return false;
            }
        }));
    }
}
