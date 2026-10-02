package com.leavemgt.notification.service;

import com.leavemgt.platform.entity.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;

@Service
@Slf4j
public class NotificationSender {

    private final AtomicBoolean simulateFailure = new AtomicBoolean(false);

    public void setSimulateFailure(boolean fail) {
        this.simulateFailure.set(fail);
    }

    public boolean isSimulateFailure() {
        return this.simulateFailure.get();
    }

    /**
     * Sends the notification across the specified channel (Email, Slack).
     * Throws an exception on delivery failure.
     */
    public void send(Notification notification) throws Exception {
        if (simulateFailure.get()) {
            log.warn("Simulated delivery failure for notification {} (channel={})",
                    notification.getId(), notification.getChannel());
            throw new RuntimeException("Simulated notification delivery failure across channel " + notification.getChannel());
        }

        log.info("DISPATCHED [{}] notification to {}: {}",
                notification.getChannel(),
                notification.getRecipient() != null ? notification.getRecipient().getEmail() : "SYSTEM",
                notification.getMessage());
    }
}
