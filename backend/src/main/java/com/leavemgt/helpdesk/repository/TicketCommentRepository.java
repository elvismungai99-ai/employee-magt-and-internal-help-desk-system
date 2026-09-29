package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.TicketComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TicketCommentRepository extends JpaRepository<TicketComment, UUID> {

    List<TicketComment> findByTicketIdOrderByCreatedAtAsc(UUID ticketId);

    List<TicketComment> findByTicketIdAndIsInternalNoteFalseOrderByCreatedAtAsc(UUID ticketId);
}
