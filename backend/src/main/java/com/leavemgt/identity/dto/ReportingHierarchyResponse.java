package com.leavemgt.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.leavemgt.identity.entity.RelationshipType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ReportingHierarchyResponse {

    private UUID id;
    private UserSummaryDto employee;
    private UserSummaryDto manager;
    private RelationshipType relationshipType;
    private Boolean isActive;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private AssignedBySummaryDto assignedBy;
    private OffsetDateTime createdAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UserSummaryDto {
        private UUID id;
        private String employeeCode;
        private String fullName;
        private String email;
        private String jobTitle;
        private String departmentName;
        private String departmentCode;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AssignedBySummaryDto {
        private UUID id;
        private String fullName;
        private String email;
    }
}
