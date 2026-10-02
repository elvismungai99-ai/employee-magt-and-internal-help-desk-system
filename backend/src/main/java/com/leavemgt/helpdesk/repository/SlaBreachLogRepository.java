package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.BreachType;
import com.leavemgt.helpdesk.entity.SlaBreachLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SlaBreachLogRepository extends JpaRepository<SlaBreachLog, UUID> {

    boolean existsByTicketIdAndBreachType(UUID ticketId, BreachType breachType);

    List<SlaBreachLog> findByTicketId(UUID ticketId);

    long countByBreachType(BreachType breachType);
}
