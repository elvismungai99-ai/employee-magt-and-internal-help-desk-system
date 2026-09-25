package com.leavemgt.identity.repository;

import com.leavemgt.identity.entity.ReportingHierarchy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReportingHierarchyRepository extends JpaRepository<ReportingHierarchy, UUID> {

    @Query("SELECT rh FROM ReportingHierarchy rh WHERE rh.employee.id = :employeeId AND rh.isActive = true AND (rh.effectiveTo IS NULL OR rh.effectiveTo >= :today) ORDER BY rh.effectiveFrom DESC")
    List<ReportingHierarchy> findActiveHierarchyForEmployee(@Param("employeeId") UUID employeeId, @Param("today") LocalDate today);

    default Optional<ReportingHierarchy> findCurrentManagerForEmployee(UUID employeeId) {
        List<ReportingHierarchy> list = findActiveHierarchyForEmployee(employeeId, LocalDate.now());
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Query("SELECT rh FROM ReportingHierarchy rh WHERE rh.manager.id = :managerId AND rh.isActive = true AND (rh.effectiveTo IS NULL OR rh.effectiveTo >= :today)")
    List<ReportingHierarchy> findActiveSubordinatesForManager(@Param("managerId") UUID managerId, @Param("today") LocalDate today);

    boolean existsByEmployeeIdAndManagerIdAndIsActiveTrue(UUID employeeId, UUID managerId);
}
