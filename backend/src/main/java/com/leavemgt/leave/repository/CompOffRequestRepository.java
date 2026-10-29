package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.CompOffRequest;
import com.leavemgt.leave.entity.CompOffStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface CompOffRequestRepository extends JpaRepository<CompOffRequest, UUID> {

    List<CompOffRequest> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<CompOffRequest> findByStatusOrderByCreatedAtDesc(CompOffStatus status);

    List<CompOffRequest> findAllByOrderByCreatedAtDesc();

    long countByStatus(CompOffStatus status);

    boolean existsByUserIdAndWorkedDateAndStatusIn(UUID userId, LocalDate workedDate, Collection<CompOffStatus> statuses);
}
