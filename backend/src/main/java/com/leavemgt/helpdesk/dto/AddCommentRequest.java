package com.leavemgt.helpdesk.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddCommentRequest {

    @NotBlank(message = "Comment content cannot be blank")
    private String content;

    @JsonAlias({"isInternal", "is_internal", "is_internal_note", "isInternalNote"})
    @Builder.Default
    private Boolean isInternal = false;
}
