package com.leavemgt.helpdesk.service;

import com.leavemgt.helpdesk.dto.*;
import com.leavemgt.helpdesk.entity.*;
import com.leavemgt.helpdesk.repository.*;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketCommentRepository ticketCommentRepository;
    private final TicketAttachmentRepository ticketAttachmentRepository;
    private final TicketRoutingHistoryRepository ticketRoutingHistoryRepository;
    private final TicketCategoryRepository categoryRepository;
    private final SupportQueueRepository queueRepository;
    private final QueueMemberRepository queueMemberRepository;
    private final SlaPolicyRepository slaPolicyRepository;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Value("${app.helpdesk.max-attachment-size-bytes:10485760}")
    private long maxAttachmentSizeBytes;

    @org.springframework.beans.factory.annotation.Value("${app.helpdesk.allowed-attachment-extensions:pdf,png,jpg,jpeg,gif,webp,txt,csv,doc,docx,xls,xlsx,zip}")
    private String allowedAttachmentExtensions;

    public TicketService(TicketRepository ticketRepository,
                         TicketCommentRepository ticketCommentRepository,
                         TicketAttachmentRepository ticketAttachmentRepository,
                         TicketRoutingHistoryRepository ticketRoutingHistoryRepository,
                         TicketCategoryRepository categoryRepository,
                         SupportQueueRepository queueRepository,
                         QueueMemberRepository queueMemberRepository,
                         SlaPolicyRepository slaPolicyRepository,
                         UserRepository userRepository) {
        this.ticketRepository = ticketRepository;
        this.ticketCommentRepository = ticketCommentRepository;
        this.ticketAttachmentRepository = ticketAttachmentRepository;
        this.ticketRoutingHistoryRepository = ticketRoutingHistoryRepository;
        this.categoryRepository = categoryRepository;
        this.queueRepository = queueRepository;
        this.queueMemberRepository = queueMemberRepository;
        this.slaPolicyRepository = slaPolicyRepository;
        this.userRepository = userRepository;
    }

    // =========================================================================
    // 1. TICKET CREATION
    // =========================================================================

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request, UUID requesterId) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new IllegalArgumentException("Requester user not found: " + requesterId));

        if (!"ACTIVE".equalsIgnoreCase(requester.getStatus())) {
            throw new IllegalArgumentException("Cannot create tickets for inactive requester");
        }

        TicketCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("Ticket category not found: " + request.getCategoryId()));

        if (!Boolean.TRUE.equals(category.getIsActive())) {
            throw new IllegalArgumentException("Ticket category '" + category.getName() + "' is inactive");
        }

        // Resolve priority
        TicketPriority priority = request.getPriority();
        if (priority == null) {
            priority = category.getDefaultPriority() != null ? category.getDefaultPriority() : TicketPriority.MEDIUM;
        }

        // Resolve support queue
        SupportQueue queue;
        if (request.getQueueId() != null) {
            queue = queueRepository.findById(request.getQueueId())
                    .orElseThrow(() -> new IllegalArgumentException("Support queue not found: " + request.getQueueId()));
            if (!Boolean.TRUE.equals(queue.getIsActive())) {
                throw new IllegalArgumentException("Support queue '" + queue.getName() + "' is inactive");
            }
        } else {
            // Find default queue (e.g. Tier 1 Support or first active queue)
            queue = queueRepository.findByName("Tier 1 Support")
                    .filter(SupportQueue::getIsActive)
                    .orElseGet(() -> queueRepository.findAllByIsActiveTrueOrderByNameAsc().stream()
                            .findFirst()
                            .orElseThrow(() -> new IllegalStateException("No active support queue available for ticket assignment")));
        }

        // Resolve SLA policy matching priority
        SlaPolicy slaPolicy = slaPolicyRepository.findByPriorityAndIsActiveTrue(priority)
                .orElse(null);

        OffsetDateTime slaDueAt = null;
        if (slaPolicy != null) {
            slaDueAt = OffsetDateTime.now().plusMinutes(slaPolicy.getResolutionTargetMinutes());
        }

        // Atomic ticket number generation via PostgreSQL sequence
        String ticketNumber = ticketRepository.generateNextTicketNumber();

        Ticket ticket = Ticket.builder()
                .ticketNumber(ticketNumber)
                .requester(requester)
                .category(category)
                .queue(queue)
                .slaPolicy(slaPolicy)
                .title(request.getTitle().trim())
                .description(request.getDescription().trim())
                .status(TicketStatus.NEW)
                .priority(priority)
                .slaDueAt(slaDueAt)
                .build();

        Ticket saved = ticketRepository.save(ticket);
        log.info("Created ticket: number={}, id={}, requester={}, priority={}, slaDueAt={}",
                saved.getTicketNumber(), saved.getId(), requester.getEmail(), saved.getPriority(), saved.getSlaDueAt());

        return mapTicket(saved, Collections.emptyList());
    }

    // =========================================================================
    // 2. TICKET RETRIEVAL & QUEUE VIEW
    // =========================================================================

    @Transactional(readOnly = true)
    public List<TicketResponse> getMyTickets(UUID requesterId) {
        return ticketRepository.findByRequesterIdOrderByCreatedAtDesc(requesterId).stream()
                .map(ticket -> {
                    // Strips internal notes completely for requester view
                    List<TicketCommentResponse> publicComments = ticketCommentRepository
                            .findByTicketIdAndIsInternalNoteFalseOrderByCreatedAtAsc(ticket.getId()).stream()
                            .map(this::mapComment)
                            .collect(Collectors.toList());
                    return mapTicket(ticket, publicComments);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getQueueTickets(UUID callerId, UUID optionalQueueId, boolean isHrAdmin) {
        if (isHrAdmin) {
            if (optionalQueueId != null) {
                return ticketRepository.findByQueueIdOrderByCreatedAtDesc(optionalQueueId).stream()
                        .map(t -> mapTicket(t, Collections.emptyList()))
                        .collect(Collectors.toList());
            }
            return ticketRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                    .map(t -> mapTicket(t, Collections.emptyList()))
                    .collect(Collectors.toList());
        }

        // For Support Agents: find queues caller is an active member of
        List<QueueMember> memberships = queueMemberRepository.findByAgentUserIdAndIsActiveTrue(callerId);
        List<UUID> allowedQueueIds = memberships.stream()
                .map(m -> m.getQueue().getId())
                .collect(Collectors.toList());

        if (allowedQueueIds.isEmpty()) {
            return Collections.emptyList();
        }

        if (optionalQueueId != null) {
            if (!allowedQueueIds.contains(optionalQueueId)) {
                throw new AccessDeniedException("You are not an active member of the requested support queue");
            }
            return ticketRepository.findByQueueIdOrderByCreatedAtDesc(optionalQueueId).stream()
                    .map(t -> mapTicket(t, Collections.emptyList()))
                    .collect(Collectors.toList());
        }

        return ticketRepository.findByQueueIdInOrderByCreatedAtDesc(allowedQueueIds).stream()
                .map(t -> mapTicket(t, Collections.emptyList()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicketById(UUID ticketId, UUID callerId, boolean isHrAdmin, boolean isSupportAgent) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        boolean isRequester = ticket.getRequester().getId().equals(callerId);
        boolean isAssigned = ticket.getAssignedAgent() != null && ticket.getAssignedAgent().getId().equals(callerId);
        boolean isQueueMember = ticket.getQueue() != null && queueMemberRepository.isAgentActiveInQueue(ticket.getQueue().getId(), callerId);

        if (!isRequester && !isAssigned && !isQueueMember && !isHrAdmin) {
            throw new AccessDeniedException("You do not have access to view ticket " + ticket.getTicketNumber());
        }

        List<TicketCommentResponse> comments;
        if (isRequester && !isSupportAgent && !isHrAdmin) {
            // Requester only sees public comments (internal notes filtered at query level)
            comments = ticketCommentRepository.findByTicketIdAndIsInternalNoteFalseOrderByCreatedAtAsc(ticketId).stream()
                    .map(this::mapComment)
                    .collect(Collectors.toList());
        } else {
            // Agents and HR admins see all comments including internal notes
            comments = ticketCommentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                    .map(this::mapComment)
                    .collect(Collectors.toList());
        }

        return mapTicket(ticket, comments);
    }

    // =========================================================================
    // 3. TICKET ASSIGNMENT & ROUTING
    // =========================================================================

    @Transactional
    public TicketResponse assignTicket(UUID ticketId, AssignTicketRequest request, UUID callerId, boolean isHrAdmin) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new IllegalStateException("Cannot reassign a CLOSED ticket (" + ticket.getTicketNumber() + ")");
        }

        // Authorize caller: must be HR Admin or active member of ticket's queue
        if (!isHrAdmin) {
            if (ticket.getQueue() == null || !queueMemberRepository.isAgentActiveInQueue(ticket.getQueue().getId(), callerId)) {
                throw new AccessDeniedException("Only HR Admin or active members of queue '"
                        + (ticket.getQueue() != null ? ticket.getQueue().getName() : "Unassigned")
                        + "' can assign this ticket");
            }
        }

        // Validate target agent
        User targetAgent = userRepository.findById(request.getAgentUserId())
                .orElseThrow(() -> new IllegalArgumentException("Agent user not found: " + request.getAgentUserId()));

        if (!"ACTIVE".equalsIgnoreCase(targetAgent.getStatus())) {
            throw new IllegalArgumentException("Cannot assign ticket to an inactive user");
        }

        // Validate target agent is active member of ticket's queue (or HR Admin with global queue authority)
        boolean isTargetHrAdmin = targetAgent.getRoles().stream()
                .anyMatch(r -> "HR_ADMIN".equalsIgnoreCase(r.getName()) || "ROLE_HR_ADMIN".equalsIgnoreCase(r.getName()));

        if (ticket.getQueue() != null && !isTargetHrAdmin && !queueMemberRepository.isAgentActiveInQueue(ticket.getQueue().getId(), targetAgent.getId())) {
            throw new IllegalArgumentException("Target user " + targetAgent.getEmail()
                    + " is not an active member of queue '" + ticket.getQueue().getName() + "'");
        }

        // Idempotency check: attempt to double-assign to the same agent without change
        if (ticket.getAssignedAgent() != null && ticket.getAssignedAgent().getId().equals(targetAgent.getId())) {
            throw new IllegalStateException("Ticket " + ticket.getTicketNumber() + " is already assigned to " + targetAgent.getEmail());
        }

        User caller = userRepository.findById(callerId).orElse(null);
        User previousAgent = ticket.getAssignedAgent();

        ticket.setAssignedAgent(targetAgent);
        if (ticket.getStatus() == TicketStatus.NEW) {
            ticket.setStatus(TicketStatus.ASSIGNED);
        }

        String rawReason = request.getReason();
        RoutingReason routingReason = null;
        if (rawReason != null && !rawReason.isBlank()) {
            try {
                routingReason = RoutingReason.valueOf(rawReason.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // Free-text reason from client (e.g., 'Self-assigned from queue') safely mapped to canonical enum
            }
        }

        if (routingReason == null) {
            routingReason = (previousAgent == null) ? RoutingReason.INITIAL_TRIAGE : RoutingReason.MANUAL_REASSIGN;
        }

        TicketRoutingHistory history = TicketRoutingHistory.builder()
                .ticket(ticket)
                .previousAgent(previousAgent)
                .newAgent(targetAgent)
                .reason(routingReason.name())
                .changedBy(caller)
                .build();

        ticketRoutingHistoryRepository.save(history);
        Ticket saved = ticketRepository.save(ticket);

        log.info("Assigned ticket {}: previous={}, new={}, reason={}, rawNote={}, by={}",
                saved.getTicketNumber(),
                previousAgent != null ? previousAgent.getEmail() : "NONE",
                targetAgent.getEmail(),
                routingReason.name(),
                rawReason,
                caller != null ? caller.getEmail() : "SYSTEM");

        return mapTicket(saved, Collections.emptyList());
    }

    // =========================================================================
    // 4. COMMENTS & COLLABORATION
    // =========================================================================

    @Transactional
    public TicketCommentResponse addComment(UUID ticketId, AddCommentRequest request, UUID callerId, boolean isHrAdmin, boolean isSupportAgent) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new IllegalStateException("Cannot add comments to a CLOSED ticket (" + ticket.getTicketNumber() + ")");
        }

        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + callerId));

        boolean isRequester = ticket.getRequester().getId().equals(callerId);
        boolean isAssigned = ticket.getAssignedAgent() != null && ticket.getAssignedAgent().getId().equals(callerId);
        boolean isQueueMember = ticket.getQueue() != null && queueMemberRepository.isAgentActiveInQueue(ticket.getQueue().getId(), callerId);

        if (!isRequester && !isAssigned && !isQueueMember && !isHrAdmin) {
            throw new AccessDeniedException("You are not authorized to comment on ticket " + ticket.getTicketNumber());
        }

        // Determine internal note privilege:
        // Plain requesters CANNOT make internal notes — force false!
        boolean isInternal = false;
        if (isSupportAgent || isHrAdmin) {
            isInternal = Boolean.TRUE.equals(request.getIsInternal());
        }

        TicketComment comment = TicketComment.builder()
                .ticket(ticket)
                .author(caller)
                .content(request.getContent().trim())
                .isInternalNote(isInternal)
                .build();

        TicketComment saved = ticketCommentRepository.save(comment);

        // State machine side effects:
        // 1. If ticket was PENDING_USER and requester commented, advance to IN_PROGRESS
        if (ticket.getStatus() == TicketStatus.PENDING_USER && isRequester) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticketRepository.save(ticket);
        }
        // 2. If ticket was ASSIGNED and assigned agent commented publicly or started work, advance to IN_PROGRESS
        else if (ticket.getStatus() == TicketStatus.ASSIGNED && (isAssigned || isQueueMember) && !isInternal) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticketRepository.save(ticket);
        }

        log.info("Added comment on ticket {}: author={}, isInternal={}",
                ticket.getTicketNumber(), caller.getEmail(), isInternal);

        return mapComment(saved);
    }

    // =========================================================================
    // 5. STATUS TRANSITIONS (RESOLVE, CLOSE, REOPEN)
    // =========================================================================

    @Transactional
    public TicketResponse resolveTicket(UUID ticketId, ResolveTicketRequest request, UUID callerId, boolean isHrAdmin) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        // Skip state guard: NEW tickets cannot jump directly to RESOLVED without triage/assignment
        if (ticket.getStatus() == TicketStatus.NEW) {
            throw new IllegalArgumentException("Ticket " + ticket.getTicketNumber() + " is in NEW status. Must be assigned/in-progress before resolution");
        }

        if (ticket.getStatus() == TicketStatus.RESOLVED) {
            throw new IllegalStateException("Ticket " + ticket.getTicketNumber() + " is already RESOLVED");
        }

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new IllegalStateException("Ticket " + ticket.getTicketNumber() + " is CLOSED and cannot be modified");
        }

        // Authorization: Assigned agent, queue member, or HR Admin
        boolean isAssigned = ticket.getAssignedAgent() != null && ticket.getAssignedAgent().getId().equals(callerId);
        boolean isQueueMember = ticket.getQueue() != null && queueMemberRepository.isAgentActiveInQueue(ticket.getQueue().getId(), callerId);

        if (!isAssigned && !isQueueMember && !isHrAdmin) {
            throw new AccessDeniedException("Only the assigned agent or HR Admin can resolve ticket " + ticket.getTicketNumber());
        }

        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolvedAt(OffsetDateTime.now());

        if (request != null && request.getResolutionNotes() != null && !request.getResolutionNotes().isBlank()) {
            User caller = userRepository.findById(callerId).orElse(null);
            TicketComment resolutionComment = TicketComment.builder()
                    .ticket(ticket)
                    .author(caller)
                    .content("Resolution note: " + request.getResolutionNotes().trim())
                    .isInternalNote(false)
                    .build();
            ticketCommentRepository.save(resolutionComment);
        }

        Ticket saved = ticketRepository.save(ticket);
        log.info("Ticket {} marked RESOLVED by user {}", saved.getTicketNumber(), callerId);
        return mapTicket(saved, Collections.emptyList());
    }

    @Transactional
    public TicketResponse closeTicket(UUID ticketId, CloseTicketRequest request, UUID callerId, boolean isHrAdmin) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        if (ticket.getStatus() == TicketStatus.CLOSED) {
            throw new IllegalStateException("Ticket " + ticket.getTicketNumber() + " is already CLOSED");
        }

        // Must be in RESOLVED state before closing
        if (ticket.getStatus() != TicketStatus.RESOLVED) {
            throw new IllegalArgumentException("Ticket " + ticket.getTicketNumber() + " must be RESOLVED before it can be CLOSED. Current status: " + ticket.getStatus());
        }

        boolean isRequester = ticket.getRequester().getId().equals(callerId);
        if (!isRequester && !isHrAdmin) {
            throw new AccessDeniedException("Only the ticket requester or HR Admin can close a resolved ticket");
        }

        ticket.setStatus(TicketStatus.CLOSED);
        ticket.setClosedAt(OffsetDateTime.now());

        if (request != null && request.getFeedback() != null && !request.getFeedback().isBlank()) {
            User caller = userRepository.findById(callerId).orElse(null);
            TicketComment feedbackComment = TicketComment.builder()
                    .ticket(ticket)
                    .author(caller)
                    .content("Requester closure feedback: " + request.getFeedback().trim())
                    .isInternalNote(false)
                    .build();
            ticketCommentRepository.save(feedbackComment);
        }

        Ticket saved = ticketRepository.save(ticket);
        log.info("Ticket {} CLOSED by user {}", saved.getTicketNumber(), callerId);
        return mapTicket(saved, Collections.emptyList());
    }

    @Transactional
    public TicketResponse reopenTicket(UUID ticketId, String reason, UUID callerId, boolean isHrAdmin) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        if (ticket.getStatus() != TicketStatus.RESOLVED) {
            throw new IllegalStateException("Only RESOLVED tickets can be reopened. Current status: " + ticket.getStatus());
        }

        boolean isRequester = ticket.getRequester().getId().equals(callerId);
        if (!isRequester && !isHrAdmin) {
            throw new AccessDeniedException("Only the ticket requester or HR Admin can reopen a resolved ticket");
        }

        ticket.setStatus(TicketStatus.IN_PROGRESS);
        ticket.setResolvedAt(null);

        User caller = userRepository.findById(callerId).orElse(null);
        TicketComment reopenComment = TicketComment.builder()
                .ticket(ticket)
                .author(caller)
                .content("Ticket reopened: " + (reason != null && !reason.isBlank() ? reason.trim() : "Issue persists"))
                .isInternalNote(false)
                .build();
        ticketCommentRepository.save(reopenComment);

        Ticket saved = ticketRepository.save(ticket);
        log.info("Ticket {} REOPENED by user {}", saved.getTicketNumber(), callerId);
        return mapTicket(saved, Collections.emptyList());
    }

    // =========================================================================
    // 6. ATTACHMENTS
    // =========================================================================

    @Transactional
    public TicketAttachmentResponse addAttachment(UUID ticketId, AddAttachmentRequest request, UUID callerId) {
        return addAttachment(ticketId, request, callerId, false, false);
    }

    @Transactional
    public TicketAttachmentResponse addAttachment(UUID ticketId, AddAttachmentRequest request, UUID callerId, boolean isHrAdmin, boolean isSupportAgent) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        // Authorization check: Requester, assigned agent, queue member, or HR Admin
        boolean isRequester = ticket.getRequester().getId().equals(callerId);
        boolean isAssigned = ticket.getAssignedAgent() != null && ticket.getAssignedAgent().getId().equals(callerId);
        boolean isQueueMember = ticket.getQueue() != null && queueMemberRepository.isAgentActiveInQueue(ticket.getQueue().getId(), callerId);

        if (!isRequester && !isAssigned && !isQueueMember && !isHrAdmin) {
            throw new AccessDeniedException("Not authorized to upload attachments to ticket " + ticket.getTicketNumber());
        }

        // Configurable file size limit
        if (request.getFileSizeBytes() > maxAttachmentSizeBytes) {
            long maxMb = maxAttachmentSizeBytes / (1024 * 1024);
            throw new IllegalArgumentException("Attachment file size exceeds maximum limit of " + maxMb + "MB");
        }

        // Validate and sanitize file name
        if (request.getFileName() == null || request.getFileName().isBlank()) {
            throw new IllegalArgumentException("Attachment file name cannot be blank");
        }

        // Sanitize against directory traversal (e.g., ../ or ..\)
        String rawFileName = request.getFileName().trim();
        String baseName = java.nio.file.Paths.get(rawFileName).getFileName().toString();
        String sanitizedFileName = baseName.replaceAll("[^a-zA-Z0-9._-]", "_");

        String lowerName = sanitizedFileName.toLowerCase();
        if (lowerName.endsWith(".exe") || lowerName.endsWith(".bat") || lowerName.endsWith(".sh") || lowerName.endsWith(".dll") || lowerName.endsWith(".cmd")) {
            throw new IllegalArgumentException("Executable file types are strictly prohibited");
        }

        int dotIndex = sanitizedFileName.lastIndexOf('.');
        if (dotIndex <= 0 || dotIndex == sanitizedFileName.length() - 1) {
            throw new IllegalArgumentException("File must have a valid extension");
        }

        Set<String> permittedExtensions = Arrays.stream(allowedAttachmentExtensions.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());

        String extension = sanitizedFileName.substring(dotIndex + 1).toLowerCase();
        if (!permittedExtensions.contains(extension)) {
            throw new IllegalArgumentException("File extension ." + extension + " is not permitted. Permitted types: " + String.join(", ", permittedExtensions));
        }

        User uploader = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + callerId));

        TicketComment comment = null;
        if (request.getCommentId() != null) {
            comment = ticketCommentRepository.findById(request.getCommentId()).orElse(null);
        }

        String securePath = "tickets/" + ticketId + "/" + UUID.randomUUID() + "_" + sanitizedFileName;

        TicketAttachment attachment = TicketAttachment.builder()
                .ticket(ticket)
                .comment(comment)
                .uploadedBy(uploader)
                .fileName(sanitizedFileName)
                .filePath(securePath)
                .fileSizeBytes(request.getFileSizeBytes())
                .mimeType(request.getMimeType())
                .build();

        TicketAttachment saved = ticketAttachmentRepository.save(attachment);
        log.info("Attachment uploaded for ticket {}: fileName={}, size={} bytes, uploadedBy={}",
                ticket.getTicketNumber(), sanitizedFileName, request.getFileSizeBytes(), uploader.getEmail());
        return mapAttachment(saved);
    }

    // =========================================================================
    // 7. ROUTING HISTORY
    // =========================================================================

    @Transactional(readOnly = true)
    public List<TicketRoutingHistoryResponse> getTicketRoutingHistory(UUID ticketId, UUID callerId, boolean isHrAdmin, boolean isSupportAgent) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found with ID: " + ticketId));

        boolean isRequester = ticket.getRequester().getId().equals(callerId);
        boolean isAssigned = ticket.getAssignedAgent() != null && ticket.getAssignedAgent().getId().equals(callerId);
        boolean isQueueMember = ticket.getQueue() != null && queueMemberRepository.isAgentActiveInQueue(ticket.getQueue().getId(), callerId);

        if (!isRequester && !isAssigned && !isQueueMember && !isHrAdmin) {
            throw new AccessDeniedException("Not authorized to view ticket history");
        }

        return ticketRoutingHistoryRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                .map(this::mapHistory)
                .collect(Collectors.toList());
    }

    // =========================================================================
    // MAPPERS
    // =========================================================================

    private TicketResponse mapTicket(Ticket t, List<TicketCommentResponse> comments) {
        User req = t.getRequester();
        User agent = t.getAssignedAgent();
        TicketCategory cat = t.getCategory();
        SupportQueue queue = t.getQueue();
        SlaPolicy sla = t.getSlaPolicy();

        return TicketResponse.builder()
                .id(t.getId())
                .ticketNumber(t.getTicketNumber())
                .title(t.getTitle())
                .description(t.getDescription())
                .status(t.getStatus())
                .priority(t.getPriority())
                .requesterId(req != null ? req.getId() : null)
                .requesterName(req != null ? req.getFirstName() + " " + req.getLastName() : null)
                .requesterEmail(req != null ? req.getEmail() : null)
                .assigneeId(agent != null ? agent.getId() : null)
                .assignedAgentId(agent != null ? agent.getId() : null)
                .assignedAgentName(agent != null ? agent.getFirstName() + " " + agent.getLastName() : null)
                .assignedAgentEmail(agent != null ? agent.getEmail() : null)
                .categoryId(cat != null ? cat.getId() : null)
                .categoryName(cat != null ? cat.getName() : null)
                .categoryCode(cat != null ? cat.getCode() : null)
                .queueId(queue != null ? queue.getId() : null)
                .queueName(queue != null ? queue.getName() : null)
                .slaPolicyId(sla != null ? sla.getId() : null)
                .slaDueAt(t.getSlaDueAt())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .resolvedAt(t.getResolvedAt())
                .closedAt(t.getClosedAt())
                .comments(comments)
                .build();
    }

    private TicketCommentResponse mapComment(TicketComment c) {
        User author = c.getAuthor();
        return TicketCommentResponse.builder()
                .id(c.getId())
                .ticketId(c.getTicket().getId())
                .authorId(author != null ? author.getId() : null)
                .authorName(author != null ? author.getFirstName() + " " + author.getLastName() : null)
                .authorEmail(author != null ? author.getEmail() : null)
                .content(c.getContent())
                .isInternal(c.getIsInternalNote())
                .isInternalNote(c.getIsInternalNote())
                .createdAt(c.getCreatedAt())
                .build();
    }

    private TicketAttachmentResponse mapAttachment(TicketAttachment a) {
        User uploader = a.getUploadedBy();
        return TicketAttachmentResponse.builder()
                .id(a.getId())
                .ticketId(a.getTicket().getId())
                .commentId(a.getComment() != null ? a.getComment().getId() : null)
                .uploadedById(uploader != null ? uploader.getId() : null)
                .uploadedByName(uploader != null ? uploader.getFirstName() + " " + uploader.getLastName() : null)
                .fileName(a.getFileName())
                .filePath(a.getFilePath())
                .fileSizeBytes(a.getFileSizeBytes())
                .mimeType(a.getMimeType())
                .createdAt(a.getCreatedAt())
                .build();
    }

    private TicketRoutingHistoryResponse mapHistory(TicketRoutingHistory h) {
        User prev = h.getPreviousAgent();
        User next = h.getNewAgent();
        User changed = h.getChangedBy();

        return TicketRoutingHistoryResponse.builder()
                .id(h.getId())
                .ticketId(h.getTicket().getId())
                .previousAgentId(prev != null ? prev.getId() : null)
                .previousAgentName(prev != null ? prev.getFirstName() + " " + prev.getLastName() : null)
                .newAgentId(next != null ? next.getId() : null)
                .newAgentName(next != null ? next.getFirstName() + " " + next.getLastName() : null)
                .reason(h.getReason())
                .changedById(changed != null ? changed.getId() : null)
                .changedByName(changed != null ? changed.getFirstName() + " " + changed.getLastName() : null)
                .createdAt(h.getCreatedAt())
                .build();
    }
}
