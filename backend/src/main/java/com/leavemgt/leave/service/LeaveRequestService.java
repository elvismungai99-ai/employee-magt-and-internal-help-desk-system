package com.leavemgt.leave.service;

import com.leavemgt.identity.entity.RelationshipType;
import com.leavemgt.identity.entity.ReportingHierarchy;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.ReportingHierarchyRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.ApprovalDecisionRequest;
import com.leavemgt.leave.dto.LeaveApprovalResponse;
import com.leavemgt.leave.dto.LeaveRequestResponse;
import com.leavemgt.leave.dto.SubmitLeaveRequest;
import com.leavemgt.leave.entity.*;
import com.leavemgt.leave.repository.BalanceTransactionRepository;
import com.leavemgt.leave.repository.LeaveApprovalRepository;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import com.leavemgt.platform.service.EventPublisherService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.leavemgt.leave.dto.DepartmentOverlapResponse;
import com.leavemgt.leave.dto.TeamCapacityDayResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Set;

@Service
public class LeaveRequestService {

    private static final Logger log = LoggerFactory.getLogger(LeaveRequestService.class);

    @Value("${app.leave.attachment-storage-dir:uploads/leave}")
    private String attachmentStorageDir;

    @Value("${app.leave.max-attachment-size-bytes:10485760}")
    private long maxAttachmentSizeBytes;

    @Value("${app.leave.allowed-attachment-extensions:pdf,png,jpg,jpeg,gif,webp,doc,docx}")
    private String allowedAttachmentExtensions;

    private final LeaveRequestRepository leaveRequestRepository;
    private final LeaveApprovalRepository leaveApprovalRepository;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final LeaveTypeRepository leaveTypeRepository;
    private final BalanceTransactionRepository transactionRepository;
    private final ReportingHierarchyRepository reportingHierarchyRepository;
    private final UserRepository userRepository;
    private final EventPublisherService eventPublisherService;
    private final HolidayService holidayService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.leavemgt.platform.service.AuditLogService auditLogService;

    public LeaveRequestService(LeaveRequestRepository leaveRequestRepository,
                               LeaveApprovalRepository leaveApprovalRepository,
                               LeaveBalanceRepository leaveBalanceRepository,
                               LeaveTypeRepository leaveTypeRepository,
                               BalanceTransactionRepository transactionRepository,
                               ReportingHierarchyRepository reportingHierarchyRepository,
                               UserRepository userRepository,
                               EventPublisherService eventPublisherService,
                               HolidayService holidayService) {
        this.leaveRequestRepository = leaveRequestRepository;
        this.leaveApprovalRepository = leaveApprovalRepository;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leaveTypeRepository = leaveTypeRepository;
        this.transactionRepository = transactionRepository;
        this.reportingHierarchyRepository = reportingHierarchyRepository;
        this.userRepository = userRepository;
        this.eventPublisherService = eventPublisherService;
        this.holidayService = holidayService;
    }

    @Transactional
    public LeaveRequestResponse submitRequest(SubmitLeaveRequest request, UUID employeeId) {
        // 1. Validate employee
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found with ID: " + employeeId));

        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new IllegalArgumentException("Inactive employees cannot submit leave requests");
        }

        // 2. Validate leave type
        LeaveType leaveType = leaveTypeRepository.findById(request.getLeaveTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Leave type not found with ID: " + request.getLeaveTypeId()));

        if (!Boolean.TRUE.equals(leaveType.getIsActive())) {
            throw new IllegalArgumentException("Leave type '" + leaveType.getName() + "' is inactive");
        }

        // 3. Validate dates
        LocalDate startDate = request.getStartDate();
        LocalDate endDate = request.getEndDate();

        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        boolean isRetroactivePermitted = leaveType.getName().toLowerCase().contains("sick") ||
                                         leaveType.getName().toLowerCase().contains("emergency") ||
                                         leaveType.getName().toLowerCase().contains("compassionate");
        if (startDate.isBefore(LocalDate.now())) {
            if (!isRetroactivePermitted) {
                throw new IllegalArgumentException("Leave start date cannot be in the past for " + leaveType.getName());
            }
            if (startDate.isBefore(LocalDate.now().minusDays(14))) {
                throw new IllegalArgumentException("Retroactive leave request for " + leaveType.getName() + " cannot exceed 14 days in the past");
            }
        }

        // 4. Calculate working days (Monday - Friday, excluding gazetted public holidays)
        boolean isHalfDay = Boolean.TRUE.equals(request.getIsHalfDay());
        String halfDayPeriod = request.getHalfDayPeriod() != null ? request.getHalfDayPeriod().toUpperCase().trim() : "MORNING";
        if (isHalfDay) {
            if (!startDate.isEqual(endDate)) {
                throw new IllegalArgumentException("Half-day leave requests must have the same start and end date");
            }
            if (!"MORNING".equals(halfDayPeriod) && !"AFTERNOON".equals(halfDayPeriod)) {
                halfDayPeriod = "MORNING";
            }
        }

        long workingDays = holidayService.calculateWorkingDays(startDate, endDate);
        if (workingDays == 0) {
            throw new IllegalArgumentException("Leave request must include at least one working day (weekends and gazetted public holidays are excluded)");
        }
        BigDecimal requestedDays = isHalfDay ? new BigDecimal("0.50") : BigDecimal.valueOf(workingDays);

        // Optional coverage delegate
        User delegate = null;
        if (request.getDelegateId() != null) {
            if (request.getDelegateId().equals(employeeId)) {
                throw new IllegalArgumentException("You cannot designate yourself as your coverage delegate");
            }
            delegate = userRepository.findById(request.getDelegateId())
                    .filter(u -> "ACTIVE".equalsIgnoreCase(u.getStatus()))
                    .orElseThrow(() -> new IllegalArgumentException("Coverage delegate not found or inactive"));
        }

        // 5. Overlap check
        List<LeaveRequestStatus> activeStatuses = List.of(LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED);
        List<LeaveRequest> overlaps = leaveRequestRepository.findOverlappingRequests(
                employeeId, startDate, endDate, activeStatuses);
        if (!overlaps.isEmpty()) {
            throw new IllegalArgumentException("A pending or approved leave request already exists for the selected date range");
        }

        // 6. Find reporting line manager for approval routing (with HR Admin fallback)
        List<ReportingHierarchy> hierarchyList = reportingHierarchyRepository.findActiveHierarchyForEmployeeAndType(
                employeeId, RelationshipType.DIRECT, LocalDate.now());
        if (hierarchyList.isEmpty()) {
            hierarchyList = reportingHierarchyRepository.findActiveHierarchyForEmployee(employeeId, LocalDate.now());
        }

        User manager = null;
        if (!hierarchyList.isEmpty() && hierarchyList.get(0).getManager() != null) {
            manager = hierarchyList.get(0).getManager();
        } else {
            // Graceful fallback to HR Admin when direct manager is unassigned
            manager = userRepository.findAll().stream()
                    .filter(u -> "ACTIVE".equalsIgnoreCase(u.getStatus()))
                    .filter(u -> u.getRoles().stream().anyMatch(r -> "HR_ADMIN".equalsIgnoreCase(r.getName()) || "ROLE_HR_ADMIN".equalsIgnoreCase(r.getName())))
                    .filter(u -> !u.getId().equals(employeeId))
                    .findFirst()
                    .orElse(null);
            if (manager == null) {
                throw new IllegalArgumentException("Cannot submit leave request: No active direct manager assigned in reporting hierarchy");
            }
            log.info("No direct manager assigned for employee {}; routing approval to HR Admin {}",
                    employee.getEmail(), manager.getEmail());
        }

        // 7. Balance check & pessimistic hold
        int year = startDate.getYear();
        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(
                employeeId, leaveType.getId(), year)
                .orElseThrow(() -> new IllegalArgumentException("No leave balance record found for " + leaveType.getName() + " in year " + year));

        BigDecimal availableDays = balance.getAccruedDays().add(balance.getCarriedOverDays())
                .subtract(balance.getUsedDays())
                .subtract(balance.getPendingDays());

        if (requestedDays.compareTo(availableDays) > 0) {
            throw new IllegalArgumentException(String.format(
                    "Insufficient leave balance. Requested: %s days, Available: %s days", requestedDays, availableDays));
        }

        // Place hold on pending days
        balance.setPendingDays(balance.getPendingDays().add(requestedDays));
        leaveBalanceRepository.save(balance);

        // 8. Persist Leave Request & Initial Approval Step
        LeaveRequest leaveRequest = LeaveRequest.builder()
                .user(employee)
                .leaveType(leaveType)
                .startDate(startDate)
                .endDate(endDate)
                .totalDays(requestedDays)
                .reason(request.getReason())
                .status(LeaveRequestStatus.PENDING)
                .attachmentUrl(request.getAttachmentUrl())
                .isHalfDay(isHalfDay)
                .halfDayPeriod(isHalfDay ? halfDayPeriod : null)
                .delegate(delegate)
                .build();

        LeaveApproval approval = LeaveApproval.builder()
                .leaveRequest(leaveRequest)
                .approver(manager)
                .stepOrder(1)
                .status(ApprovalStatus.PENDING)
                .build();
        leaveRequest.getApprovals().add(approval);

        // Multi-stage approval routing: Check if employee has a secondary dotted-line manager
        List<ReportingHierarchy> dottedList = reportingHierarchyRepository.findActiveHierarchyForEmployeeAndType(
                employeeId, RelationshipType.DOTTED_LINE, LocalDate.now());
        if (!dottedList.isEmpty() && dottedList.get(0).getManager() != null
                && !dottedList.get(0).getManager().getId().equals(manager.getId())) {
            User secondaryManager = dottedList.get(0).getManager();
            LeaveApproval secondaryApproval = LeaveApproval.builder()
                    .leaveRequest(leaveRequest)
                    .approver(secondaryManager)
                    .stepOrder(2)
                    .status(ApprovalStatus.PENDING)
                    .build();
            leaveRequest.getApprovals().add(secondaryApproval);
            log.info("Multi-stage approval configured for employee {}: Step 1 -> {}, Step 2 -> {}",
                    employee.getEmail(), manager.getEmail(), secondaryManager.getEmail());
        }

        LeaveRequest saved = leaveRequestRepository.save(leaveRequest);

        if (auditLogService != null) {
            auditLogService.log(employee.getId(), employee.getEmail(), "LEAVE_REQUESTED", "LEAVE_REQUEST", saved.getId().toString(), "Requested " + saved.getTotalDays() + " days of " + leaveType.getName(), null);
        }

        log.info("Leave request {} submitted by employee {} for {} days, routed to manager {}",
                saved.getId(), employee.getEmail(), requestedDays, manager.getEmail());

        // Publish LeaveRequested event for outbox and notification webhooks
        Map<String, Object> reqPayload = new HashMap<>();
        reqPayload.put("leaveRequestId", saved.getId().toString());
        reqPayload.put("employeeId", saved.getUser().getId().toString());
        reqPayload.put("employeeName", saved.getUser().getFullName());
        reqPayload.put("employeeEmail", saved.getUser().getEmail());
        reqPayload.put("leaveTypeName", saved.getLeaveType().getName());
        reqPayload.put("startDate", saved.getStartDate().toString());
        reqPayload.put("endDate", saved.getEndDate().toString());
        reqPayload.put("totalDays", saved.getTotalDays().toString());
        reqPayload.put("managerId", manager.getId().toString());
        reqPayload.put("managerEmail", manager.getEmail());
        eventPublisherService.publishEvent("LeaveRequested", "LEAVE", reqPayload);

        return mapToResponse(saved);
    }

    @Transactional
    public LeaveRequestResponse approveRequest(UUID requestId, ApprovalDecisionRequest decision, UUID callerId, boolean isHrAdmin) {
        LeaveRequest request = leaveRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found: " + requestId));

        if (request.getStatus() != LeaveRequestStatus.PENDING) {
            throw new IllegalStateException("Leave request cannot be approved because it is already " + request.getStatus());
        }

        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + callerId));

        List<LeaveApproval> approvals = leaveApprovalRepository.findByLeaveRequestId(requestId);
        LeaveApproval pendingApproval = approvals.stream()
                .filter(a -> a.getStatus() == ApprovalStatus.PENDING)
                .min(Comparator.comparing(LeaveApproval::getStepOrder))
                .orElseThrow(() -> new IllegalStateException("No pending approval found for leave request: " + requestId));

        boolean isAssignedApprover = pendingApproval.getApprover().getId().equals(callerId);
        if (!isAssignedApprover && !isHrAdmin) {
            throw new AccessDeniedException("You are not authorized to approve this leave request. Only the assigned manager or HR Admin can approve.");
        }

        // Update approval record
        String comment = decision != null ? decision.getComments() : null;
        if (!isAssignedApprover && isHrAdmin) {
            pendingApproval.setApprover(caller);
            if (comment == null || comment.isBlank()) {
                comment = "Approved by HR Admin on behalf of assigned manager";
            }
        }
        pendingApproval.setStatus(ApprovalStatus.APPROVED);
        pendingApproval.setComments(comment);
        pendingApproval.setActionedAt(OffsetDateTime.now());
        leaveApprovalRepository.save(pendingApproval);

        // Multi-stage progression: Check if there is another pending stage (unless HR Admin overrides all)
        boolean hasNextPendingStage = !isHrAdmin && approvals.stream()
                .anyMatch(a -> a.getStepOrder() > pendingApproval.getStepOrder() && a.getStatus() == ApprovalStatus.PENDING);

        if (hasNextPendingStage) {
            log.info("Leave request {} Step {} APPROVED by {}; waiting for subsequent stage",
                    requestId, pendingApproval.getStepOrder(), caller.getEmail());
            return mapToResponse(request);
        }

        // If HR Admin approved, mark any remaining pending steps as APPROVED by HR Admin
        if (isHrAdmin) {
            for (LeaveApproval a : approvals) {
                if (a.getStatus() == ApprovalStatus.PENDING) {
                    a.setStatus(ApprovalStatus.APPROVED);
                    a.setApprover(caller);
                    a.setActionedAt(OffsetDateTime.now());
                    a.setComments("Fast-tracked by HR Admin");
                    leaveApprovalRepository.save(a);
                }
            }
        }

        // Balance deduction & release of pending hold
        int year = request.getStartDate().getYear();
        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(
                request.getUser().getId(), request.getLeaveType().getId(), year)
                .orElseThrow(() -> new IllegalStateException("Leave balance record not found for employee"));

        BigDecimal days = request.getTotalDays();
        BigDecimal newPending = balance.getPendingDays().subtract(days);
        if (newPending.compareTo(BigDecimal.ZERO) < 0) {
            newPending = BigDecimal.ZERO;
        }
        balance.setPendingDays(newPending);
        balance.setUsedDays(balance.getUsedDays().add(days));

        // Integrity check
        if (balance.getUsedDays().compareTo(balance.getAccruedDays().add(balance.getCarriedOverDays())) > 0) {
            throw new IllegalStateException("Integrity violation: used days exceeds accrued plus carried over days");
        }
        leaveBalanceRepository.save(balance);

        // Record balance deduction transaction
        String description = "Leave approval for request " + requestId;
        if (isHrAdmin && !isAssignedApprover) {
            description += " (Approved by HR Admin " + caller.getEmail() + " on behalf of assigned manager)";
        }

        BalanceTransaction tx = BalanceTransaction.builder()
                .leaveBalance(balance)
                .transactionType(TransactionType.DEDUCTION)
                .amountDays(days)
                .description(description)
                .createdBy(caller)
                .build();
        transactionRepository.save(tx);

        // Update leave request status
        request.setStatus(LeaveRequestStatus.APPROVED);
        LeaveRequest updated = leaveRequestRepository.save(request);

        if (auditLogService != null) {
            auditLogService.log(caller.getId(), caller.getEmail(), "LEAVE_APPROVED", "LEAVE_REQUEST", updated.getId().toString(), "Approved leave request for " + updated.getUser().getFullName(), null);
        }

        log.info("Leave request {} APPROVED by user {} (isHrAdmin={})", requestId, caller.getEmail(), isHrAdmin);

        // Publish LeaveApproved event in the same transaction
        Map<String, Object> eventPayload = new HashMap<>();
        eventPayload.put("leaveRequestId", updated.getId().toString());
        eventPayload.put("employeeId", updated.getUser().getId().toString());
        eventPayload.put("employeeName", updated.getUser().getFullName());
        eventPayload.put("startDate", updated.getStartDate().toString());
        eventPayload.put("endDate", updated.getEndDate().toString());
        eventPayload.put("delegateId", updated.getDelegate() != null ? updated.getDelegate().getId().toString() : "");
        eventPayload.put("delegateName", updated.getDelegate() != null ? updated.getDelegate().getFullName() : "");

        eventPublisherService.publishEvent("LeaveApproved", "LEAVE", eventPayload);

        return mapToResponse(updated);
    }

    @Transactional
    public LeaveRequestResponse rejectRequest(UUID requestId, ApprovalDecisionRequest decision, UUID callerId, boolean isHrAdmin) {
        LeaveRequest request = leaveRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found: " + requestId));

        if (request.getStatus() != LeaveRequestStatus.PENDING) {
            throw new IllegalStateException("Leave request cannot be rejected because it is already " + request.getStatus());
        }

        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + callerId));

        List<LeaveApproval> approvals = leaveApprovalRepository.findByLeaveRequestId(requestId);
        LeaveApproval pendingApproval = approvals.stream()
                .filter(a -> a.getStatus() == ApprovalStatus.PENDING)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No pending approval found for leave request: " + requestId));

        boolean isAssignedApprover = pendingApproval.getApprover().getId().equals(callerId);
        if (!isAssignedApprover && !isHrAdmin) {
            throw new AccessDeniedException("You are not authorized to reject this leave request. Only the assigned manager or HR Admin can reject.");
        }

        // Release pending hold on balance
        int year = request.getStartDate().getYear();
        leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(
                request.getUser().getId(), request.getLeaveType().getId(), year)
                .ifPresent(balance -> {
                    BigDecimal newPending = balance.getPendingDays().subtract(request.getTotalDays());
                    if (newPending.compareTo(BigDecimal.ZERO) < 0) {
                        newPending = BigDecimal.ZERO;
                    }
                    balance.setPendingDays(newPending);
                    leaveBalanceRepository.save(balance);
                });

        String comment = decision != null ? decision.getComments() : null;
        if (isHrAdmin && !isAssignedApprover) {
            pendingApproval.setApprover(caller);
            if (comment == null || comment.isBlank()) {
                comment = "Rejected by HR Admin on behalf of assigned manager";
            }
        }

        pendingApproval.setStatus(ApprovalStatus.REJECTED);
        pendingApproval.setComments(comment);
        pendingApproval.setActionedAt(OffsetDateTime.now());
        leaveApprovalRepository.save(pendingApproval);

        request.setStatus(LeaveRequestStatus.REJECTED);
        LeaveRequest updated = leaveRequestRepository.save(request);

        if (auditLogService != null) {
            auditLogService.log(caller.getId(), caller.getEmail(), "LEAVE_REJECTED", "LEAVE_REQUEST", updated.getId().toString(), "Rejected leave request for " + updated.getUser().getFullName(), null);
        }

        log.info("Leave request {} REJECTED by user {} (isHrAdmin={})", requestId, caller.getEmail(), isHrAdmin);

        return mapToResponse(updated);
    }

    @Transactional
    public LeaveRequestResponse cancelRequest(UUID requestId, UUID callerId) {
        LeaveRequest request = leaveRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found: " + requestId));

        if (!request.getUser().getId().equals(callerId)) {
            throw new AccessDeniedException("You are only permitted to cancel your own leave requests");
        }

        if (request.getStatus() != LeaveRequestStatus.PENDING && request.getStatus() != LeaveRequestStatus.APPROVED) {
            throw new IllegalStateException("Cannot cancel leave request: Only PENDING or APPROVED requests can be cancelled (current status: " + request.getStatus() + ")");
        }

        // Prevent retroactive cancellation and fraudulent balance refunds for leave periods already commenced or passed
        if (request.getStatus() == LeaveRequestStatus.APPROVED && !request.getStartDate().isAfter(LocalDate.now())) {
            throw new IllegalStateException("Approved leave cannot be cancelled once the leave period has commenced or passed. Please contact HR for adjustments.");
        }

        int year = request.getStartDate().getYear();
        leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(
                request.getUser().getId(), request.getLeaveType().getId(), year)
                .ifPresent(balance -> {
                    if (request.getStatus() == LeaveRequestStatus.APPROVED) {
                        BigDecimal newUsed = balance.getUsedDays().subtract(request.getTotalDays());
                        if (newUsed.compareTo(BigDecimal.ZERO) < 0) {
                            newUsed = BigDecimal.ZERO;
                        }
                        balance.setUsedDays(newUsed);
                        leaveBalanceRepository.save(balance);

                        BalanceTransaction tx = BalanceTransaction.builder()
                                .leaveBalance(balance)
                                .transactionType(TransactionType.REVERSAL)
                                .amountDays(request.getTotalDays())
                                .description("Reversal due to cancellation of approved leave request " + requestId)
                                .createdBy(request.getUser())
                                .build();
                        transactionRepository.save(tx);
                    } else {
                        BigDecimal newPending = balance.getPendingDays().subtract(request.getTotalDays());
                        if (newPending.compareTo(BigDecimal.ZERO) < 0) {
                            newPending = BigDecimal.ZERO;
                        }
                        balance.setPendingDays(newPending);
                        leaveBalanceRepository.save(balance);
                    }
                });

        request.setStatus(LeaveRequestStatus.CANCELLED);
        LeaveRequest updated = leaveRequestRepository.save(request);

        if (auditLogService != null) {
            auditLogService.log(callerId, updated.getUser().getEmail(), "LEAVE_CANCELLED", "LEAVE_REQUEST", updated.getId().toString(), "Cancelled leave request", null);
        }

        log.info("Leave request {} CANCELLED by employee {}", requestId, callerId);

        // Publish LeaveCancelled event in the same transaction
        eventPublisherService.publishEvent(
                "LeaveCancelled",
                "LEAVE",
                Map.of(
                        "leaveRequestId", updated.getId().toString(),
                        "employeeId", updated.getUser().getId().toString(),
                        "startDate", updated.getStartDate().toString(),
                        "endDate", updated.getEndDate().toString()
                )
        );

        return mapToResponse(updated);
    }

    @Transactional(readOnly = true)
    public List<LeaveRequestResponse> getMyRequests(UUID employeeId) {
        return leaveRequestRepository.findAllByUserIdOrderByCreatedAtDesc(employeeId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeaveRequestResponse> getAllRequests(UUID callerId, boolean isHrAdmin) {
        List<LeaveRequest> requests;
        if (isHrAdmin) {
            requests = leaveRequestRepository.findAllByOrderByCreatedAtDesc();
        } else {
            requests = leaveRequestRepository.findAllByUserIdOrderByCreatedAtDesc(callerId);
        }
        return requests.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeaveRequestResponse> getPendingApprovalsForCaller(UUID callerId, boolean isHrAdmin) {
        List<LeaveApproval> pendingApprovals;
        if (isHrAdmin) {
            pendingApprovals = leaveApprovalRepository.findByStatusOrderByCreatedAtDesc(ApprovalStatus.PENDING);
        } else {
            pendingApprovals = leaveApprovalRepository.findByApproverIdAndStatusOrderByCreatedAtDesc(callerId, ApprovalStatus.PENDING);
        }

        return pendingApprovals.stream()
                .map(LeaveApproval::getLeaveRequest)
                .filter(lr -> lr != null && lr.getStatus() == LeaveRequestStatus.PENDING)
                .distinct()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public LeaveRequestResponse getRequestById(UUID requestId, UUID callerId, boolean isHrAdmin) {
        LeaveRequest request = leaveRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found: " + requestId));

        boolean isOwner = request.getUser().getId().equals(callerId);
        boolean isApprover = request.getApprovals().stream()
                .anyMatch(a -> a.getApprover() != null && a.getApprover().getId().equals(callerId));

        if (!isOwner && !isApprover && !isHrAdmin) {
            throw new AccessDeniedException("You do not have permission to view this leave request");
        }

        return mapToResponse(request);
    }

    public LeaveRequestResponse mapToResponse(LeaveRequest lr) {
        List<LeaveApprovalResponse> approvalResponses = lr.getApprovals() != null ?
                lr.getApprovals().stream().map(a -> LeaveApprovalResponse.builder()
                        .id(a.getId())
                        .approverId(a.getApprover() != null ? a.getApprover().getId() : null)
                        .approverName(a.getApprover() != null ? a.getApprover().getFullName() : null)
                        .approverEmail(a.getApprover() != null ? a.getApprover().getEmail() : null)
                        .stepOrder(a.getStepOrder())
                        .status(a.getStatus())
                        .comments(a.getComments())
                        .actionedAt(a.getActionedAt())
                        .build()
                ).collect(Collectors.toList()) : List.of();

        return LeaveRequestResponse.builder()
                .id(lr.getId())
                .userId(lr.getUser() != null ? lr.getUser().getId() : null)
                .employeeName(lr.getUser() != null ? lr.getUser().getFullName() : "Employee")
                .employeeEmail(lr.getUser() != null ? lr.getUser().getEmail() : "")
                .leaveTypeId(lr.getLeaveType() != null ? lr.getLeaveType().getId() : null)
                .leaveTypeCode(lr.getLeaveType() != null ? lr.getLeaveType().getCode() : "LEAVE")
                .leaveTypeName(lr.getLeaveType() != null ? lr.getLeaveType().getName() : "Leave")
                .startDate(lr.getStartDate())
                .endDate(lr.getEndDate())
                .totalDays(lr.getTotalDays())
                .reason(lr.getReason())
                .status(lr.getStatus())
                .attachmentUrl(lr.getAttachmentUrl())
                .isHalfDay(lr.getIsHalfDay() != null ? lr.getIsHalfDay() : false)
                .halfDayPeriod(lr.getHalfDayPeriod())
                .delegateId(lr.getDelegate() != null ? lr.getDelegate().getId() : null)
                .delegateName(lr.getDelegate() != null ? lr.getDelegate().getFullName() : null)
                .approvals(approvalResponses)
                .createdAt(lr.getCreatedAt())
                .updatedAt(lr.getUpdatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<DepartmentOverlapResponse> getDepartmentOverlap(UUID callerId, LocalDate startDate, LocalDate endDate, UUID departmentId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + callerId));

        UUID deptId = departmentId;
        if (deptId == null && caller.getDepartment() != null) {
            deptId = caller.getDepartment().getId();
        }

        if (deptId == null) {
            return List.of();
        }

        List<LeaveRequestStatus> activeStatuses = List.of(LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED);
        List<LeaveRequest> overlaps = leaveRequestRepository.findOverlappingDepartmentRequests(
                deptId, startDate, endDate, activeStatuses);

        return overlaps.stream()
                .filter(lr -> !lr.getUser().getId().equals(callerId))
                .map(lr -> DepartmentOverlapResponse.builder()
                        .requestId(lr.getId())
                        .userId(lr.getUser().getId())
                        .employeeName(lr.getUser().getFullName())
                        .employeeEmail(lr.getUser().getEmail())
                        .departmentName(lr.getUser().getDepartment() != null ? lr.getUser().getDepartment().getName() : "General")
                        .leaveTypeName(lr.getLeaveType().getName())
                        .startDate(lr.getStartDate())
                        .endDate(lr.getEndDate())
                        .totalDays(lr.getTotalDays())
                        .status(lr.getStatus())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TeamCapacityDayResponse> getTeamCapacityHeatmap(UUID callerId, LocalDate startDate, LocalDate endDate, UUID departmentId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + callerId));

        if (startDate == null) {
            startDate = LocalDate.now();
        }
        if (endDate == null) {
            endDate = startDate.plusDays(30);
        }
        if (startDate.isAfter(endDate)) {
            LocalDate tmp = startDate;
            startDate = endDate;
            endDate = tmp;
        }

        UUID deptId = departmentId;
        if (deptId == null && caller.getDepartment() != null) {
            deptId = caller.getDepartment().getId();
        }

        List<User> deptMembers = (deptId != null)
                ? userRepository.findByDepartmentId(deptId)
                : userRepository.findAll();
        int totalMembers = Math.max(1, deptMembers.size());

        List<LeaveRequestStatus> activeStatuses = List.of(LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED);
        List<LeaveRequest> overlappingRequests;
        if (deptId != null) {
            overlappingRequests = leaveRequestRepository.findOverlappingDepartmentRequests(deptId, startDate, endDate, activeStatuses);
        } else {
            final LocalDate sDate = startDate;
            final LocalDate eDate = endDate;
            overlappingRequests = leaveRequestRepository.findAllByOrderByCreatedAtDesc().stream()
                    .filter(r -> activeStatuses.contains(r.getStatus()))
                    .filter(r -> !r.getStartDate().isAfter(eDate) && !r.getEndDate().isBefore(sDate))
                    .collect(Collectors.toList());
        }

        List<TeamCapacityDayResponse> result = new java.util.ArrayList<>();
        LocalDate curr = startDate;
        while (!curr.isAfter(endDate)) {
            final LocalDate day = curr;
            List<String> onLeaveNames = overlappingRequests.stream()
                    .filter(r -> !day.isBefore(r.getStartDate()) && !day.isAfter(r.getEndDate()))
                    .map(r -> r.getUser() != null ? r.getUser().getFullName() : "Employee")
                    .distinct()
                    .collect(Collectors.toList());

            int onLeaveCount = onLeaveNames.size();
            int availableCount = Math.max(0, totalMembers - onLeaveCount);
            double capacityPct = Math.round(((double) availableCount / totalMembers * 100.0) * 10.0) / 10.0;
            boolean isBottleneck = capacityPct < 75.0;

            result.add(TeamCapacityDayResponse.builder()
                    .date(day)
                    .dayOfWeek(day.getDayOfWeek().name())
                    .totalDepartmentMembers(totalMembers)
                    .totalActiveEmployees(totalMembers)
                    .onLeaveCount(onLeaveCount)
                    .absentEmployeesCount(onLeaveCount)
                    .availableCount(availableCount)
                    .availableCapacityCount(availableCount)
                    .capacityPercentage(capacityPct)
                    .isBottleneck(isBottleneck)
                    .onLeaveEmployees(onLeaveNames)
                    .absentEmployeeNames(onLeaveNames)
                    .build());

            curr = curr.plusDays(1);
        }

        return result;
    }

    public String uploadAttachmentFile(MultipartFile file, UUID callerId) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Attachment file cannot be empty");
        }

        if (file.getSize() > maxAttachmentSizeBytes) {
            long maxMb = maxAttachmentSizeBytes / (1024 * 1024);
            throw new IllegalArgumentException("Attachment file size exceeds maximum limit of " + maxMb + "MB");
        }

        String rawFileName = file.getOriginalFilename() != null ? file.getOriginalFilename().trim() : "attachment";
        String baseName = Paths.get(rawFileName).getFileName().toString();
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

        Path targetDir = Paths.get(attachmentStorageDir);
        Files.createDirectories(targetDir);
        String uniqueFileName = UUID.randomUUID() + "_" + sanitizedFileName;
        Path targetPath = targetDir.resolve(uniqueFileName);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        log.info("Saved leave attachment {} for user {}", uniqueFileName, callerId);
        return "/api/leave/requests/attachments/" + uniqueFileName;
    }

    public Resource getAttachmentResource(String fileName) throws IOException {
        if (fileName == null || fileName.isBlank() || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name requested");
        }

        Path filePath = Paths.get(attachmentStorageDir).resolve(fileName).normalize();
        if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
            throw new IllegalArgumentException("Attachment file not found: " + fileName);
        }

        return new UrlResource(filePath.toUri());
    }

    @Transactional(readOnly = true)
    public byte[] exportCalendarIcs(UUID requestId, UUID callerId, boolean isHrAdmin) {
        LeaveRequest request = leaveRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found: " + requestId));

        boolean isOwner = request.getUser().getId().equals(callerId);
        boolean isApprover = request.getApprovals().stream()
                .anyMatch(a -> a.getApprover() != null && a.getApprover().getId().equals(callerId));

        if (!isOwner && !isApprover && !isHrAdmin) {
            throw new AccessDeniedException("You do not have permission to export calendar for this leave request");
        }

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyyMMdd");
        DateTimeFormatter utcFormat = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
        String dtStamp = OffsetDateTime.now(java.time.ZoneOffset.UTC).format(utcFormat);
        String dtStart = request.getStartDate().format(dtf);
        String dtEnd = request.getEndDate().plusDays(1).format(dtf);

        String employeeName = request.getUser().getFullName();
        String leaveTypeName = request.getLeaveType().getName();
        String summary = "Leave: " + leaveTypeName + " - " + employeeName;
        String cleanReason = request.getReason() != null ? request.getReason().replace("\n", " ").replace("\r", " ") : "";
        String description = "Employee: " + employeeName + "\\nLeave Type: " + leaveTypeName +
                "\\nTotal Days: " + request.getTotalDays() + "\\nReason: " + cleanReason +
                "\\nStatus: " + request.getStatus();

        String icsContent = "BEGIN:VCALENDAR\r\n" +
                "VERSION:2.0\r\n" +
                "PRODID:-//Leave Management System//EN\r\n" +
                "CALSCALE:GREGORIAN\r\n" +
                "METHOD:PUBLISH\r\n" +
                "BEGIN:VEVENT\r\n" +
                "UID:leave-" + request.getId() + "@" + (request.getUser() != null && request.getUser().getEmail() != null && request.getUser().getEmail().contains("@") ? request.getUser().getEmail().substring(request.getUser().getEmail().indexOf('@') + 1) : "leavemgt.local") + "\r\n" +
                "DTSTAMP:" + dtStamp + "\r\n" +
                "DTSTART;VALUE=DATE:" + dtStart + "\r\n" +
                "DTEND;VALUE=DATE:" + dtEnd + "\r\n" +
                "SUMMARY:" + summary + "\r\n" +
                "DESCRIPTION:" + description + "\r\n" +
                "STATUS:CONFIRMED\r\n" +
                "TRANSP:OPAQUE\r\n" +
                "END:VEVENT\r\n" +
                "END:VCALENDAR\r\n";

        return icsContent.getBytes(StandardCharsets.UTF_8);
    }
}
