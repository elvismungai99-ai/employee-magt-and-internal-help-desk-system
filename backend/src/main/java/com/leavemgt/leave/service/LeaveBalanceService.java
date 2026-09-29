package com.leavemgt.leave.service;

import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.AdjustBalanceRequest;
import com.leavemgt.leave.dto.LeaveBalanceResponse;
import com.leavemgt.leave.entity.*;
import com.leavemgt.leave.repository.BalanceTransactionRepository;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeavePolicyRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LeaveBalanceService {

    private static final Logger log = LoggerFactory.getLogger(LeaveBalanceService.class);

    private final LeaveBalanceRepository balanceRepository;
    private final LeaveTypeRepository typeRepository;
    private final LeavePolicyRepository policyRepository;
    private final BalanceTransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public LeaveBalanceService(LeaveBalanceRepository balanceRepository,
                               LeaveTypeRepository typeRepository,
                               LeavePolicyRepository policyRepository,
                               BalanceTransactionRepository transactionRepository,
                               UserRepository userRepository) {
        this.balanceRepository = balanceRepository;
        this.typeRepository = typeRepository;
        this.policyRepository = policyRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public List<LeaveBalanceResponse> initializeBalancesForUser(User user, int year) {
        List<LeaveType> activeTypes = typeRepository.findAllByIsActiveTrue();
        List<LeaveBalance> initialized = new ArrayList<>();

        for (LeaveType leaveType : activeTypes) {
            // Idempotency: Skip if balance record already exists for (user, leaveType, year)
            if (balanceRepository.existsByUserIdAndLeaveTypeIdAndYear(user.getId(), leaveType.getId(), year)) {
                log.debug("Balance already exists for user {} and type {} in year {}, skipping.", user.getEmail(), leaveType.getCode(), year);
                continue;
            }

            BigDecimal entitledDays = BigDecimal.ZERO;
            Optional<LeavePolicy> policyOpt = policyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(leaveType.getId(), year);
            if (policyOpt.isEmpty()) {
                policyOpt = policyRepository.findFirstByLeaveTypeIdAndIsActiveTrueOrderByEffectiveYearDesc(leaveType.getId());
            }
            if (policyOpt.isPresent()) {
                entitledDays = policyOpt.get().getAnnualAllowance();
            }

            LeaveBalance balance = LeaveBalance.builder()
                    .user(user)
                    .leaveType(leaveType)
                    .year(year)
                    .entitledDays(entitledDays)
                    .accruedDays(BigDecimal.ZERO)
                    .usedDays(BigDecimal.ZERO)
                    .pendingDays(BigDecimal.ZERO)
                    .carriedOverDays(BigDecimal.ZERO)
                    .build();

            initialized.add(balanceRepository.save(balance));
        }

        log.info("Initialized {} leave balances for user {} for year {}", initialized.size(), user.getEmail(), year);
        return balanceRepository.findByUserIdAndYear(user.getId(), year).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeaveBalanceResponse> getMyBalances(UUID userId, int year) {
        return balanceRepository.findByUserIdAndYear(userId, year).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeaveBalanceResponse> getUserBalances(UUID userId, int year) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found with ID: " + userId);
        }
        return balanceRepository.findByUserIdAndYear(userId, year).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public LeaveBalanceResponse adjustBalance(UUID balanceId, AdjustBalanceRequest request, UUID adminUserId) {
        LeaveBalance balance = balanceRepository.findById(balanceId)
                .orElseThrow(() -> new IllegalArgumentException("Leave balance not found with ID: " + balanceId));

        User adminUser = null;
        if (adminUserId != null) {
            adminUser = userRepository.findById(adminUserId).orElse(null);
        }

        BigDecimal amount = request.getAmountDays();
        TransactionType txType = request.getTransactionType();

        // Update balance fields based on transaction type
        switch (txType) {
            case SCHEDULED_ACCRUAL, MANUAL_ADJUSTMENT -> {
                balance.setAccruedDays(balance.getAccruedDays().add(amount));
            }
            case DEDUCTION -> {
                BigDecimal available = balance.getAccruedDays().add(balance.getCarriedOverDays()).subtract(balance.getUsedDays());
                if (amount.compareTo(available) > 0) {
                    throw new IllegalArgumentException("Deduction amount (" + amount + ") exceeds available balance (" + available + ")");
                }
                balance.setUsedDays(balance.getUsedDays().add(amount));
            }
            case REVERSAL -> {
                balance.setUsedDays(balance.getUsedDays().subtract(amount));
                if (balance.getUsedDays().compareTo(BigDecimal.ZERO) < 0) {
                    balance.setUsedDays(BigDecimal.ZERO);
                }
            }
            case CARRYOVER_RESET -> {
                balance.setCarriedOverDays(amount);
            }
        }

        // Check constraint safety: used_days <= accrued_days + carried_over_days
        if (balance.getUsedDays().compareTo(balance.getAccruedDays().add(balance.getCarriedOverDays())) > 0) {
            throw new IllegalArgumentException("Integrity violation: used days cannot exceed total accrued and carried over days");
        }

        BalanceTransaction tx = BalanceTransaction.builder()
                .leaveBalance(balance)
                .transactionType(txType)
                .amountDays(amount)
                .description(request.getDescription())
                .createdBy(adminUser)
                .build();

        transactionRepository.save(tx);
        LeaveBalance saved = balanceRepository.save(balance);

        return mapToResponse(saved);
    }

    @Transactional
    public void rolloverBalancesForYear(int fromYear, int toYear) {
        List<LeaveBalance> previousBalances = balanceRepository.findAllByYear(fromYear);

        for (LeaveBalance prev : previousBalances) {
            UUID userId = prev.getUser().getId();
            UUID typeId = prev.getLeaveType().getId();

            Optional<LeavePolicy> policyOpt = policyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(typeId, toYear);
            if (policyOpt.isEmpty()) {
                policyOpt = policyRepository.findFirstByLeaveTypeIdAndIsActiveTrueOrderByEffectiveYearDesc(typeId);
            }

            BigDecimal maxCarryover = policyOpt.map(LeavePolicy::getMaxCarryoverDays).orElse(BigDecimal.ZERO);
            BigDecimal unusedDays = prev.getAccruedDays().add(prev.getCarriedOverDays()).subtract(prev.getUsedDays());
            if (unusedDays.compareTo(BigDecimal.ZERO) < 0) {
                unusedDays = BigDecimal.ZERO;
            }

            BigDecimal carryoverToApply = unusedDays.min(maxCarryover);
            BigDecimal entitledDays = policyOpt.map(LeavePolicy::getAnnualAllowance).orElse(BigDecimal.ZERO);

            LeaveBalance nextBalance = balanceRepository.findByUserIdAndLeaveTypeIdAndYear(userId, typeId, toYear)
                    .orElseGet(() -> LeaveBalance.builder()
                            .user(prev.getUser())
                            .leaveType(prev.getLeaveType())
                            .year(toYear)
                            .entitledDays(entitledDays)
                            .accruedDays(BigDecimal.ZERO)
                            .usedDays(BigDecimal.ZERO)
                            .pendingDays(BigDecimal.ZERO)
                            .carriedOverDays(BigDecimal.ZERO)
                            .build());

            nextBalance.setCarriedOverDays(carryoverToApply);
            balanceRepository.save(nextBalance);
        }
    }

    public LeaveBalanceResponse mapToResponse(LeaveBalance lb) {
        return LeaveBalanceResponse.builder()
                .id(lb.getId())
                .userId(lb.getUser().getId())
                .leaveTypeId(lb.getLeaveType().getId())
                .leaveTypeCode(lb.getLeaveType().getCode())
                .leaveTypeName(lb.getLeaveType().getName())
                .year(lb.getYear())
                .entitledDays(lb.getEntitledDays())
                .accruedDays(lb.getAccruedDays())
                .usedDays(lb.getUsedDays())
                .pendingDays(lb.getPendingDays())
                .carriedOverDays(lb.getCarriedOverDays())
                .availableDays(lb.getAvailableDays())
                .updatedAt(lb.getUpdatedAt())
                .build();
    }
}
