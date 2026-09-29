package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.SupportQueue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupportQueueRepository extends JpaRepository<SupportQueue, UUID> {

    List<SupportQueue> findAllByIsActiveTrueOrderByNameAsc();

    List<SupportQueue> findAllByOrderByNameAsc();

    Optional<SupportQueue> findByName(String name);

    boolean existsByName(String name);
}
