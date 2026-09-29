package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.SlaPolicy;
import com.leavemgt.helpdesk.entity.TicketPriority;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SlaPolicyRepository extends JpaRepository<SlaPolicy, UUID> {

    List<SlaPolicy> findAllByIsActiveTrueOrderByPriorityAsc();

    List<SlaPolicy> findAllByOrderByPriorityAsc();

    Optional<SlaPolicy> findByPriority(TicketPriority priority);

    Optional<SlaPolicy> findByPriorityAndIsActiveTrue(TicketPriority priority);

    Optional<SlaPolicy> findByName(String name);

    boolean existsByPriority(TicketPriority priority);

    boolean existsByName(String name);
}
