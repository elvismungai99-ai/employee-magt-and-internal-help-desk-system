package com.leavemgt.helpdesk.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.helpdesk.dto.*;
import com.leavemgt.helpdesk.entity.*;
import com.leavemgt.helpdesk.repository.QueueMemberRepository;
import com.leavemgt.helpdesk.repository.SlaPolicyRepository;
import com.leavemgt.helpdesk.repository.SupportQueueRepository;
import com.leavemgt.helpdesk.repository.TicketCategoryRepository;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class HelpdeskTaxonomyService {

    private static final Logger log = LoggerFactory.getLogger(HelpdeskTaxonomyService.class);

    private final TicketCategoryRepository categoryRepository;
    private final SupportQueueRepository queueRepository;
    private final QueueMemberRepository queueMemberRepository;
    private final SlaPolicyRepository slaPolicyRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public HelpdeskTaxonomyService(TicketCategoryRepository categoryRepository,
                                  SupportQueueRepository queueRepository,
                                  QueueMemberRepository queueMemberRepository,
                                  SlaPolicyRepository slaPolicyRepository,
                                  UserRepository userRepository,
                                  ObjectMapper objectMapper) {
        this.categoryRepository = categoryRepository;
        this.queueRepository = queueRepository;
        this.queueMemberRepository = queueMemberRepository;
        this.slaPolicyRepository = slaPolicyRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // 1. TICKET CATEGORIES
    // =========================================================================

    @Transactional(readOnly = true)
    public List<TicketCategoryResponse> getActiveCategories() {
        return categoryRepository.findAllByIsActiveTrueOrderByNameAsc().stream()
                .map(this::mapCategory)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TicketCategoryResponse> getAllCategories() {
        return categoryRepository.findAllByOrderByNameAsc().stream()
                .map(this::mapCategory)
                .collect(Collectors.toList());
    }

    @Transactional
    public TicketCategoryResponse createCategory(CreateTicketCategoryRequest request) {
        String name = request.getName().trim();
        String code = request.getCode().trim().toUpperCase();

        if (categoryRepository.existsByName(name)) {
            throw new IllegalArgumentException("Ticket category with name '" + name + "' already exists");
        }
        if (categoryRepository.existsByCode(code)) {
            throw new IllegalArgumentException("Ticket category with code '" + code + "' already exists");
        }

        TicketCategory category = TicketCategory.builder()
                .name(name)
                .code(code)
                .description(request.getDescription())
                .defaultPriority(request.getDefaultPriority() != null ? request.getDefaultPriority() : TicketPriority.MEDIUM)
                .isActive(true)
                .build();

        TicketCategory saved = categoryRepository.save(category);
        log.info("Created ticket category: code={}, name={}", saved.getCode(), saved.getName());
        return mapCategory(saved);
    }

    @Transactional
    public TicketCategoryResponse deactivateCategory(UUID id) {
        TicketCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket category not found with ID: " + id));
        category.setIsActive(false);
        return mapCategory(categoryRepository.save(category));
    }

    // =========================================================================
    // 2. SUPPORT QUEUES
    // =========================================================================

    @Transactional(readOnly = true)
    public List<SupportQueueResponse> getActiveQueues() {
        return queueRepository.findAllByIsActiveTrueOrderByNameAsc().stream()
                .map(this::mapQueue)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SupportQueueResponse> getAllQueues() {
        return queueRepository.findAllByOrderByNameAsc().stream()
                .map(this::mapQueue)
                .collect(Collectors.toList());
    }

    @Transactional
    public SupportQueueResponse createQueue(CreateSupportQueueRequest request) {
        String name = request.getName().trim();
        if (queueRepository.existsByName(name)) {
            throw new IllegalArgumentException("Support queue with name '" + name + "' already exists");
        }

        SupportQueue queue = SupportQueue.builder()
                .name(name)
                .description(request.getDescription())
                .emailAlias(request.getEmailAlias())
                .isActive(true)
                .build();

        SupportQueue saved = queueRepository.save(queue);
        log.info("Created support queue: id={}, name={}", saved.getId(), saved.getName());
        return mapQueue(saved);
    }

    @Transactional
    public SupportQueueResponse deactivateQueue(UUID id) {
        SupportQueue queue = queueRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Support queue not found with ID: " + id));
        queue.setIsActive(false);
        return mapQueue(queueRepository.save(queue));
    }

    // =========================================================================
    // 3. QUEUE MEMBERSHIP
    // =========================================================================

    @Transactional(readOnly = true)
    public List<QueueMemberResponse> getQueueMembers(UUID queueId) {
        if (!queueRepository.existsById(queueId)) {
            throw new IllegalArgumentException("Support queue not found with ID: " + queueId);
        }
        return queueMemberRepository.findByQueueIdAndIsActiveTrue(queueId).stream()
                .map(this::mapQueueMember)
                .collect(Collectors.toList());
    }

    @Transactional
    public QueueMemberResponse addAgentToQueue(UUID queueId, UUID agentUserId, UUID assignedByAdminId) {
        SupportQueue queue = queueRepository.findById(queueId)
                .orElseThrow(() -> new IllegalArgumentException("Support queue not found with ID: " + queueId));

        if (!Boolean.TRUE.equals(queue.getIsActive())) {
            throw new IllegalArgumentException("Cannot add agent to an inactive support queue");
        }

        User agentUser = userRepository.findById(agentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + agentUserId));

        if (!"ACTIVE".equalsIgnoreCase(agentUser.getStatus())) {
            throw new IllegalArgumentException("Cannot add inactive user to support queue");
        }

        // Validate agent privileges: user must hold SUPPORT_AGENT or HR_ADMIN role
        boolean hasAgentPrivileges = agentUser.getRoles().stream()
                .map(Role::getName)
                .anyMatch(r -> "SUPPORT_AGENT".equalsIgnoreCase(r) || "ROLE_SUPPORT_AGENT".equalsIgnoreCase(r)
                            || "HR_ADMIN".equalsIgnoreCase(r) || "ROLE_HR_ADMIN".equalsIgnoreCase(r));

        if (!hasAgentPrivileges) {
            throw new IllegalArgumentException("User does not hold SUPPORT_AGENT role (required for queue membership)");
        }

        User assignedByUser = null;
        if (assignedByAdminId != null) {
            assignedByUser = userRepository.findById(assignedByAdminId).orElse(null);
        }

        QueueMemberId id = new QueueMemberId(queueId, agentUserId);
        Optional<QueueMember> existing = queueMemberRepository.findById(id);

        if (existing.isPresent()) {
            QueueMember member = existing.get();
            if (Boolean.TRUE.equals(member.getIsActive())) {
                log.debug("Agent {} already an active member of queue {}", agentUser.getEmail(), queue.getName());
                return mapQueueMember(member);
            }
            // Reactivate membership
            member.setIsActive(true);
            member.setAssignedBy(assignedByUser);
            member.setAssignedAt(OffsetDateTime.now());
            QueueMember saved = queueMemberRepository.save(member);
            return mapQueueMember(saved);
        }

        QueueMember newMember = QueueMember.builder()
                .id(id)
                .queue(queue)
                .agentUser(agentUser)
                .isActive(true)
                .assignedBy(assignedByUser)
                .assignedAt(OffsetDateTime.now())
                .build();

        QueueMember saved = queueMemberRepository.save(newMember);
        log.info("Agent {} added to queue {} by admin {}",
                agentUser.getEmail(), queue.getName(), assignedByUser != null ? assignedByUser.getEmail() : "SYSTEM");

        return mapQueueMember(saved);
    }

    @Transactional
    public void removeAgentFromQueue(UUID queueId, UUID agentUserId) {
        QueueMemberId id = new QueueMemberId(queueId, agentUserId);
        queueMemberRepository.findById(id).ifPresent(member -> {
            member.setIsActive(false);
            queueMemberRepository.save(member);
        });
    }

    // =========================================================================
    // 4. SLA POLICIES
    // =========================================================================

    @Transactional(readOnly = true)
    public List<SlaPolicyResponse> getActiveSlaPolicies() {
        return slaPolicyRepository.findAllByIsActiveTrueOrderByPriorityAsc().stream()
                .map(this::mapSlaPolicy)
                .collect(Collectors.toList());
    }

    @Transactional
    public SlaPolicyResponse createSlaPolicy(CreateSlaPolicyRequest request) {
        String name = request.getName().trim();
        TicketPriority priority = request.getPriority();

        // 1. Validate response target < resolution target
        if (request.getFirstResponseTargetMinutes() >= request.getResolutionTargetMinutes()) {
            throw new IllegalArgumentException(String.format(
                    "First response target minutes (%d) must be strictly less than resolution target minutes (%d)",
                    request.getFirstResponseTargetMinutes(), request.getResolutionTargetMinutes()));
        }

        // 2. Validate uniqueness
        if (slaPolicyRepository.existsByName(name)) {
            throw new IllegalArgumentException("SLA policy with name '" + name + "' already exists");
        }
        if (slaPolicyRepository.existsByPriority(priority)) {
            throw new IllegalArgumentException("SLA policy for priority " + priority + " already exists");
        }

        // 3. Validate escalation rule JSON shape
        String escalationJson = null;
        if (request.getEscalationRule() != null) {
            EscalationRuleDto rule = request.getEscalationRule();
            validateEscalationRule(rule);
            try {
                escalationJson = objectMapper.writeValueAsString(rule);
            } catch (JsonProcessingException e) {
                throw new IllegalArgumentException("Failed to serialize escalationRule: " + e.getMessage());
            }
        } else if (request.getEscalationRuleJson() != null && !request.getEscalationRuleJson().isBlank()) {
            try {
                EscalationRuleDto parsed = objectMapper.readValue(request.getEscalationRuleJson(), EscalationRuleDto.class);
                validateEscalationRule(parsed);
                escalationJson = request.getEscalationRuleJson();
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid escalation_rule_json contract: " + e.getMessage());
            }
        }

        SlaPolicy policy = SlaPolicy.builder()
                .name(name)
                .priority(priority)
                .firstResponseTargetMinutes(request.getFirstResponseTargetMinutes())
                .resolutionTargetMinutes(request.getResolutionTargetMinutes())
                .escalationRuleJson(escalationJson)
                .isActive(true)
                .build();

        SlaPolicy saved = slaPolicyRepository.save(policy);
        log.info("Created SLA policy: priority={}, name={}, response={}m, resolution={}m",
                saved.getPriority(), saved.getName(), saved.getFirstResponseTargetMinutes(), saved.getResolutionTargetMinutes());

        return mapSlaPolicy(saved);
    }

    private void validateEscalationRule(EscalationRuleDto rule) {
        if (rule.getWarnAtPercent() == null || rule.getWarnAtPercent() < 1 || rule.getWarnAtPercent() > 100) {
            throw new IllegalArgumentException("warnAtPercent must be between 1 and 100");
        }
        if (rule.getEscalateToRole() == null || rule.getEscalateToRole().isBlank()) {
            throw new IllegalArgumentException("escalateToRole cannot be blank");
        }
    }

    // =========================================================================
    // MAPPERS
    // =========================================================================

    private TicketCategoryResponse mapCategory(TicketCategory c) {
        return TicketCategoryResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .code(c.getCode())
                .description(c.getDescription())
                .defaultPriority(c.getDefaultPriority())
                .isActive(c.getIsActive())
                .createdAt(c.getCreatedAt())
                .build();
    }

    private SupportQueueResponse mapQueue(SupportQueue q) {
        int memberCount = 0;
        if (q.getMembers() != null) {
            memberCount = (int) q.getMembers().stream()
                    .filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                    .count();
        }
        return SupportQueueResponse.builder()
                .id(q.getId())
                .name(q.getName())
                .description(q.getDescription())
                .emailAlias(q.getEmailAlias())
                .isActive(q.getIsActive())
                .memberCount(memberCount)
                .createdAt(q.getCreatedAt())
                .build();
    }

    private QueueMemberResponse mapQueueMember(QueueMember m) {
        return QueueMemberResponse.builder()
                .queueId(m.getQueue().getId())
                .queueName(m.getQueue().getName())
                .agentUserId(m.getAgentUser().getId())
                .agentName(m.getAgentUser().getFullName())
                .agentEmail(m.getAgentUser().getEmail())
                .isActive(m.getIsActive())
                .assignedAt(m.getAssignedAt())
                .assignedById(m.getAssignedBy() != null ? m.getAssignedBy().getId() : null)
                .assignedByName(m.getAssignedBy() != null ? m.getAssignedBy().getFullName() : null)
                .build();
    }

    private SlaPolicyResponse mapSlaPolicy(SlaPolicy p) {
        EscalationRuleDto ruleDto = null;
        if (p.getEscalationRuleJson() != null && !p.getEscalationRuleJson().isBlank()) {
            try {
                ruleDto = objectMapper.readValue(p.getEscalationRuleJson(), EscalationRuleDto.class);
            } catch (Exception e) {
                log.warn("Failed to parse escalationRuleJson for policy {}: {}", p.getId(), e.getMessage());
            }
        }

        return SlaPolicyResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .priority(p.getPriority())
                .firstResponseTargetMinutes(p.getFirstResponseTargetMinutes())
                .resolutionTargetMinutes(p.getResolutionTargetMinutes())
                .escalationRule(ruleDto)
                .escalationRuleJson(p.getEscalationRuleJson())
                .isActive(p.getIsActive())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
