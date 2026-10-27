package com.leavemgt.helpdesk.service;

import com.leavemgt.helpdesk.dto.CannedResponseDto;
import com.leavemgt.helpdesk.dto.CreateCannedResponseRequest;
import com.leavemgt.helpdesk.entity.CannedResponse;
import com.leavemgt.helpdesk.entity.TicketCategory;
import com.leavemgt.helpdesk.repository.CannedResponseRepository;
import com.leavemgt.helpdesk.repository.TicketCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CannedResponseService {

    private final CannedResponseRepository cannedResponseRepository;
    private final TicketCategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<CannedResponseDto> getAllCannedResponses() {
        return cannedResponseRepository.findAllByOrderByShortcutAsc().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public CannedResponseDto createCannedResponse(CreateCannedResponseRequest request) {
        TicketCategory category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Ticket category not found: " + request.getCategoryId()));
        }

        String shortcut = request.getShortcut().startsWith("#") ? request.getShortcut() : "#" + request.getShortcut();

        CannedResponse entity = CannedResponse.builder()
                .title(request.getTitle())
                .shortcut(shortcut)
                .content(request.getContent())
                .category(category)
                .build();

        return mapToDto(cannedResponseRepository.save(entity));
    }

    @Transactional
    public void deleteCannedResponse(UUID id) {
        if (!cannedResponseRepository.existsById(id)) {
            throw new IllegalArgumentException("Canned response not found: " + id);
        }
        cannedResponseRepository.deleteById(id);
    }

    public CannedResponseDto mapToDto(CannedResponse cr) {
        return CannedResponseDto.builder()
                .id(cr.getId())
                .title(cr.getTitle())
                .shortcut(cr.getShortcut())
                .content(cr.getContent())
                .categoryId(cr.getCategory() != null ? cr.getCategory().getId() : null)
                .categoryName(cr.getCategory() != null ? cr.getCategory().getName() : null)
                .createdAt(cr.getCreatedAt())
                .build();
    }
}
