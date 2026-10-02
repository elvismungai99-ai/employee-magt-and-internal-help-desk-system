package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, UUID> {

    Optional<Ticket> findByTicketNumber(String ticketNumber);

    List<Ticket> findByRequesterIdOrderByCreatedAtDesc(UUID requesterId);

    List<Ticket> findByQueueIdOrderByCreatedAtDesc(UUID queueId);

    @Query("SELECT t FROM Ticket t WHERE t.queue.id IN :queueIds ORDER BY t.createdAt DESC")
    List<Ticket> findByQueueIdInOrderByCreatedAtDesc(@Param("queueIds") Collection<UUID> queueIds);

    @Query(value = "SELECT 'TICK-' || nextval('helpdesk.ticket_number_seq')", nativeQuery = true)
    String generateNextTicketNumber();

    boolean existsByTicketNumber(String ticketNumber);

    @Query("SELECT t FROM Ticket t WHERE t.assignedAgent.id = :agentId AND t.status NOT IN :terminalStatuses")
    List<Ticket> findOpenTicketsByAssignedAgentId(@Param("agentId") UUID agentId, @Param("terminalStatuses") Collection<com.leavemgt.helpdesk.entity.TicketStatus> terminalStatuses);

    @Query("SELECT t FROM Ticket t WHERE t.slaDueAt < :now AND t.status NOT IN :terminalStatuses AND (t.slaBreached IS NULL OR t.slaBreached = false)")
    List<Ticket> findBreachedTickets(@Param("now") java.time.OffsetDateTime now, @Param("terminalStatuses") Collection<com.leavemgt.helpdesk.entity.TicketStatus> terminalStatuses);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Ticket t SET t.slaBreached = true WHERE t.id = :ticketId AND (t.slaBreached IS NULL OR t.slaBreached = false)")
    int markSlaBreachedIfUnmarked(@Param("ticketId") UUID ticketId);
}
