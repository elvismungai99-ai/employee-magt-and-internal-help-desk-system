package com.leavemgt.leave.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "leave_policies", schema = "leave")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeavePolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "leave_type_id", nullable = false)
    private LeaveType leaveType;

    @Column(name = "policy_name", nullable = false, length = 150)
    private String policyName;

    @Builder.Default
    @Column(name = "annual_allowance", nullable = false, precision = 5, scale = 2)
    private BigDecimal annualAllowance = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "monthly_accrual_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal monthlyAccrualRate = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "max_carryover_days", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxCarryoverDays = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "carryover_expiry_months", nullable = false)
    private Integer carryoverExpiryMonths = 3;

    @Column(name = "effective_year", nullable = false)
    private Integer effectiveYear;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
