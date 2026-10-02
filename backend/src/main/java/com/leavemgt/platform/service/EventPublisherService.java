package com.leavemgt.platform.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.platform.entity.EventOutbox;
import com.leavemgt.platform.entity.OutboxStatus;
import com.leavemgt.platform.repository.EventOutboxRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class EventPublisherService {

    private final EventOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public EventPublisherService(EventOutboxRepository outboxRepository, ObjectMapper objectMapper) {
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Publishes an event to platform.event_outbox.
     * Guaranteed to participate in the caller's active database transaction (MANDATORY or REQUIRED).
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public EventOutbox publishEvent(String eventType, String sourceDomain, Object payload) {
        try {
            String jsonPayload = (payload instanceof String) ? (String) payload : objectMapper.writeValueAsString(payload);
            EventOutbox outbox = EventOutbox.builder()
                    .eventType(eventType)
                    .sourceDomain(sourceDomain)
                    .payload(jsonPayload)
                    .status(OutboxStatus.PENDING)
                    .build();

            EventOutbox saved = outboxRepository.save(outbox);
            log.info("Published outbox event [id={}, type={}, domain={}]", saved.getId(), eventType, sourceDomain);
            return saved;
        } catch (Exception e) {
            log.error("Failed to serialize or save outbox event of type {}: {}", eventType, e.getMessage(), e);
            throw new RuntimeException("Failed to publish outbox event: " + e.getMessage(), e);
        }
    }
}
