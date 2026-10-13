package com.leavemgt.leave.service;

import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.CompOffDecisionRequest;
import com.leavemgt.leave.dto.CompOffResponse;
import com.leavemgt.leave.dto.SubmitCompOffRequest;
import com.leavemgt.leave.entity.*;
import com.leavemgt.leave.repository.BalanceTransactionRepository;
import com.leavemgt.leave.repository.CompOffRequestRepository;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
public class CompOffService {

    private final CompOffRequestRepository compOffRequestRepository;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final LeaveTypeRepository leaveTypeRepository;
    private final BalanceTransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final LeaveBalanceService leaveBalanceService;

    public CompOffService(CompOffRequestRepository compOffRequestRepository,
                          LeaveBalanceRepository leaveBalanceRepository,
                          LeaveTypeRepository leaveTypeRepository,
                          BalanceTransactionRepository transactionRepository,
                          UserRepository userRepository,
                          LeaveBalanceService leaveBalanceService) {
        this.compOffRequestRepository = compOffRequestRepository;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leaveTypeRepository = leaveTypeRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.leaveBalanceService = leaveBalanceService;
    }

    @Transactional
    public CompOffResponse submitRequest(SubmitCompOffRequest request, UUID employeeId) {
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found with ID: " + employeeId));

        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new IllegalArgumentException("Inactive employees cannot submit compensatory off requests");
        }

        LocalDate workedDate = request.getWorkedDate();
        if (workedDate.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Compensatory off worked date cannot be in the future");
        }

        BigDecimal daysEarned = request.getDaysEarned() != null ? request.getDaysEarned() : BigDecimal.ONE;
        if (daysEarned.compareTo(BigDecimal.ZERO) <= 0 || daysEarned.compareTo(new BigDecimal("2.00")) > 0) {
            throw new IllegalArgumentException("Compensatory off days earned must be between 0.5 and 2.0 days");
        }

        boolean alreadyClaimed = compOffRequestRepository.existsByUserIdAndWorkedDateAndStatusIn(
                employeeId, workedDate, List.of(CompOffStatus.PENDING, CompOffStatus.APPROVED));
        if (alreadyClaimed) {
            throw new IllegalArgumentException("A compensatory off claim already exists for worked date: " + workedDate);
        }

        CompOffRequest compOff = CompOffRequest.builder()
                .user(employee)
                .workedDate(workedDate)
                .daysEarned(daysEarned)
                .reason(request.getReason())
                .status(CompOffStatus.PENDING)
                .build();

        CompOffRequest saved = compOffRequestRepository.save(compOff);
        log.info("Compensatory off request submitted by {} for date {} ({} days)",
                employee.getEmail(), workedDate, daysEarned);
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<CompOffResponse> getMyRequests(UUID employeeId) {
        return compOffRequestRepository.findByUserIdOrderByCreatedAtDesc(employeeId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CompOffResponse> getPendingRequests(UUID callerId, boolean isHrAdmin) {
        return compOffRequestRepository.findByStatusOrderByCreatedAtDesc(CompOffStatus.PENDING).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CompOffResponse> getAllRequests(boolean isHrAdmin) {
        return compOffRequestRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CompOffResponse approveRequest(UUID compOffId, CompOffDecisionRequest decision, UUID callerId, boolean isHrAdmin) {
        if (!isHrAdmin) {
            // Verify if caller has manager/admin role
            User caller = userRepository.findById(callerId)
                    .orElseThrow(() -> new IllegalArgumentException("Caller not found: " + callerId));
            boolean hasPrivilege = caller.getRoles().stream().anyMatch(r ->
                    "LINE_MANAGER".equalsIgnoreCase(r.getName()) ||
                    "HR_ADMIN".equalsIgnoreCase(r.getName()) ||
                    "ROLE_HR_ADMIN".equalsIgnoreCase(r.getName()));
            if (!hasPrivilege) {
                throw new AccessDeniedException("Only Managers or HR Admins can approve compensatory off claims");
            }
        }

        CompOffRequest compOff = compOffRequestRepository.findById(compOffId)
                .orElseThrow(() -> new IllegalArgumentException("Compensatory off request not found: " + compOffId));

        if (compOff.getStatus() != CompOffStatus.PENDING) {
            throw new IllegalStateException("Compensatory off request is already " + compOff.getStatus());
        }

        User approver = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("Approver not found: " + callerId));

        int year = LocalDate.now().getYear();
        User employee = compOff.getUser();

        // Find primary leave type for credit (prefer ANNUAL leave or first active leave type)
        LeaveType creditType = leaveTypeRepository.findAllByIsActiveTrue().stream()
                .filter(t -> t.getCode().equalsIgnoreCase("ANNUAL") || t.getName().toLowerCase().contains("annual"))
                .findFirst()
                .orElseGet(() -> leaveTypeRepository.findAllByIsActiveTrue().stream().findFirst()
                        .orElseThrow(() -> new IllegalStateException("No active leave type found to credit compensatory off")));

        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(
                employee.getId(), creditType.getId(), year)
                .orElseGet(() -> {
                    leaveBalanceService.initializeBalancesForUser(employee, year);
                    return leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(employee.getId(), creditType.getId(), year)
                            .orElseThrow(() -> new IllegalStateException("Failed to initialize balance for compensatory off credit"));
                });

        // Credit the balance
        balance.setAccruedDays(balance.getAccruedDays().add(compOff.getDaysEarned()));
        leaveBalanceRepository.save(balance);

        // Record balance transaction
        String comment = decision != null ? decision.getComments() : null;
        BalanceTransaction tx = BalanceTransaction.builder()
                .leaveBalance(balance)
                .transactionType(TransactionType.COMP_OFF_CREDIT)
                .amountDays(compOff.getDaysEarned())
                .description("Compensatory Off credit for work on " + compOff.getWorkedDate() +
                        (comment != null && !comment.isBlank() ? " - " + comment : ""))
                .createdBy(approver)
                .build();
        transactionRepository.save(tx);

        // Update request status
        compOff.setStatus(CompOffStatus.APPROVED);
        compOff.setApprover(approver);
        compOff.setActionedAt(OffsetDateTime.now());
        compOff.setComments(comment);
        CompOffRequest updated = compOffRequestRepository.save(compOff);

        log.info("Compensatory off request {} APPROVED by {} for employee {} (credited {} days)",
                compOffId, approver.getEmail(), employee.getEmail(), compOff.getDaysEarned());
        return mapToResponse(updated);
    }

    @Transactional
    public CompOffResponse rejectRequest(UUID compOffId, CompOffDecisionRequest decision, UUID callerId, boolean isHrAdmin) {
        CompOffRequest compOff = compOffRequestRepository.findById(compOffId)
                .orElseThrow(() -> new IllegalArgumentException("Compensatory off request not found: " + compOffId));

        if (compOff.getStatus() != CompOffStatus.PENDING) {
            throw new IllegalStateException("Compensatory off request is already " + compOff.getStatus());
        }

        User approver = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("Approver not found: " + callerId));

        String comment = decision != null ? decision.getComments() : null;
        compOff.setStatus(CompOffStatus.REJECTED);
        compOff.setApprover(approver);
        compOff.setActionedAt(OffsetDateTime.now());
        compOff.setComments(comment);
        CompOffRequest updated = compOffRequestRepository.save(compOff);

        log.info("Compensatory off request {} REJECTED by {} for employee {}",
                compOffId, approver.getEmail(), compOff.getUser().getEmail());
        return mapToResponse(updated);
    }

    private CompOffResponse mapToResponse(CompOffRequest request) {
        User u = request.getUser();
        User app = request.getApprover();
        return CompOffResponse.builder()
                .id(request.getId())
                .userId(u.getId())
                .employeeName(u.getFullName())
                .employeeEmail(u.getEmail())
                .departmentName(u.getDepartment() != null ? u.getDepartment().getName() : "General")
                .workedDate(request.getWorkedDate())
                .daysEarned(request.getDaysEarned())
                .reason(request.getReason())
                .status(request.getStatus())
                .approverId(app != null ? app.getId() : null)
                .approverName(app != null ? app.getFullName() : null)
                .comments(request.getComments())
                .actionedAt(request.getActionedAt())
                .createdAt(request.getCreatedAt())
                .build();
    }
}
