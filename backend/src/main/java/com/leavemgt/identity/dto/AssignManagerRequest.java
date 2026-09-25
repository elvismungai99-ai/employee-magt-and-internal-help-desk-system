package com.leavemgt.identity.dto;

import com.leavemgt.identity.entity.RelationshipType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignManagerRequest {

    @NotNull(message = "Employee ID is required")
    private UUID employeeId;

    @NotNull(message = "Manager ID is required")
    private UUID managerId;

    @Builder.Default
    private RelationshipType relationshipType = RelationshipType.DIRECT;
}
