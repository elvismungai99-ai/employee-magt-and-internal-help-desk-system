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
    private int totalActiveEmployees;
    private int onLeaveCount;
    private int absentEmployeesCount;
    private int availableCount;
    private int availableCapacityCount;
    private double capacityPercentage;
    private boolean isBottleneck;
    private List<String> onLeaveEmployees;
    private List<String> absentEmployeeNames;
}
