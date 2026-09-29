package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.QueueMember;
import com.leavemgt.helpdesk.entity.QueueMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface QueueMemberRepository extends JpaRepository<QueueMember, QueueMemberId> {

    List<QueueMember> findByQueueIdAndIsActiveTrue(UUID queueId);

    List<QueueMember> findByAgentUserIdAndIsActiveTrue(UUID agentUserId);

    @Query("SELECT CASE WHEN COUNT(qm) > 0 THEN TRUE ELSE FALSE END FROM QueueMember qm WHERE qm.id.queueId = :queueId AND qm.id.agentUserId = :agentUserId AND qm.isActive = true")
    boolean isAgentActiveInQueue(@Param("queueId") UUID queueId, @Param("agentUserId") UUID agentUserId);

    @Modifying
    @Transactional
    @Query("DELETE FROM QueueMember qm WHERE qm.agentUser.id IN :userIds OR (qm.assignedBy IS NOT NULL AND qm.assignedBy.id IN :userIds)")
    void deleteAllByRelatedUserIds(@Param("userIds") Collection<UUID> userIds);
}
