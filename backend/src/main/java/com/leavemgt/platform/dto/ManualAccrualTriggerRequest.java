package com.leavemgt.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualAccrualTriggerRequest {
    private Integer year;
    private Integer month;
}
