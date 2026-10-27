package com.leavemgt.platform.repository;

import com.leavemgt.platform.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE " +
           "(:action IS NULL OR a.action = :action) AND " +
           "(:entityType IS NULL OR a.entityType = :entityType) AND " +
           "(:actorEmail IS NULL OR a.actorEmail LIKE CONCAT('%', :actorEmail, '%')) " +
           "ORDER BY a.timestamp DESC")
    Page<AuditLog> searchLogs(
            @Param("action") String action,
            @Param("entityType") String entityType,
            @Param("actorEmail") String actorEmail,
            Pageable pageable
    );
}
