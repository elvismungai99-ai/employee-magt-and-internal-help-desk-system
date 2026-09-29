package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.LeavePolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LeavePolicyRepository extends JpaRepository<LeavePolicy, UUID> {
    Optional<LeavePolicy> findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(UUID leaveTypeId, Integer effectiveYear);
    Optional<LeavePolicy> findFirstByLeaveTypeIdAndIsActiveTrueOrderByEffectiveYearDesc(UUID leaveTypeId);
    List<LeavePolicy> findAllByLeaveTypeIdAndIsActiveTrue(UUID leaveTypeId);
    List<LeavePolicy> findAllByIsActiveTrue();
    List<LeavePolicy> findAllByEffectiveYearAndIsActiveTrue(Integer effectiveYear);
}
