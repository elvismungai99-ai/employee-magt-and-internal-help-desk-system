package com.leavemgt.platform.repository;

import com.leavemgt.platform.entity.Notification;
import com.leavemgt.platform.entity.NotificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByStatus(NotificationStatus status);

    List<Notification> findByEventId(UUID eventId);

    List<Notification> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId);
}
