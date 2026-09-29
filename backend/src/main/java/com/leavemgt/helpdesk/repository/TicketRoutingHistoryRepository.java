package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.TicketRoutingHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TicketRoutingHistoryRepository extends JpaRepository<TicketRoutingHistory, UUID> {

    List<TicketRoutingHistory> findByTicketIdOrderByCreatedAtAsc(UUID ticketId);
}
