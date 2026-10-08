package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.OutOfOfficeRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OutOfOfficeRecordRepository extends JpaRepository<OutOfOfficeRecord, UUID> {

    boolean existsBySourceEventId(UUID sourceEventId);

    Optional<OutOfOfficeRecord> findBySourceEventId(UUID sourceEventId);

    List<OutOfOfficeRecord> findByLeaveRequestId(UUID leaveRequestId);

    List<OutOfOfficeRecord> findByUserIdOrderByStartDateDesc(UUID userId);

    List<OutOfOfficeRecord> findBySyncStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            com.leavemgt.leave.entity.OooSyncStatus syncStatus,
            java.time.LocalDate startMax,
            java.time.LocalDate endMin
    );

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(o) > 0 FROM OutOfOfficeRecord o WHERE o.user.id = :userId AND o.syncStatus = :syncStatus AND o.startDate <= :date AND o.endDate >= :date")
    boolean isUserCurrentlyOoo(@org.springframework.data.repository.query.Param("userId") UUID userId,
                               @org.springframework.data.repository.query.Param("syncStatus") com.leavemgt.leave.entity.OooSyncStatus syncStatus,
                               @org.springframework.data.repository.query.Param("date") java.time.LocalDate date);
}
