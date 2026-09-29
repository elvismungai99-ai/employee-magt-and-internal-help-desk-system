package com.leavemgt.helpdesk.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueueMemberId implements Serializable {

    @Column(name = "queue_id")
    private UUID queueId;

    @Column(name = "agent_user_id")
    private UUID agentUserId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        QueueMemberId that = (QueueMemberId) o;
        return Objects.equals(queueId, that.queueId) && Objects.equals(agentUserId, that.agentUserId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(queueId, agentUserId);
    }
}
