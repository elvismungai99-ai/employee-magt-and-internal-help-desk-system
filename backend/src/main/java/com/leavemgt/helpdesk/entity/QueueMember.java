package com.leavemgt.helpdesk.entity;

import com.leavemgt.identity.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "queue_members", schema = "helpdesk")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueueMember {

    @EmbeddedId
    private QueueMemberId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("queueId")
    @JoinColumn(name = "queue_id", nullable = false)
    private SupportQueue queue;

    @ManyToOne(fetch = FetchType.EAGER)
    @MapsId("agentUserId")
    @JoinColumn(name = "agent_user_id", nullable = false)
    private User agentUser;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "assigned_at", nullable = false, updatable = false)
    private OffsetDateTime assignedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assigned_by")
    private User assignedBy;
}
