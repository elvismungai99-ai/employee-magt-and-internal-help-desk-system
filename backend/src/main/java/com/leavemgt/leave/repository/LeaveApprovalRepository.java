package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.ApprovalStatus;
import com.leavemgt.leave.entity.LeaveApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LeaveApprovalRepository extends JpaRepository<LeaveApproval, UUID> {

    List<LeaveApproval> findByApproverIdAndStatusOrderByCreatedAtDesc(UUID approverId, ApprovalStatus status);

    List<LeaveApproval> findByStatusOrderByCreatedAtDesc(ApprovalStatus status);

    Optional<LeaveApproval> findByLeaveRequestIdAndApproverId(UUID leaveRequestId, UUID approverId);

    List<LeaveApproval> findByLeaveRequestIdOrderByStepOrderAsc(UUID leaveRequestId);

    List<LeaveApproval> findByLeaveRequestId(UUID leaveRequestId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM LeaveApproval la WHERE la.approver.id IN :userIds OR la.leaveRequest.id IN (SELECT lr.id FROM LeaveRequest lr WHERE lr.user.id IN :userIds)")
    void deleteAllByRelatedUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);
}
