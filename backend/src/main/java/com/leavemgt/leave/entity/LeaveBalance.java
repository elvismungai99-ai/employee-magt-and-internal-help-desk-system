package com.leavemgt.leave.entity;

import com.leavemgt.identity.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "leave_balances", schema = "leave", uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_leave_year", columnNames = {"user_id", "leave_type_id", "year"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaveBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "leave_type_id", nullable = false)
    private LeaveType leaveType;

    @Column(nullable = false)
    private Integer year;

    @Builder.Default
    @Column(name = "entitled_days", nullable = false, precision = 5, scale = 2)
    private BigDecimal entitledDays = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "accrued_days", nullable = false, precision = 5, scale = 2)
    private BigDecimal accruedDays = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "used_days", nullable = false, precision = 5, scale = 2)
    private BigDecimal usedDays = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "pending_days", nullable = false, precision = 5, scale = 2)
    private BigDecimal pendingDays = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "carried_over_days", nullable = false, precision = 5, scale = 2)
    private BigDecimal carriedOverDays = BigDecimal.ZERO;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public BigDecimal getAvailableDays() {
        BigDecimal totalAccrued = (accruedDays != null ? accruedDays : BigDecimal.ZERO)
                .add(carriedOverDays != null ? carriedOverDays : BigDecimal.ZERO);
        BigDecimal totalDeductions = (usedDays != null ? usedDays : BigDecimal.ZERO)
                .add(pendingDays != null ? pendingDays : BigDecimal.ZERO);
        BigDecimal available = totalAccrued.subtract(totalDeductions);
        return available.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : available;
    }
}
