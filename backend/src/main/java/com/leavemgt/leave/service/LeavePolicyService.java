package com.leavemgt.leave.service;

import com.leavemgt.leave.dto.CreateLeavePolicyRequest;
import com.leavemgt.leave.dto.LeavePolicyDto;
import com.leavemgt.leave.entity.LeavePolicy;
import com.leavemgt.leave.entity.LeaveType;
import com.leavemgt.leave.repository.LeavePolicyRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LeavePolicyService {

    private final LeavePolicyRepository policyRepository;
    private final LeaveTypeRepository leaveTypeRepository;

    public LeavePolicyService(LeavePolicyRepository policyRepository,
                              LeaveTypeRepository leaveTypeRepository) {
        this.policyRepository = policyRepository;
        this.leaveTypeRepository = leaveTypeRepository;
    }

    @Transactional(readOnly = true)
    public List<LeavePolicyDto> getActivePolicies() {
        return policyRepository.findAllByIsActiveTrue().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<LeavePolicy> getActivePolicy(UUID leaveTypeId, int year) {
        Optional<LeavePolicy> policy = policyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(leaveTypeId, year);
        if (policy.isEmpty()) {
            policy = policyRepository.findFirstByLeaveTypeIdAndIsActiveTrueOrderByEffectiveYearDesc(leaveTypeId);
        }
        return policy;
    }

    @Transactional
    public LeavePolicyDto createOrUpdatePolicy(CreateLeavePolicyRequest request) {
        LeaveType leaveType = leaveTypeRepository.findById(request.getLeaveTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Leave type not found with ID: " + request.getLeaveTypeId()));

        // Business Rule: No duplicate active policy per type & year. Close out any prior active policy.
        List<LeavePolicy> existingActivePolicies = policyRepository.findAllByLeaveTypeIdAndIsActiveTrue(request.getLeaveTypeId());
        for (LeavePolicy existing : existingActivePolicies) {
            existing.setIsActive(false);
            policyRepository.save(existing);
        }
        policyRepository.flush();

        LeavePolicy newPolicy = LeavePolicy.builder()
                .leaveType(leaveType)
                .policyName(request.getPolicyName())
                .annualAllowance(request.getAnnualAllowance())
                .monthlyAccrualRate(request.getMonthlyAccrualRate())
                .maxCarryoverDays(request.getMaxCarryoverDays())
                .carryoverExpiryMonths(request.getCarryoverExpiryMonths())
                .effectiveYear(request.getEffectiveYear())
                .isActive(true)
                .build();

        LeavePolicy saved = policyRepository.save(newPolicy);
        return mapToDto(saved);
    }

    public LeavePolicyDto mapToDto(LeavePolicy policy) {
        return LeavePolicyDto.builder()
                .id(policy.getId())
                .leaveTypeId(policy.getLeaveType().getId())
                .leaveTypeCode(policy.getLeaveType().getCode())
                .leaveTypeName(policy.getLeaveType().getName())
                .policyName(policy.getPolicyName())
                .annualAllowance(policy.getAnnualAllowance())
                .monthlyAccrualRate(policy.getMonthlyAccrualRate())
                .maxCarryoverDays(policy.getMaxCarryoverDays())
                .carryoverExpiryMonths(policy.getCarryoverExpiryMonths())
                .effectiveYear(policy.getEffectiveYear())
                .isActive(policy.getIsActive())
                .build();
    }
}
