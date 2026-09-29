package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.TicketCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TicketCategoryRepository extends JpaRepository<TicketCategory, UUID> {

    List<TicketCategory> findAllByIsActiveTrueOrderByNameAsc();

    List<TicketCategory> findAllByOrderByNameAsc();

    Optional<TicketCategory> findByCode(String code);

    Optional<TicketCategory> findByName(String name);

    boolean existsByCode(String code);

    boolean existsByName(String name);
}
