package com.leavemgt.identity.repository;

import com.leavemgt.identity.entity.RelationshipType;
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

    @Query("SELECT rh FROM ReportingHierarchy rh WHERE rh.employee.id = :employeeId AND rh.isActive = true AND rh.relationshipType = :type AND (rh.effectiveTo IS NULL OR rh.effectiveTo >= :today) ORDER BY rh.effectiveFrom DESC")
    List<ReportingHierarchy> findActiveHierarchyForEmployeeAndType(@Param("employeeId") UUID employeeId, @Param("type") RelationshipType type, @Param("today") LocalDate today);

    default Optional<ReportingHierarchy> findCurrentManagerForEmployee(UUID employeeId) {
        List<ReportingHierarchy> list = findActiveHierarchyForEmployeeAndType(employeeId, RelationshipType.DIRECT, LocalDate.now());
        if (list.isEmpty()) {
            list = findActiveHierarchyForEmployee(employeeId, LocalDate.now());
        }
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Query("SELECT rh FROM ReportingHierarchy rh WHERE rh.employee.id = :employeeId AND rh.isActive = true AND rh.relationshipType = 'DIRECT'")
    List<ReportingHierarchy> findActiveDirectRowsForEmployee(@Param("employeeId") UUID employeeId);

    @Query("SELECT rh FROM ReportingHierarchy rh WHERE rh.manager.id = :managerId AND rh.isActive = true AND (rh.effectiveTo IS NULL OR rh.effectiveTo >= :today) ORDER BY rh.employee.firstName ASC, rh.employee.lastName ASC")
    List<ReportingHierarchy> findActiveSubordinatesForManager(@Param("managerId") UUID managerId, @Param("today") LocalDate today);

    @Query("SELECT rh FROM ReportingHierarchy rh WHERE rh.manager.id = :managerId AND rh.isActive = true AND rh.relationshipType = :type AND (rh.effectiveTo IS NULL OR rh.effectiveTo >= :today) ORDER BY rh.employee.firstName ASC, rh.employee.lastName ASC")
    List<ReportingHierarchy> findActiveSubordinatesForManagerAndType(@Param("managerId") UUID managerId, @Param("type") RelationshipType type, @Param("today") LocalDate today);

    boolean existsByEmployeeIdAndManagerIdAndIsActiveTrue(UUID employeeId, UUID managerId);
}
