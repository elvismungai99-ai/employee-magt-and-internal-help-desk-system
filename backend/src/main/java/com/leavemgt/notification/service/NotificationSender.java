package com.leavemgt.notification.service;

import com.leavemgt.platform.entity.Notification;
import com.leavemgt.platform.entity.NotificationChannel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@Slf4j
public class NotificationSender {

    private final AtomicBoolean simulateFailure = new AtomicBoolean(false);
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final HttpClient httpClient;

    @Value("${app.notification.from-email:noreply@company.com}")
    private String fromEmail;

    @Value("${app.notification.slack-webhook-url:}")
    private String slackWebhookUrl;

    public NotificationSender(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public void setSimulateFailure(boolean fail) {
        this.simulateFailure.set(fail);
    }

    public boolean isSimulateFailure() {
        return this.simulateFailure.get();
    }

    /**
     * Sends the notification across the specified channel (Email, Slack).
     * Dispatches real email if JavaMailSender is configured, or sends to Slack webhook.
     * Throws an exception on delivery failure.
     */
    public void send(Notification notification) throws Exception {
        if (simulateFailure.get()) {
            log.warn("Simulated delivery failure for notification {} (channel={})",
                    notification.getId(), notification.getChannel());
            throw new RuntimeException("Simulated notification delivery failure across channel " + notification.getChannel());
        }

        String recipientEmail = notification.getRecipient() != null ? notification.getRecipient().getEmail() : null;

        if (notification.getChannel() == NotificationChannel.EMAIL) {
            JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
            if (mailSender != null && recipientEmail != null && !recipientEmail.isBlank()) {
                try {
                    SimpleMailMessage mailMessage = new SimpleMailMessage();
                    mailMessage.setFrom(fromEmail);
                    mailMessage.setTo(recipientEmail);
                    mailMessage.setSubject("Internal System Notification");
                    mailMessage.setText(notification.getMessage());
                    mailSender.send(mailMessage);
                    log.info("Sent real SMTP email to {}", recipientEmail);
                } catch (Exception e) {
                    log.error("Failed to send SMTP email to {}: {}", recipientEmail, e.getMessage());
                    throw e;
                }
            } else {
                log.info("DISPATCHED [EMAIL] notification to {} (SMTP not configured, logged only): {}",
                        recipientEmail != null ? recipientEmail : "SYSTEM",
                        notification.getMessage());
            }
        } else if (notification.getChannel() == NotificationChannel.SLACK) {
            if (slackWebhookUrl != null && !slackWebhookUrl.isBlank()) {
                try {
                    String escapedMsg = notification.getMessage()
                            .replace("\"", "\\\"")
                            .replace("\n", "\\n");
                    String jsonBody = "{\"text\":\"" + escapedMsg + "\"}";
                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(slackWebhookUrl))
                            .header("Content-Type", "application/json")
                            .timeout(Duration.ofSeconds(10))
                            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    if (response.statusCode() >= 400) {
                        log.warn("Slack webhook returned error code {}: {}", response.statusCode(), response.body());
                    } else {
                        log.info("Successfully posted notification to Slack webhook");
                    }
                } catch (Exception e) {
                    log.error("Failed to send Slack webhook notification: {}", e.getMessage());
                    throw e;
                }
            } else {
                log.info("DISPATCHED [SLACK] notification to {} (Slack webhook not configured, logged only): {}",
                        recipientEmail != null ? recipientEmail : "SYSTEM",
                        notification.getMessage());
            }
        } else {
            log.info("DISPATCHED [{}] notification to {}: {}",
                    notification.getChannel(),
                    recipientEmail != null ? recipientEmail : "SYSTEM",
                    notification.getMessage());
        }
    }
}
