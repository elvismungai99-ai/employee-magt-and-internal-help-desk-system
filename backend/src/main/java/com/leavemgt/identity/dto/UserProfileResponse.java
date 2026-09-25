package com.leavemgt.identity.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    private UUID id;
    private String employeeCode;
    private String email;
    private String firstName;
    private String lastName;
    private String fullName;
    private String jobTitle;
    private String phone;
    private String status;
    private DepartmentDto department;
    private List<String> roles;
    private List<String> permissions;
    private ManagerSummaryDto manager;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DepartmentDto {
        private UUID id;
        private String name;
        private String code;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ManagerSummaryDto {
        private UUID id;
        private String fullName;
        private String email;
        private String relationshipType;
        private LocalDate effectiveFrom;
    }
}
