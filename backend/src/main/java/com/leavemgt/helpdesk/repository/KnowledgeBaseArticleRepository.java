package com.leavemgt.helpdesk.repository;

import com.leavemgt.helpdesk.entity.KnowledgeBaseArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface KnowledgeBaseArticleRepository extends JpaRepository<KnowledgeBaseArticle, UUID> {

    Optional<KnowledgeBaseArticle> findBySlug(String slug);

    Page<KnowledgeBaseArticle> findByIsPublishedTrueOrderByViewCountDesc(Pageable pageable);

    @Query("SELECT a FROM KnowledgeBaseArticle a WHERE a.isPublished = true AND " +
           "(LOWER(a.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(a.content) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(a.tags) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<KnowledgeBaseArticle> searchPublished(@Param("query") String query);

    @Query("SELECT a FROM KnowledgeBaseArticle a WHERE a.isPublished = true AND a.category.id = :categoryId")
    List<KnowledgeBaseArticle> findByCategoryId(@Param("categoryId") UUID categoryId);

    @Modifying
    @Query("UPDATE KnowledgeBaseArticle a SET a.viewCount = a.viewCount + 1 WHERE a.id = :id")
    void incrementViewCount(@Param("id") UUID id);

    @Modifying
    @Query("UPDATE KnowledgeBaseArticle a SET a.helpfulCount = a.helpfulCount + 1 WHERE a.id = :id")
    void incrementHelpfulCount(@Param("id") UUID id);
}
