package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.LeaveBalance;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, UUID> {
    List<LeaveBalance> findByUserIdAndYear(UUID userId, Integer year);
    Optional<LeaveBalance> findByUserIdAndLeaveTypeIdAndYear(UUID userId, UUID leaveTypeId, Integer year);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT lb FROM LeaveBalance lb WHERE lb.user.id = :userId AND lb.leaveType.id = :leaveTypeId AND lb.year = :year")
    Optional<LeaveBalance> findByUserIdAndLeaveTypeIdAndYearWithLock(@Param("userId") UUID userId, @Param("leaveTypeId") UUID leaveTypeId, @Param("year") Integer year);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT lb FROM LeaveBalance lb WHERE lb.id = :id")
    Optional<LeaveBalance> findByIdWithLock(@Param("id") UUID id);

    boolean existsByUserIdAndLeaveTypeIdAndYear(UUID userId, UUID leaveTypeId, Integer year);
    List<LeaveBalance> findAllByUserId(UUID userId);
    List<LeaveBalance> findAllByYear(Integer year);
}
