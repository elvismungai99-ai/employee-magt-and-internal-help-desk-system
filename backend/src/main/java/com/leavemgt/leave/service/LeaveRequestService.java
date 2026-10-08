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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LeaveRequestService {

    private static final Logger log = LoggerFactory.getLogger(LeaveRequestService.class);

    private final LeaveRequestRepository leaveRequestRepository;
    private final LeaveApprovalRepository leaveApprovalRepository;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final LeaveTypeRepository leaveTypeRepository;
    private final BalanceTransactionRepository transactionRepository;
    private final ReportingHierarchyRepository reportingHierarchyRepository;
    private final UserRepository userRepository;
    private final EventPublisherService eventPublisherService;

    public LeaveRequestService(LeaveRequestRepository leaveRequestRepository,
                               LeaveApprovalRepository leaveApprovalRepository,
                               LeaveBalanceRepository leaveBalanceRepository,
                               LeaveTypeRepository leaveTypeRepository,
                               BalanceTransactionRepository transactionRepository,
                               ReportingHierarchyRepository reportingHierarchyRepository,
                               UserRepository userRepository,
                               EventPublisherService eventPublisherService) {
        this.leaveRequestRepository = leaveRequestRepository;
        this.leaveApprovalRepository = leaveApprovalRepository;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leaveTypeRepository = leaveTypeRepository;
        this.transactionRepository = transactionRepository;
        this.reportingHierarchyRepository = reportingHierarchyRepository;
        this.userRepository = userRepository;
        this.eventPublisherService = eventPublisherService;
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

        // 4. Calculate working days (Monday - Friday)
        long workingDays = 0;
        LocalDate curr = startDate;
        while (!curr.isAfter(endDate)) {
            DayOfWeek dow = curr.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                workingDays++;
            }
            curr = curr.plusDays(1);
        }

        if (workingDays == 0) {
            throw new IllegalArgumentException("Leave request must include at least one working day (weekends are excluded)");
        }
        BigDecimal requestedDays = BigDecimal.valueOf(workingDays);

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
                .build();

        LeaveApproval approval = LeaveApproval.builder()
                .leaveRequest(leaveRequest)
                .approver(manager)
                .stepOrder(1)
                .status(ApprovalStatus.PENDING)
                .build();

        leaveRequest.getApprovals().add(approval);
        LeaveRequest saved = leaveRequestRepository.save(leaveRequest);

        log.info("Leave request {} submitted by employee {} for {} days, routed to manager {}",
                saved.getId(), employee.getEmail(), requestedDays, manager.getEmail());

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
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No pending approval found for leave request: " + requestId));

        boolean isAssignedApprover = pendingApproval.getApprover().getId().equals(callerId);
        if (!isAssignedApprover && !isHrAdmin) {
            throw new AccessDeniedException("You are not authorized to approve this leave request. Only the assigned manager or HR Admin can approve.");
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
        String comment = decision != null ? decision.getComments() : null;
        String description = "Leave approval for request " + requestId;
        if (isHrAdmin && !isAssignedApprover) {
            description += " (Approved by HR Admin " + caller.getEmail() + " on behalf of assigned manager)";
            if (comment == null || comment.isBlank()) {
                comment = "Approved by HR Admin on behalf of assigned manager";
            }
        }

        BalanceTransaction tx = BalanceTransaction.builder()
                .leaveBalance(balance)
                .transactionType(TransactionType.DEDUCTION)
                .amountDays(days)
                .description(description)
                .createdBy(caller)
                .build();
        transactionRepository.save(tx);

        // Update approval record
        if (!isAssignedApprover && isHrAdmin) {
            pendingApproval.setApprover(caller);
        }
        pendingApproval.setStatus(ApprovalStatus.APPROVED);
        pendingApproval.setComments(comment);
        pendingApproval.setActionedAt(OffsetDateTime.now());
        leaveApprovalRepository.save(pendingApproval);

        // Update leave request status
        request.setStatus(LeaveRequestStatus.APPROVED);
        LeaveRequest updated = leaveRequestRepository.save(request);

        log.info("Leave request {} APPROVED by user {} (isHrAdmin={})", requestId, caller.getEmail(), isHrAdmin);

        // Publish LeaveApproved event in the same transaction
        eventPublisherService.publishEvent(
                "LeaveApproved",
                "LEAVE",
                Map.of(
                        "leaveRequestId", updated.getId().toString(),
                        "employeeId", updated.getUser().getId().toString(),
                        "employeeName", updated.getUser().getFullName(),
                        "startDate", updated.getStartDate().toString(),
                        "endDate", updated.getEndDate().toString()
                )
        );

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
                .userId(lr.getUser().getId())
                .employeeName(lr.getUser().getFullName())
                .employeeEmail(lr.getUser().getEmail())
                .leaveTypeId(lr.getLeaveType().getId())
                .leaveTypeCode(lr.getLeaveType().getCode())
                .leaveTypeName(lr.getLeaveType().getName())
                .startDate(lr.getStartDate())
                .endDate(lr.getEndDate())
                .totalDays(lr.getTotalDays())
                .reason(lr.getReason())
                .status(lr.getStatus())
                .attachmentUrl(lr.getAttachmentUrl())
                .approvals(approvalResponses)
                .createdAt(lr.getCreatedAt())
                .updatedAt(lr.getUpdatedAt())
                .build();
    }
}
