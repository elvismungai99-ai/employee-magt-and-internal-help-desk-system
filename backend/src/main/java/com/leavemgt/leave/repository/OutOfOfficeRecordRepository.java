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
}
