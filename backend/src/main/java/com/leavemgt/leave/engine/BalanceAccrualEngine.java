package com.leavemgt.leave.engine;

import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.entity.BalanceTransaction;
import com.leavemgt.leave.entity.LeaveBalance;
import com.leavemgt.leave.entity.LeavePolicy;
import com.leavemgt.leave.entity.TransactionType;
import com.leavemgt.leave.repository.BalanceTransactionRepository;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeavePolicyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@Component
@Slf4j
public class BalanceAccrualEngine {

    private final LeavePolicyRepository policyRepository;
    private final LeaveBalanceRepository balanceRepository;
    private final BalanceTransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final TransactionTemplate transactionTemplate;

    private final AtomicReference<AccrualRunResult> lastRun = new AtomicReference<>(null);

    public BalanceAccrualEngine(LeavePolicyRepository policyRepository,
                                LeaveBalanceRepository balanceRepository,
                                BalanceTransactionRepository transactionRepository,
                                UserRepository userRepository,
                                PlatformTransactionManager transactionManager) {
        this.policyRepository = policyRepository;
        this.balanceRepository = balanceRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public AccrualRunResult getLastRun() {
        return lastRun.get();
    }

    @Scheduled(cron = "${app.scheduling.accrual-cron:0 0 1 1 * *}")
    public void scheduledMonthlyAccrual() {
        LocalDate now = LocalDate.now();
        log.info("Triggering scheduled monthly balance accrual for {}/{}", now.getMonthValue(), now.getYear());
        runAccrual(now.getYear(), now.getMonthValue(), "SCHEDULED");
    }

    /**
     * Executes monthly accrual across active employees.
     * Idempotent: checks for prior SCHEDULED_ACCRUAL transaction for the given month/year.
     * Failure-isolated: failures for an individual employee do not roll back other employees.
     */
    public AccrualRunResult runAccrual(int year, int month, String triggeredBy) {
        OffsetDateTime startTime = OffsetDateTime.now();
        String periodPattern = String.format("%%%02d/%d%%", month, year);
        String description = String.format("Scheduled monthly accrual for %02d/%d", month, year);

        List<LeavePolicy> activePolicies = policyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .filter(p -> p.getMonthlyAccrualRate() != null && p.getMonthlyAccrualRate().compareTo(BigDecimal.ZERO) > 0)
                .toList();

        int usersProcessed = 0;
        int balancesAccrued = 0;
        int skippedCount = 0;
        int failureCount = 0;

        int pageIndex = 0;
        int pageSize = 50;
        Page<User> userPage;

        do {
            userPage = userRepository.findAll(PageRequest.of(pageIndex, pageSize));

            for (User user : userPage.getContent()) {
                if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
                    continue;
                }

                usersProcessed++;

                // Process each user in an isolated transaction
                try {
                    int[] userCounts = transactionTemplate.execute(status -> {
                        int userAccrued = 0;
                        int userSkipped = 0;

                        for (LeavePolicy policy : activePolicies) {
                            LeaveBalance balance = balanceRepository
                                    .findByUserIdAndLeaveTypeIdAndYear(user.getId(), policy.getLeaveType().getId(), year)
                                    .orElseGet(() -> {
                                        LeaveBalance newBal = LeaveBalance.builder()
                                                .user(user)
                                                .leaveType(policy.getLeaveType())
                                                .year(year)
                                                .entitledDays(policy.getAnnualAllowance())
                                                .accruedDays(BigDecimal.ZERO)
                                                .usedDays(BigDecimal.ZERO)
                                                .pendingDays(BigDecimal.ZERO)
                                                .carriedOverDays(BigDecimal.ZERO)
                                                .build();
                                        return balanceRepository.save(newBal);
                                    });

                            // Idempotency check: verify if accrual transaction already recorded for this period
                            boolean alreadyAccrued = transactionRepository.existsByLeaveBalanceIdAndTransactionTypeAndDescriptionLike(
                                    balance.getId(),
                                    TransactionType.SCHEDULED_ACCRUAL,
                                    periodPattern
                            );

                            if (alreadyAccrued) {
                                userSkipped++;
                                continue;
                            }

                            BigDecimal accrualAmount = policy.getMonthlyAccrualRate();
                            balance.setAccruedDays(balance.getAccruedDays().add(accrualAmount));
                            balanceRepository.save(balance);

                            BalanceTransaction tx = BalanceTransaction.builder()
                                    .leaveBalance(balance)
                                    .transactionType(TransactionType.SCHEDULED_ACCRUAL)
                                    .amountDays(accrualAmount)
                                    .description(description)
                                    .build();
                            transactionRepository.save(tx);

                            userAccrued++;
                        }

                        return new int[]{userAccrued, userSkipped};
                    });

                    if (userCounts != null) {
                        balancesAccrued += userCounts[0];
                        skippedCount += userCounts[1];
                    }
                } catch (Exception e) {
                    failureCount++;
                    log.error("Failed accrual processing for user {} (ID={}): {}", user.getEmail(), user.getId(), e.getMessage());
                }
            }

            pageIndex++;
        } while (userPage.hasNext());

        String status = failureCount == 0 ? "SUCCESS" : (balancesAccrued > 0 ? "PARTIAL" : "FAILED");
        String message = String.format("Processed %d users: %d balances accrued, %d skipped (already processed), %d failures",
                usersProcessed, balancesAccrued, skippedCount, failureCount);

        AccrualRunResult result = AccrualRunResult.builder()
                .executedAt(startTime)
                .year(year)
                .month(month)
                .triggeredBy(triggeredBy)
                .status(status)
                .usersProcessed(usersProcessed)
                .balancesAccrued(balancesAccrued)
                .skippedCount(skippedCount)
                .failureCount(failureCount)
                .message(message)
                .build();

        lastRun.set(result);
        log.info("Accrual run complete [triggeredBy={}]: {}", triggeredBy, message);
        return result;
    }

    @Scheduled(cron = "${app.scheduling.year-end-cron:0 0 2 1 1 *}")
    public void scheduledYearEndCarryover() {
        LocalDate now = LocalDate.now();
        int fromYear = now.getYear() - 1;
        int toYear = now.getYear();
        log.info("Triggering scheduled year-end carryover from year {} to {}", fromYear, toYear);
        runYearEndCarryover(fromYear, toYear, "SCHEDULED");
    }

    /**
     * Executes year-end carryover from one year to the next for active employees.
     * Enforces policy max_carryover_days limits and records CARRYOVER_RESET transaction.
     */
    public AccrualRunResult runYearEndCarryover(int fromYear, int toYear, String triggeredBy) {
        OffsetDateTime startTime = OffsetDateTime.now();
        List<LeavePolicy> activePolicies = policyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .filter(p -> p.getMaxCarryoverDays() != null && p.getMaxCarryoverDays().compareTo(BigDecimal.ZERO) > 0)
                .toList();

        int usersProcessed = 0;
        int balancesRolledOver = 0;
        int skippedCount = 0;
        int failureCount = 0;

        int pageIndex = 0;
        int pageSize = 50;
        Page<User> userPage;

        do {
            userPage = userRepository.findAll(PageRequest.of(pageIndex, pageSize));
            for (User user : userPage.getContent()) {
                if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) continue;
                usersProcessed++;

                try {
                    int[] counts = transactionTemplate.execute(status -> {
                        int carried = 0;
                        int skipped = 0;

                        for (LeavePolicy policy : activePolicies) {
                            var priorBalOpt = balanceRepository.findByUserIdAndLeaveTypeIdAndYear(
                                    user.getId(), policy.getLeaveType().getId(), fromYear);

                            if (priorBalOpt.isEmpty()) {
                                skipped++;
                                continue;
                            }

                            LeaveBalance priorBal = priorBalOpt.get();
                            BigDecimal totalAccrued = priorBal.getAccruedDays().add(priorBal.getCarriedOverDays());
                            BigDecimal totalDeducted = priorBal.getUsedDays().add(priorBal.getPendingDays());
                            BigDecimal unusedDays = totalAccrued.subtract(totalDeducted);

                            if (unusedDays.compareTo(BigDecimal.ZERO) <= 0) {
                                skipped++;
                                continue;
                            }

                            BigDecimal maxCarry = policy.getMaxCarryoverDays();
                            BigDecimal carryoverDays = unusedDays.min(maxCarry);

                            LeaveBalance nextYearBal = balanceRepository.findByUserIdAndLeaveTypeIdAndYear(
                                    user.getId(), policy.getLeaveType().getId(), toYear)
                                    .orElseGet(() -> LeaveBalance.builder()
                                            .user(user)
                                            .leaveType(policy.getLeaveType())
                                            .year(toYear)
                                            .entitledDays(policy.getAnnualAllowance())
                                            .accruedDays(BigDecimal.ZERO)
                                            .usedDays(BigDecimal.ZERO)
                                            .pendingDays(BigDecimal.ZERO)
                                            .carriedOverDays(BigDecimal.ZERO)
                                            .build());

                            nextYearBal.setCarriedOverDays(carryoverDays);
                            balanceRepository.save(nextYearBal);

                            BalanceTransaction tx = BalanceTransaction.builder()
                                    .leaveBalance(nextYearBal)
                                    .transactionType(TransactionType.CARRYOVER_RESET)
                                    .amountDays(carryoverDays)
                                    .description(String.format("Year-end carryover from year %d: %s days (policy max: %s days)",
                                            fromYear, carryoverDays, maxCarry))
                                    .build();
                            transactionRepository.save(tx);
                            carried++;
                        }
                        return new int[]{carried, skipped};
                    });

                    if (counts != null) {
                        balancesRolledOver += counts[0];
                        skippedCount += counts[1];
                    }
                } catch (Exception e) {
                    failureCount++;
                    log.error("Failed carryover for user {}: {}", user.getEmail(), e.getMessage());
                }
            }
            pageIndex++;
        } while (userPage.hasNext());

        String message = String.format("Year-end carryover completed: %d users processed, %d balances rolled over, %d skipped, %d failures",
                usersProcessed, balancesRolledOver, skippedCount, failureCount);
        log.info(message);

        return AccrualRunResult.builder()
                .executedAt(startTime)
                .year(toYear)
                .month(1)
                .triggeredBy(triggeredBy)
                .status(failureCount == 0 ? "SUCCESS" : "PARTIAL")
                .usersProcessed(usersProcessed)
                .balancesAccrued(balancesRolledOver)
                .skippedCount(skippedCount)
                .failureCount(failureCount)
                .message(message)
                .build();
    }

    @Scheduled(cron = "${app.scheduling.carryover-expiry-cron:0 0 2 1 4 *}")
    public void scheduledCarryoverExpiry() {
        LocalDate now = LocalDate.now();
        log.info("Triggering scheduled Q1 carryover expiry for year {}", now.getYear());
        runCarryoverExpiry(now.getYear(), "SCHEDULED");
    }

    /**
     * Executes carryover expiry after statutory deadline (e.g. 3 months into the new year).
     * Resets unused carried_over_days and logs audit transaction.
     */
    public AccrualRunResult runCarryoverExpiry(int year, String triggeredBy) {
        OffsetDateTime startTime = OffsetDateTime.now();
        List<LeavePolicy> expiringPolicies = policyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .filter(p -> p.getCarryoverExpiryMonths() != null && p.getCarryoverExpiryMonths() > 0)
                .toList();

        int usersProcessed = 0;
        int balancesExpired = 0;
        int skippedCount = 0;
        int failureCount = 0;

        int pageIndex = 0;
        int pageSize = 50;
        Page<User> userPage;

        do {
            userPage = userRepository.findAll(PageRequest.of(pageIndex, pageSize));
            for (User user : userPage.getContent()) {
                if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) continue;
                usersProcessed++;

                try {
                    int[] counts = transactionTemplate.execute(status -> {
                        int expired = 0;
                        int skipped = 0;

                        for (LeavePolicy policy : expiringPolicies) {
                            var balOpt = balanceRepository.findByUserIdAndLeaveTypeIdAndYear(
                                    user.getId(), policy.getLeaveType().getId(), year);

                            if (balOpt.isEmpty() || balOpt.get().getCarriedOverDays().compareTo(BigDecimal.ZERO) <= 0) {
                                skipped++;
                                continue;
                            }

                            LeaveBalance balance = balOpt.get();
                            BigDecimal remainingCarried = balance.getCarriedOverDays();
                            balance.setCarriedOverDays(BigDecimal.ZERO);
                            balanceRepository.save(balance);

                            BalanceTransaction tx = BalanceTransaction.builder()
                                    .leaveBalance(balance)
                                    .transactionType(TransactionType.CARRYOVER_RESET)
                                    .amountDays(remainingCarried.negate())
                                    .description(String.format("Expired %s unused carried-over days after deadline (%d months)",
                                            remainingCarried, policy.getCarryoverExpiryMonths()))
                                    .build();
                            transactionRepository.save(tx);
                            expired++;
                        }
                        return new int[]{expired, skipped};
                    });

                    if (counts != null) {
                        balancesExpired += counts[0];
                        skippedCount += counts[1];
                    }
                } catch (Exception e) {
                    failureCount++;
                    log.error("Failed carryover expiry for user {}: {}", user.getEmail(), e.getMessage());
                }
            }
            pageIndex++;
        } while (userPage.hasNext());

        String message = String.format("Carryover expiry completed: %d users processed, %d balances expired, %d skipped, %d failures",
                usersProcessed, balancesExpired, skippedCount, failureCount);
        log.info(message);

        return AccrualRunResult.builder()
                .executedAt(startTime)
                .year(year)
                .month(LocalDate.now().getMonthValue())
                .triggeredBy(triggeredBy)
                .status(failureCount == 0 ? "SUCCESS" : "PARTIAL")
                .usersProcessed(usersProcessed)
                .balancesAccrued(balancesExpired)
                .skippedCount(skippedCount)
                .failureCount(failureCount)
                .message(message)
                .build();
    }
}
