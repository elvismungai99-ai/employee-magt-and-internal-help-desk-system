package com.leavemgt.helpdesk.service;

import com.leavemgt.helpdesk.dto.ArticleResponse;
import com.leavemgt.helpdesk.dto.CreateArticleRequest;
import com.leavemgt.helpdesk.entity.KnowledgeBaseArticle;
import com.leavemgt.helpdesk.entity.TicketCategory;
import com.leavemgt.helpdesk.repository.KnowledgeBaseArticleRepository;
import com.leavemgt.helpdesk.repository.TicketCategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class KnowledgeBaseService {

    private final KnowledgeBaseArticleRepository articleRepository;
    private final TicketCategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<ArticleResponse> getArticles(String query, UUID categoryId) {
        if (query != null && !query.trim().isEmpty()) {
            return articleRepository.searchPublished(query.trim()).stream()
                    .filter(a -> categoryId == null || (a.getCategory() != null && a.getCategory().getId().equals(categoryId)))
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        if (categoryId != null) {
            return articleRepository.findByCategoryId(categoryId).stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        return articleRepository.findByIsPublishedTrueOrderByViewCountDesc(PageRequest.of(0, 50))
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ArticleResponse> getDeflectionSuggestions(String text) {
        if (text == null || text.trim().length() < 3) {
            return Collections.emptyList();
        }

        // Clean tokens from input
        String[] keywords = text.toLowerCase().replaceAll("[^a-zA-Z0-9 ]", "").split("\\s+");
        Set<UUID> seenIds = new HashSet<>();
        List<ArticleResponse> results = new ArrayList<>();

        for (String kw : keywords) {
            if (kw.length() < 3) continue;
            List<KnowledgeBaseArticle> matches = articleRepository.searchPublished(kw);
            for (KnowledgeBaseArticle a : matches) {
                if (seenIds.add(a.getId())) {
                    results.add(mapToResponse(a));
                    if (results.size() >= 5) break;
                }
            }
            if (results.size() >= 5) break;
        }

        return results;
    }

    @Transactional
    public ArticleResponse getArticleById(UUID id, boolean incrementView) {
        KnowledgeBaseArticle article = articleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found: " + id));

        if (incrementView) {
            articleRepository.incrementViewCount(id);
            article.setViewCount(article.getViewCount() + 1);
        }

        return mapToResponse(article);
    }

    @Transactional
    public ArticleResponse voteHelpful(UUID id) {
        KnowledgeBaseArticle article = articleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found: " + id));

        articleRepository.incrementHelpfulCount(id);
        article.setHelpfulCount(article.getHelpfulCount() + 1);
        return mapToResponse(article);
    }

    @Transactional
    public ArticleResponse createArticle(CreateArticleRequest request) {
        TicketCategory category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Ticket category not found: " + request.getCategoryId()));
        }

        String slug = request.getTitle().toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "") + "-" + UUID.randomUUID().toString().substring(0, 8);

        KnowledgeBaseArticle article = KnowledgeBaseArticle.builder()
                .title(request.getTitle())
                .slug(slug)
                .content(request.getContent())
                .category(category)
                .tags(request.getTags())
                .isPublished(request.getIsPublished() != null ? request.getIsPublished() : true)
                .viewCount(0)
                .helpfulCount(0)
                .build();

        return mapToResponse(articleRepository.save(article));
    }

    @Transactional
    public ArticleResponse updateArticle(UUID id, CreateArticleRequest request) {
        KnowledgeBaseArticle article = articleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found: " + id));

        if (request.getCategoryId() != null) {
            TicketCategory category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Ticket category not found: " + request.getCategoryId()));
            article.setCategory(category);
        } else {
            article.setCategory(null);
        }

        article.setTitle(request.getTitle());
        article.setContent(request.getContent());
        article.setTags(request.getTags());
        if (request.getIsPublished() != null) {
            article.setIsPublished(request.getIsPublished());
        }

        return mapToResponse(articleRepository.save(article));
    }

    @Transactional
    public void deleteArticle(UUID id) {
        if (!articleRepository.existsById(id)) {
            throw new IllegalArgumentException("Article not found: " + id);
        }
        articleRepository.deleteById(id);
    }

    public ArticleResponse mapToResponse(KnowledgeBaseArticle a) {
        return ArticleResponse.builder()
                .id(a.getId())
                .title(a.getTitle())
                .slug(a.getSlug())
                .content(a.getContent())
                .categoryId(a.getCategory() != null ? a.getCategory().getId() : null)
                .categoryName(a.getCategory() != null ? a.getCategory().getName() : null)
                .tags(a.getTags())
                .isPublished(a.getIsPublished())
                .viewCount(a.getViewCount())
                .helpfulCount(a.getHelpfulCount())
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .build();
    }
}
