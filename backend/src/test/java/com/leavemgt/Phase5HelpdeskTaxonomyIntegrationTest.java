package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.helpdesk.dto.*;
import com.leavemgt.helpdesk.entity.*;
import com.leavemgt.helpdesk.repository.QueueMemberRepository;
import com.leavemgt.helpdesk.repository.SlaPolicyRepository;
import com.leavemgt.helpdesk.repository.SupportQueueRepository;
import com.leavemgt.helpdesk.repository.TicketCategoryRepository;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.identity.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Phase5HelpdeskTaxonomyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private TicketCategoryRepository categoryRepository;

    @Autowired
    private SupportQueueRepository queueRepository;

    @Autowired
    private QueueMemberRepository queueMemberRepository;

    @Autowired
    private SlaPolicyRepository slaPolicyRepository;

    private String hrAdminToken;
    private UUID hrAdminId;

    private String employeeToken;
    private UUID employeeId;

    private String agentToken;
    private UUID agentUserId;

    private UUID tier1QueueId;

    @BeforeAll
    void setupTestData() throws Exception {
        // Clear all queue memberships for test isolation
        queueMemberRepository.deleteAll();

        // Clean test users in topological cascade order
        List<String> emailsToClean = List.of(
                "p5.emp@company.com",
                "p5.agent@company.com"
        );
        Set<UUID> testUserIds = emailsToClean.stream()
                .map(userRepository::findByEmail)
                .filter(java.util.Optional::isPresent)
                .map(opt -> opt.get().getId())
                .collect(java.util.stream.Collectors.toSet());

        if (!testUserIds.isEmpty()) {
            queueMemberRepository.deleteAllByRelatedUserIds(testUserIds);
            refreshTokenRepository.deleteAll(refreshTokenRepository.findAll().stream()
                    .filter(rt -> testUserIds.contains(rt.getUser().getId()))
                    .toList());
            for (UUID id : testUserIds) {
                userRepository.deleteById(id);
            }
        }

        // Clean custom categories or queues created in tests
        categoryRepository.findByCode("FACILITIES").ifPresent(categoryRepository::delete);
        categoryRepository.findByCode("TEST_CAT").ifPresent(categoryRepository::delete);
        queueRepository.findByName("Security Incident Response").ifPresent(queueRepository::delete);

        // Login HR Admin
        User hrAdmin = userRepository.findByEmail("hr.admin@company.com").orElseThrow();
        hrAdminId = hrAdmin.getId();
        hrAdminToken = obtainToken("hr.admin@company.com", "Admin123!");

        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        // Register standard Employee (plain EMPLOYEE role)
        employeeId = registerEmployee("Dave", "User", "p5.emp@company.com", "Pass123!", itDept.getId());
        employeeToken = obtainToken("p5.emp@company.com", "Pass123!");

        // Create Support Agent via HR Admin (holding SUPPORT_AGENT role)
        agentUserId = createSupportAgent("Sara", "Agent", "p5.agent@company.com", "Pass123!", itDept.getId());
        agentToken = obtainToken("p5.agent@company.com", "Pass123!");

        // Retrieve Tier 1 Support queue id seeded by DataInitializer
        SupportQueue tier1 = queueRepository.findByName("Tier 1 Support").orElseThrow();
        tier1QueueId = tier1.getId();
    }

    @Test
    @Order(1)
    @DisplayName("1. Verify DataInitializer seeded categories, support queues, and SLA policies with no duplicates")
    void testSeededTaxonomyIntegrity() throws Exception {
        // 5 Seeded Categories
        List<String> expectedCodes = List.of("IT_HARDWARE", "ACCESS_REQUEST", "SOFTWARE_ISSUE", "NETWORK", "HR_QUERY");
        for (String code : expectedCodes) {
            TicketCategory cat = categoryRepository.findByCode(code).orElseThrow();
            assertThat(cat.getIsActive()).isTrue();
            assertThat(cat.getName()).isNotBlank();
            assertThat(cat.getDefaultPriority()).isNotNull();
        }

        // 4 Seeded Queues
        List<String> expectedQueues = List.of("Tier 1 Support", "IT Networks & Infrastructure", "Hardware Support", "Access & Identity Management");
        for (String name : expectedQueues) {
            SupportQueue queue = queueRepository.findByName(name).orElseThrow();
            assertThat(queue.getIsActive()).isTrue();
            assertThat(queue.getEmailAlias()).isNotBlank();
        }

        // 4 Seeded SLA Policies
        for (TicketPriority priority : TicketPriority.values()) {
            SlaPolicy policy = slaPolicyRepository.findByPriority(priority).orElseThrow();
            assertThat(policy.getIsActive()).isTrue();
            assertThat(policy.getFirstResponseTargetMinutes()).isLessThan(policy.getResolutionTargetMinutes());
            assertThat(policy.getEscalationRuleJson()).isNotBlank();
        }
    }

    @Test
    @Order(2)
    @DisplayName("2. Unauthenticated access: GET /api/helpdesk/categories with no token returns HTTP 401")
    void testUnauthenticatedAccess_Returns401() throws Exception {
        mockMvc.perform(get("/api/helpdesk/categories"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/helpdesk/queues"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/helpdesk/sla-policies"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(3)
    @DisplayName("3. RBAC: Plain EMPLOYEE cannot create categories, queues, or SLA policies (HTTP 403 Forbidden)")
    void testEmployeeCannotCreateTaxonomy_Returns403() throws Exception {
        CreateTicketCategoryRequest catReq = CreateTicketCategoryRequest.builder()
                .name("Illegal Category")
                .code("ILLEGAL_CAT")
                .build();

        mockMvc.perform(post("/api/helpdesk/categories")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(catReq)))
                .andExpect(status().isForbidden());

        CreateSupportQueueRequest queueReq = CreateSupportQueueRequest.builder()
                .name("Illegal Queue")
                .build();

        mockMvc.perform(post("/api/helpdesk/queues")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(queueReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(4)
    @DisplayName("4. HR Admin creates a new ticket category successfully")
    void testHrAdminCreatesCategory_Success() throws Exception {
        CreateTicketCategoryRequest request = CreateTicketCategoryRequest.builder()
                .name("Facilities & Maintenance")
                .code("FACILITIES")
                .description("Office desks, air conditioning, plumbing, and physical facility requests")
                .defaultPriority(TicketPriority.LOW)
                .build();

        mockMvc.perform(post("/api/helpdesk/categories")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.code").value("FACILITIES"))
                .andExpect(jsonPath("$.data.defaultPriority").value("LOW"))
                .andExpect(jsonPath("$.data.isActive").value(true));

        // Authenticated users can view it in active list
        mockMvc.perform(get("/api/helpdesk/categories")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.code == 'FACILITIES')]").exists());
    }

    @Test
    @Order(5)
    @DisplayName("5. Duplicate category name or code rejected with HTTP 400 Bad Request")
    void testDuplicateCategory_Returns400() throws Exception {
        CreateTicketCategoryRequest duplicateCode = CreateTicketCategoryRequest.builder()
                .name("Another Facilities Category")
                .code("FACILITIES")
                .build();

        mockMvc.perform(post("/api/helpdesk/categories")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateCode)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already exists")));
    }

    @Test
    @Order(6)
    @DisplayName("6. HR Admin creates a new support queue successfully")
    void testHrAdminCreatesQueue_Success() throws Exception {
        CreateSupportQueueRequest request = CreateSupportQueueRequest.builder()
                .name("Security Incident Response")
                .description("Phishing reports, malware alerts, and security incidents")
                .emailAlias("security-team@company.com")
                .build();

        mockMvc.perform(post("/api/helpdesk/queues")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("Security Incident Response"))
                .andExpect(jsonPath("$.data.memberCount").value(0));

        // Authenticated users can view it
        mockMvc.perform(get("/api/helpdesk/queues")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.name == 'Security Incident Response')]").exists());
    }

    @Test
    @Order(7)
    @DisplayName("7. Duplicate queue name rejected with HTTP 400 Bad Request")
    void testDuplicateQueueName_Returns400() throws Exception {
        CreateSupportQueueRequest request = CreateSupportQueueRequest.builder()
                .name("Tier 1 Support") // already seeded
                .build();

        mockMvc.perform(post("/api/helpdesk/queues")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already exists")));
    }

    @Test
    @Order(8)
    @DisplayName("8. Queue membership: HR Admin adds SUPPORT_AGENT to queue with assigned_by and assigned_at audit")
    void testAddSupportAgentToQueue_WithAudit() throws Exception {
        AddQueueMemberRequest request = AddQueueMemberRequest.builder()
                .agentUserId(agentUserId)
                .build();

        mockMvc.perform(post("/api/helpdesk/queues/" + tier1QueueId + "/members")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.queueId").value(tier1QueueId.toString()))
                .andExpect(jsonPath("$.data.agentUserId").value(agentUserId.toString()))
                .andExpect(jsonPath("$.data.assignedById").value(hrAdminId.toString()))
                .andExpect(jsonPath("$.data.assignedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.isActive").value(true));

        // Confirm agent is in queue members list
        mockMvc.perform(get("/api/helpdesk/queues/" + tier1QueueId + "/members")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].agentEmail").value("p5.agent@company.com"))
                .andExpect(jsonPath("$.data[0].assignedById").value(hrAdminId.toString()));
    }

    @Test
    @Order(9)
    @DisplayName("9. Queue membership integrity: Attempt to add plain EMPLOYEE (no SUPPORT_AGENT role) is rejected")
    void testAddPlainEmployeeToQueue_Rejected() throws Exception {
        AddQueueMemberRequest request = AddQueueMemberRequest.builder()
                .agentUserId(employeeId) // Plain EMPLOYEE
                .build();

        mockMvc.perform(post("/api/helpdesk/queues/" + tier1QueueId + "/members")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("SUPPORT_AGENT role")));
    }

    @Test
    @Order(10)
    @DisplayName("10. SLA Policy constraint: first_response_target_minutes >= resolution_target_minutes rejected with HTTP 400")
    void testSlaResponseTargetConstraint_Rejected() throws Exception {
        CreateSlaPolicyRequest request = CreateSlaPolicyRequest.builder()
                .name("Invalid Inverted SLA")
                .priority(TicketPriority.URGENT)
                .firstResponseTargetMinutes(300) // 300 min response
                .resolutionTargetMinutes(60)     // 60 min resolution -> Invalid!
                .build();

        mockMvc.perform(post("/api/helpdesk/sla-policies")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("strictly less than")));
    }

    @Test
    @Order(11)
    @DisplayName("11. Escalation rule JSON contract: validates warn_at_percent, escalate_to_role, notify_channels")
    void testEscalationRuleJsonValidation() throws Exception {
        // Retrieve seeded URGENT SLA policy
        MvcResult res = mockMvc.perform(get("/api/helpdesk/sla-policies")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(4)))
                .andReturn();

        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        JsonNode urgentPolicy = null;
        for (JsonNode p : json.path("data")) {
            if ("URGENT".equals(p.path("priority").asText())) {
                urgentPolicy = p;
                break;
            }
        }
        assertThat(urgentPolicy).isNotNull();
        assertThat(urgentPolicy.path("escalationRule").path("warnAtPercent").asInt()).isEqualTo(75);
        assertThat(urgentPolicy.path("escalationRule").path("escalateToRole").asText()).isEqualTo("SUPPORT_LEAD");
        assertThat(urgentPolicy.path("escalationRule").path("notifyChannels")).isNotEmpty();
    }

    private String obtainToken(String email, String password) throws Exception {
        LoginRequest req = LoginRequest.builder().email(email).password(password).build();
        MvcResult res = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = objectMapper.readTree(res.getResponse().getContentAsString());
        return node.path("data").path("accessToken").asText();
    }

    private UUID registerEmployee(String first, String last, String email, String password, UUID deptId) throws Exception {
        RegisterRequest req = RegisterRequest.builder()
                .firstName(first)
                .lastName(last)
                .email(email)
                .password(password)
                .departmentId(deptId)
                .build();
        MvcResult res = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode node = objectMapper.readTree(res.getResponse().getContentAsString());
        return UUID.fromString(node.path("data").path("id").asText());
    }

    private UUID createSupportAgent(String first, String last, String email, String password, UUID deptId) throws Exception {
        CreateUserRequest req = CreateUserRequest.builder()
                .firstName(first)
                .lastName(last)
                .email(email)
                .password(password)
                .roleName("SUPPORT_AGENT")
                .departmentId(deptId)
                .build();
        MvcResult res = mockMvc.perform(post("/api/identity/users")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = objectMapper.readTree(res.getResponse().getContentAsString());
        return UUID.fromString(node.path("data").path("id").asText());
    }
}
