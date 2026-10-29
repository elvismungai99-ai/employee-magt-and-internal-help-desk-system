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

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.id = :id")
    java.util.Optional<LeaveRequest> findByIdWithLock(@Param("id") UUID id);

    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.status IN :activeStatuses " +
           "AND lr.startDate <= :endDate AND lr.endDate >= :startDate")
    List<LeaveRequest> findAllOverlappingRequests(@Param("startDate") LocalDate startDate,
                                                  @Param("endDate") LocalDate endDate,
                                                  @Param("activeStatuses") Collection<LeaveRequestStatus> activeStatuses);

    long countByStatus(LeaveRequestStatus status);

    @Query("SELECT COUNT(lr) FROM LeaveRequest lr WHERE lr.status = :status AND lr.startDate <= :today AND lr.endDate >= :today")
    long countActiveLeavesOnDate(@Param("status") LeaveRequestStatus status, @Param("today") LocalDate today);

    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.user.id = :userId " +
           "AND lr.status IN :activeStatuses " +
           "AND lr.startDate <= :endDate AND lr.endDate >= :startDate")
    List<LeaveRequest> findOverlappingRequests(@Param("userId") UUID userId,
                                              @Param("startDate") LocalDate startDate,
                                              @Param("endDate") LocalDate endDate,
                                              @Param("activeStatuses") Collection<LeaveRequestStatus> activeStatuses);

    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.user.department.id = :departmentId " +
           "AND lr.status IN :activeStatuses " +
           "AND lr.startDate <= :endDate AND lr.endDate >= :startDate")
    List<LeaveRequest> findOverlappingDepartmentRequests(@Param("departmentId") UUID departmentId,
                                                         @Param("startDate") LocalDate startDate,
                                                         @Param("endDate") LocalDate endDate,
                                                         @Param("activeStatuses") Collection<LeaveRequestStatus> activeStatuses);

    List<LeaveRequest> findAllByStatusOrderByCreatedAtDesc(LeaveRequestStatus status);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM LeaveRequest lr WHERE lr.user.id IN :userIds")
    void deleteAllByUserIdIn(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);
}
