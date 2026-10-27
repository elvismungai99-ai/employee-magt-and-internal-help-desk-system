package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.CannedResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CannedResponseRepository extends JpaRepository<CannedResponse, UUID> {

    Optional<CannedResponse> findByShortcut(String shortcut);

    List<CannedResponse> findAllByOrderByShortcutAsc();

    List<CannedResponse> findByCategoryId(UUID categoryId);
}
