package com.leavemgt.leave.repository;

import com.leavemgt.leave.entity.LeaveType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LeaveTypeRepository extends JpaRepository<LeaveType, UUID> {
    Optional<LeaveType> findByCode(String code);
    Optional<LeaveType> findByName(String name);
    boolean existsByCode(String code);
    boolean existsByName(String name);
    List<LeaveType> findAllByIsActiveTrue();
}
