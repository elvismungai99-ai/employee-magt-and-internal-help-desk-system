package com.leavemgt.platform.repository;

import com.leavemgt.platform.entity.EventOutbox;
import com.leavemgt.platform.entity.OutboxStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EventOutboxRepository extends JpaRepository<EventOutbox, UUID> {

    List<EventOutbox> findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus status);

    Page<EventOutbox> findByStatusOrderByCreatedAtDesc(OutboxStatus status, Pageable pageable);

    Page<EventOutbox> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByStatus(OutboxStatus status);
}
