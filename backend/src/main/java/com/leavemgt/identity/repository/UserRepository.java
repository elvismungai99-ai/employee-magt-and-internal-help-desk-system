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

    java.util.List<User> findByStatusOrderByCreatedAtDesc(String status);
}
