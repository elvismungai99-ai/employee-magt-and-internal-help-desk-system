package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.BalanceTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BalanceTransactionRepository extends JpaRepository<BalanceTransaction, UUID> {
    List<BalanceTransaction> findByLeaveBalanceIdOrderByCreatedAtDesc(UUID leaveBalanceId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM BalanceTransaction bt WHERE bt.leaveBalance.id IN (SELECT lb.id FROM LeaveBalance lb WHERE lb.user.id IN :userIds) OR bt.createdBy.id IN :userIds")
    void deleteAllByRelatedUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(bt) > 0 FROM BalanceTransaction bt WHERE bt.leaveBalance.id = :balanceId AND bt.transactionType = :transactionType AND bt.description LIKE :periodPattern")
    boolean existsByLeaveBalanceIdAndTransactionTypeAndDescriptionLike(
            @org.springframework.data.repository.query.Param("balanceId") UUID balanceId,
            @org.springframework.data.repository.query.Param("transactionType") com.leavemgt.leave.entity.TransactionType transactionType,
            @org.springframework.data.repository.query.Param("periodPattern") String periodPattern
    );
}
