package com.leavemgt.leave.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamCapacityDayResponse {
    private LocalDate date;
    private String dayOfWeek;
    private int totalDepartmentMembers;
    private int onLeaveCount;
    private int availableCount;
    private double capacityPercentage;
    private List<String> onLeaveEmployees;
}
