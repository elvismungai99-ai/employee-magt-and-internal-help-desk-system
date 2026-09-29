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
}
