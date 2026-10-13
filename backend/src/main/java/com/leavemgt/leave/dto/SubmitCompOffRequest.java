package com.leavemgt.leave.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitCompOffRequest {

    @NotNull(message = "Worked date is required")
    private LocalDate workedDate;

    private BigDecimal daysEarned;

    @NotBlank(message = "Reason is required")
    private String reason;
}
