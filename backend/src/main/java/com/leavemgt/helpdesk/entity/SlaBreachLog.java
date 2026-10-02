package com.leavemgt.helpdesk.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "sla_breach_logs", schema = "helpdesk")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlaBreachLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sla_policy_id")
    private SlaPolicy slaPolicy;

    @Enumerated(EnumType.STRING)
    @Column(name = "breach_type", nullable = false, length = 50)
    private BreachType breachType;

    @CreationTimestamp
    @Column(name = "breached_at", nullable = false, updatable = false)
    private OffsetDateTime breachedAt;

    @Column(name = "notification_sent", nullable = false)
    @Builder.Default
    private Boolean notificationSent = false;

    @Column(name = "escalated_at")
    private OffsetDateTime escalatedAt;
}
