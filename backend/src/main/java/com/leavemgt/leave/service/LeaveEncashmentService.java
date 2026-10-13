package com.leavemgt.leave.service;

import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.EncashmentDecisionRequest;
import com.leavemgt.leave.dto.LeaveEncashmentResponse;
import com.leavemgt.leave.dto.SubmitEncashmentRequest;
import com.leavemgt.leave.entity.*;
import com.leavemgt.leave.repository.BalanceTransactionRepository;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeaveEncashmentRequestRepository;
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
public class LeaveEncashmentService {

    private final LeaveEncashmentRequestRepository encashmentRepository;
    private final LeaveBalanceRepository balanceRepository;
    private final LeaveTypeRepository typeRepository;
    private final BalanceTransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public LeaveEncashmentService(LeaveEncashmentRequestRepository encashmentRepository,
                                  LeaveBalanceRepository balanceRepository,
                                  LeaveTypeRepository typeRepository,
                                  BalanceTransactionRepository transactionRepository,
                                  UserRepository userRepository) {
        this.encashmentRepository = encashmentRepository;
        this.balanceRepository = balanceRepository;
        this.typeRepository = typeRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public LeaveEncashmentResponse submitRequest(SubmitEncashmentRequest request, UUID employeeId) {
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found with ID: " + employeeId));

        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new IllegalArgumentException("Inactive employees cannot submit leave encashment requests");
        }

        LeaveType leaveType = typeRepository.findById(request.getLeaveTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Leave type not found with ID: " + request.getLeaveTypeId()));

        if (!Boolean.TRUE.equals(leaveType.getIsActive())) {
            throw new IllegalArgumentException("Leave type is inactive");
        }

        BigDecimal days = request.getDaysRequested();
        if (days == null || days.compareTo(new BigDecimal("0.50")) < 0) {
            throw new IllegalArgumentException("Minimum leave encashment request is 0.5 days");
        }

        int currentYear = LocalDate.now().getYear();
        LeaveBalance balance = balanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(
                employeeId, leaveType.getId(), currentYear)
                .orElseThrow(() -> new IllegalArgumentException("No leave balance found for " + leaveType.getName() + " in year " + currentYear));

        BigDecimal availableDays = balance.getAvailableDays();
        if (days.compareTo(availableDays) > 0) {
            throw new IllegalArgumentException(String.format(
                    "Insufficient available balance for encashment. Requested: %s days, Available: %s days",
                    days, availableDays));
        }

        LeaveEncashmentRequest encashment = LeaveEncashmentRequest.builder()
                .user(employee)
                .leaveType(leaveType)
                .daysRequested(days)
                .year(currentYear)
                .reason(request.getReason())
                .status(EncashmentStatus.PENDING)
                .build();

        LeaveEncashmentRequest saved = encashmentRepository.save(encashment);
        log.info("Leave encashment request submitted by {} for {} days of {}",
                employee.getEmail(), days, leaveType.getName());
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<LeaveEncashmentResponse> getMyRequests(UUID employeeId) {
        return encashmentRepository.findByUserIdOrderByCreatedAtDesc(employeeId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeaveEncashmentResponse> getPendingRequests() {
        return encashmentRepository.findByStatusOrderByCreatedAtDesc(EncashmentStatus.PENDING).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeaveEncashmentResponse> getAllRequests() {
        return encashmentRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public LeaveEncashmentResponse approveRequest(UUID encashmentId, EncashmentDecisionRequest decision, UUID callerId, boolean isHrAdmin) {
        if (!isHrAdmin) {
            throw new AccessDeniedException("Only HR Administrators are authorized to approve leave encashment requests");
        }

        LeaveEncashmentRequest encashment = encashmentRepository.findById(encashmentId)
                .orElseThrow(() -> new IllegalArgumentException("Encashment request not found with ID: " + encashmentId));

        if (encashment.getStatus() != EncashmentStatus.PENDING) {
            throw new IllegalStateException("Encashment request is already " + encashment.getStatus());
        }

        User hrAdmin = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("HR Admin user not found: " + callerId));

        LeaveBalance balance = balanceRepository.findByUserIdAndLeaveTypeIdAndYearWithLock(
                encashment.getUser().getId(), encashment.getLeaveType().getId(), encashment.getYear())
                .orElseThrow(() -> new IllegalStateException("Leave balance record not found for encashment processing"));

        BigDecimal requestedDays = encashment.getDaysRequested();
        if (requestedDays.compareTo(balance.getAvailableDays()) > 0) {
            throw new IllegalStateException(String.format(
                    "Cannot approve encashment: Available balance (%s) is now less than requested encashment days (%s)",
                    balance.getAvailableDays(), requestedDays));
        }

        // Deduct from balance
        balance.setUsedDays(balance.getUsedDays().add(requestedDays));
        balanceRepository.save(balance);

        // Record balance transaction
        String comment = decision != null ? decision.getComments() : null;
        BalanceTransaction tx = BalanceTransaction.builder()
                .leaveBalance(balance)
                .transactionType(TransactionType.ENCASHMENT)
                .amountDays(requestedDays)
                .description("Leave encashment payout approved by " + hrAdmin.getEmail() +
                        (comment != null && !comment.isBlank() ? " - " + comment : ""))
                .createdBy(hrAdmin)
                .build();
        transactionRepository.save(tx);

        // Update encashment request
        encashment.setStatus(EncashmentStatus.APPROVED);
        encashment.setApprovedBy(hrAdmin);
        encashment.setActionedAt(OffsetDateTime.now());
        encashment.setComments(comment);
        LeaveEncashmentRequest updated = encashmentRepository.save(encashment);

        log.info("Encashment request {} APPROVED by {} for employee {} ({} days deducted)",
                encashmentId, hrAdmin.getEmail(), encashment.getUser().getEmail(), requestedDays);
        return mapToResponse(updated);
    }

    @Transactional
    public LeaveEncashmentResponse rejectRequest(UUID encashmentId, EncashmentDecisionRequest decision, UUID callerId, boolean isHrAdmin) {
        if (!isHrAdmin) {
            throw new AccessDeniedException("Only HR Administrators are authorized to reject leave encashment requests");
        }

        LeaveEncashmentRequest encashment = encashmentRepository.findById(encashmentId)
                .orElseThrow(() -> new IllegalArgumentException("Encashment request not found with ID: " + encashmentId));

        if (encashment.getStatus() != EncashmentStatus.PENDING) {
            throw new IllegalStateException("Encashment request is already " + encashment.getStatus());
        }

        User hrAdmin = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("HR Admin user not found: " + callerId));

        String comment = decision != null ? decision.getComments() : null;
        encashment.setStatus(EncashmentStatus.REJECTED);
        encashment.setApprovedBy(hrAdmin);
        encashment.setActionedAt(OffsetDateTime.now());
        encashment.setComments(comment);
        LeaveEncashmentRequest updated = encashmentRepository.save(encashment);

        log.info("Encashment request {} REJECTED by {} for employee {}",
                encashmentId, hrAdmin.getEmail(), encashment.getUser().getEmail());
        return mapToResponse(updated);
    }

    private LeaveEncashmentResponse mapToResponse(LeaveEncashmentRequest req) {
        User u = req.getUser();
        User app = req.getApprovedBy();
        return LeaveEncashmentResponse.builder()
                .id(req.getId())
                .userId(u.getId())
                .employeeName(u.getFullName())
                .employeeEmail(u.getEmail())
                .departmentName(u.getDepartment() != null ? u.getDepartment().getName() : "General")
                .leaveTypeId(req.getLeaveType().getId())
                .leaveTypeName(req.getLeaveType().getName())
                .daysRequested(req.getDaysRequested())
                .year(req.getYear())
                .reason(req.getReason())
                .status(req.getStatus())
                .approvedById(app != null ? app.getId() : null)
                .approvedByName(app != null ? app.getFullName() : null)
                .comments(req.getComments())
                .actionedAt(req.getActionedAt())
                .createdAt(req.getCreatedAt())
                .build();
    }
}
