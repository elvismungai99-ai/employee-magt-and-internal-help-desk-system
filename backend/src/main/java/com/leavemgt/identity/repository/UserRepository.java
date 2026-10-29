package com.leavemgt.identity.repository;

import com.leavemgt.identity.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmployeeCode(String employeeCode);
    boolean existsByEmail(String email);
    boolean existsByEmployeeCode(String employeeCode);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u JOIN u.roles r WHERE r.name = :roleName OR r.name = CONCAT('ROLE_', :roleName)")
    java.util.List<User> findByRoleName(@org.springframework.data.repository.query.Param("roleName") String roleName);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT u FROM User u JOIN FETCH u.roles r WHERE u.status = 'ACTIVE' AND (r.name = :roleName OR r.name = CONCAT('ROLE_', :roleName))")
    java.util.List<User> findActiveByRoleName(@org.springframework.data.repository.query.Param("roleName") String roleName);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.department LEFT JOIN FETCH u.roles r LEFT JOIN FETCH r.permissions ORDER BY u.firstName ASC, u.lastName ASC")
    java.util.List<User> findAllWithRolesAndDepartment();

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.department LEFT JOIN FETCH u.roles r LEFT JOIN FETCH r.permissions WHERE UPPER(u.status) = UPPER(:status) ORDER BY u.firstName ASC, u.lastName ASC")
    java.util.List<User> findAllByStatusWithRolesAndDepartment(@org.springframework.data.repository.query.Param("status") String status);

    java.util.List<User> findByStatusOrderByCreatedAtDesc(String status);

    java.util.List<User> findByDepartmentId(UUID departmentId);
}
