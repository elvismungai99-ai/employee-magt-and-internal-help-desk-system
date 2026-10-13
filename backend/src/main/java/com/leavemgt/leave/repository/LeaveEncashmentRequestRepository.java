package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.EncashmentStatus;
import com.leavemgt.leave.entity.LeaveEncashmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LeaveEncashmentRequestRepository extends JpaRepository<LeaveEncashmentRequest, UUID> {

    List<LeaveEncashmentRequest> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<LeaveEncashmentRequest> findByStatusOrderByCreatedAtDesc(EncashmentStatus status);

    List<LeaveEncashmentRequest> findAllByOrderByCreatedAtDesc();
}
