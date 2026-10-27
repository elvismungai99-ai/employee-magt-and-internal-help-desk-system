package com.leavemgt.helpdesk.controller;

import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.helpdesk.dto.ArticleResponse;
import com.leavemgt.helpdesk.dto.CreateArticleRequest;
import com.leavemgt.helpdesk.service.KnowledgeBaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/helpdesk/kb")
@RequiredArgsConstructor
@Slf4j
public class KnowledgeBaseController {

    private final KnowledgeBaseService kbService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ArticleResponse>>> getArticles(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) UUID categoryId) {
        List<ArticleResponse> articles = kbService.getArticles(query, categoryId);
        return ResponseEntity.ok(ApiResponse.success(articles, "Articles retrieved successfully"));
    }

    @GetMapping("/deflection")
    public ResponseEntity<ApiResponse<List<ArticleResponse>>> getDeflectionSuggestions(
            @RequestParam String query) {
        List<ArticleResponse> suggestions = kbService.getDeflectionSuggestions(query);
        return ResponseEntity.ok(ApiResponse.success(suggestions, "Deflection suggestions retrieved successfully"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ArticleResponse>> getArticleById(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "true") boolean incrementView) {
        ArticleResponse article = kbService.getArticleById(id, incrementView);
        return ResponseEntity.ok(ApiResponse.success(article, "Article retrieved successfully"));
    }

    @PostMapping("/{id}/vote")
    public ResponseEntity<ApiResponse<ArticleResponse>> voteHelpful(@PathVariable UUID id) {
        ArticleResponse article = kbService.voteHelpful(id);
        return ResponseEntity.ok(ApiResponse.success(article, "Helpful vote recorded successfully"));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN', 'ROLE_SUPPORT_AGENT', 'SUPPORT_AGENT')")
    public ResponseEntity<ApiResponse<ArticleResponse>> createArticle(
            @Valid @RequestBody CreateArticleRequest request) {
        ArticleResponse article = kbService.createArticle(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(article, "Article created successfully"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN', 'ROLE_SUPPORT_AGENT', 'SUPPORT_AGENT')")
    public ResponseEntity<ApiResponse<ArticleResponse>> updateArticle(
            @PathVariable UUID id,
            @Valid @RequestBody CreateArticleRequest request) {
        ArticleResponse article = kbService.updateArticle(id, request);
        return ResponseEntity.ok(ApiResponse.success(article, "Article updated successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteArticle(@PathVariable UUID id) {
        kbService.deleteArticle(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Article deleted successfully"));
    }
}
