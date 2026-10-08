package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.LeaveRequest;
import com.leavemgt.leave.entity.LeaveRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, UUID> {

    List<LeaveRequest> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

    List<LeaveRequest> findAllByOrderByCreatedAtDesc();

    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.user.id = :userId " +
           "AND lr.status IN :activeStatuses " +
           "AND lr.startDate <= :endDate AND lr.endDate >= :startDate")
    List<LeaveRequest> findOverlappingRequests(@Param("userId") UUID userId,
                                              @Param("startDate") LocalDate startDate,
                                              @Param("endDate") LocalDate endDate,
                                              @Param("activeStatuses") Collection<LeaveRequestStatus> activeStatuses);

    List<LeaveRequest> findAllByStatusOrderByCreatedAtDesc(LeaveRequestStatus status);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM LeaveRequest lr WHERE lr.user.id IN :userIds")
    void deleteAllByUserIdIn(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);
}
