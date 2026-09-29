package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.helpdesk.dto.*;
import com.leavemgt.helpdesk.entity.*;
import com.leavemgt.helpdesk.repository.*;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class Phase6TicketLifecycleIntegrationTest {

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

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TicketCommentRepository ticketCommentRepository;

    @Autowired
    private TicketRoutingHistoryRepository routingHistoryRepository;

    private String hrAdminToken;
    private UUID hrAdminId;

    private String requesterToken;
    private UUID requesterId;

    private String agent1Token;
    private UUID agent1Id;

    private String agent2Token;
    private UUID agent2Id;

    private UUID tier1QueueId;
    private UUID networksQueueId;
    private UUID hardwareCategoryId;

    private UUID createdTicketId;
    private String createdTicketNumber;

    @BeforeAll
    void setupTestData() throws Exception {
        // Clean test tickets, history, comments and queue memberships first
        ticketCommentRepository.deleteAll();
        routingHistoryRepository.deleteAll();
        ticketRepository.deleteAll();
        queueMemberRepository.deleteAll();

        // Clean test users in cascade
        List<String> emailsToClean = List.of(
                "p6.emp@company.com",
                "p6.agent1@company.com",
                "p6.agent2@company.com"
        );
        Set<UUID> testUserIds = emailsToClean.stream()
                .map(userRepository::findByEmail)
                .filter(Optional::isPresent)
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

        // Login HR Admin
        User hrAdmin = userRepository.findByEmail("hr.admin@company.com").orElseThrow();
        hrAdminId = hrAdmin.getId();
        hrAdminToken = obtainToken("hr.admin@company.com", "Admin123!");

        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        // 1. Register Employee (Requester)
        requesterId = registerEmployee("Paul", "Requester", "p6.emp@company.com", "Pass123!", itDept.getId());
        requesterToken = obtainToken("p6.emp@company.com", "Pass123!");

        // 2. Create Agent 1 (Tier 1 Support)
        agent1Id = createSupportAgent("Alice", "Tier1Agent", "p6.agent1@company.com", "Pass123!", itDept.getId());
        agent1Token = obtainToken("p6.agent1@company.com", "Pass123!");

        // 3. Create Agent 2 (Networks Queue)
        agent2Id = createSupportAgent("Bob", "NetworksAgent", "p6.agent2@company.com", "Pass123!", itDept.getId());
        agent2Token = obtainToken("p6.agent2@company.com", "Pass123!");

        // Retrieve seeded Queues and Categories
        SupportQueue tier1 = queueRepository.findByName("Tier 1 Support").orElseThrow();
        tier1QueueId = tier1.getId();

        SupportQueue networks = queueRepository.findByName("IT Networks & Infrastructure").orElseThrow();
        networksQueueId = networks.getId();

        TicketCategory hardwareCat = categoryRepository.findByCode("IT_HARDWARE").orElseThrow();
        hardwareCategoryId = hardwareCat.getId();

        // Assign Agent 1 to Tier 1 Queue
        mockMvc.perform(post("/api/helpdesk/queues/" + tier1QueueId + "/members")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddQueueMemberRequest(agent1Id))))
                .andExpect(status().isCreated());

        // Assign Agent 2 to Networks Queue
        mockMvc.perform(post("/api/helpdesk/queues/" + networksQueueId + "/members")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddQueueMemberRequest(agent2Id))))
                .andExpect(status().isCreated());
    }

    @Test
    @Order(1)
    @DisplayName("1. Employee creates ticket; generates TICK-xxxx number, calculates sla_due_at, sets status NEW")
    void testCreateTicket_GeneratesTicketNumberAndSlaDueAt() throws Exception {
        CreateTicketRequest request = CreateTicketRequest.builder()
                .categoryId(hardwareCategoryId)
                .queueId(tier1QueueId)
                .title("Flickering External Monitor")
                .description("The Dell 27-inch 4K monitor turns black intermittently during work.")
                .priority(TicketPriority.HIGH)
                .build();

        MvcResult res = mockMvc.perform(post("/api/helpdesk/tickets")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.ticketNumber", startsWith("TICK-")))
                .andExpect(jsonPath("$.data.status").value("NEW"))
                .andExpect(jsonPath("$.data.priority").value("HIGH"))
                .andExpect(jsonPath("$.data.requesterId").value(requesterId.toString()))
                .andExpect(jsonPath("$.data.queueId").value(tier1QueueId.toString()))
                .andExpect(jsonPath("$.data.slaDueAt").isNotEmpty())
                .andReturn();

        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        createdTicketId = UUID.fromString(json.path("data").path("id").asText());
        createdTicketNumber = json.path("data").path("ticketNumber").asText();

        assertThat(createdTicketId).isNotNull();
        assertThat(createdTicketNumber).startsWith("TICK-");
    }

    @Test
    @Order(2)
    @DisplayName("2. Queue view scoping: Agent in Tier 1 sees ticket; Agent in Networks queue does not")
    void testQueueViewScopedToAgentMembership() throws Exception {
        // Agent 1 (member of Tier 1 Support) calls /queue -> sees ticket
        mockMvc.perform(get("/api/helpdesk/tickets/queue")
                        .header("Authorization", "Bearer " + agent1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == '" + createdTicketId + "')]").exists());

        // Agent 2 (member of Networks Queue only) calls /queue -> does NOT see ticket
        mockMvc.perform(get("/api/helpdesk/tickets/queue")
                        .header("Authorization", "Bearer " + agent2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == '" + createdTicketId + "')]").doesNotExist());

        // Agent 2 tries to explicitly query Tier 1 Support queue -> 403 Forbidden
        mockMvc.perform(get("/api/helpdesk/tickets/queue?queueId=" + tier1QueueId)
                        .header("Authorization", "Bearer " + agent2Token))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(3)
    @DisplayName("3. Agent 1 assigns ticket to self: status moves to ASSIGNED and routing history is created")
    void testAssignTicket_Success() throws Exception {
        AssignTicketRequest assignReq = AssignTicketRequest.builder()
                .agentUserId(agent1Id)
                .reason("INITIAL_TRIAGE")
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/assign")
                        .header("Authorization", "Bearer " + agent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.data.assignedAgentId").value(agent1Id.toString()));

        // Confirm routing history logged
        mockMvc.perform(get("/api/helpdesk/tickets/" + createdTicketId + "/history")
                        .header("Authorization", "Bearer " + agent1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].newAgentId").value(agent1Id.toString()))
                .andExpect(jsonPath("$.data[0].reason").value("INITIAL_TRIAGE"));
    }

    @Test
    @Order(4)
    @DisplayName("4. Double-assignment to same agent returns HTTP 409 Conflict")
    void testDoubleAssignment_Returns409() throws Exception {
        AssignTicketRequest assignReq = AssignTicketRequest.builder()
                .agentUserId(agent1Id)
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/assign")
                        .header("Authorization", "Bearer " + agent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already assigned")));
    }

    @Test
    @Order(5)
    @DisplayName("5. Assignment to non-queue-member is rejected with HTTP 400 Bad Request")
    void testAssignToNonQueueMember_Returns400() throws Exception {
        // Agent 2 is not a member of Tier 1 queue
        AssignTicketRequest assignReq = AssignTicketRequest.builder()
                .agentUserId(agent2Id)
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("not an active member")));
    }

    @Test
    @Order(6)
    @DisplayName("6. Unrelated Agent 2 cannot assign tickets outside their queue (HTTP 403 Forbidden)")
    void testUnrelatedAgentCannotAssign_Returns403() throws Exception {
        AssignTicketRequest assignReq = AssignTicketRequest.builder()
                .agentUserId(agent1Id)
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/assign")
                        .header("Authorization", "Bearer " + agent2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(7)
    @DisplayName("7. Internal note isolation: Agent posts internal note; Requester never sees it in my-tickets or getTicketById")
    void testInternalNoteIsolation() throws Exception {
        // Agent 1 posts internal note
        AddCommentRequest internalNote = AddCommentRequest.builder()
                .content("Internal triage note: GPU hardware test shows memory bus errors.")
                .isInternal(true)
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/comments")
                        .header("Authorization", "Bearer " + agent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(internalNote)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.isInternal").value(true));

        // Agent 1 views ticket -> sees internal note
        mockMvc.perform(get("/api/helpdesk/tickets/" + createdTicketId)
                        .header("Authorization", "Bearer " + agent1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.comments[?(@.isInternal == true)]").exists());

        // Requester views my-tickets -> does NOT see internal note
        mockMvc.perform(get("/api/helpdesk/tickets/my-tickets")
                        .header("Authorization", "Bearer " + requesterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == '" + createdTicketId + "')].comments[?(@.isInternal == true)]").doesNotExist());

        // Requester views ticket details directly -> does NOT see internal note
        mockMvc.perform(get("/api/helpdesk/tickets/" + createdTicketId)
                        .header("Authorization", "Bearer " + requesterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.comments[?(@.isInternal == true)]").doesNotExist());
    }

    @Test
    @Order(8)
    @DisplayName("8. Public comment is visible to both agent and requester; advances status to IN_PROGRESS")
    void testPublicReply_VisibleToRequester() throws Exception {
        AddCommentRequest publicReply = AddCommentRequest.builder()
                .content("Hello Paul, we have ordered a replacement display cable for testing.")
                .isInternal(false)
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/comments")
                        .header("Authorization", "Bearer " + agent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(publicReply)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.isInternal").value(false));

        // Requester views ticket -> sees the public reply!
        mockMvc.perform(get("/api/helpdesk/tickets/" + createdTicketId)
                        .header("Authorization", "Bearer " + requesterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.comments[?(@.content contains 'replacement display cable')]").exists());
    }

    @Test
    @Order(9)
    @DisplayName("9. Requester comment with isInternal=true is forced to false")
    void testRequesterInternalNoteForcedFalse() throws Exception {
        AddCommentRequest requesterComment = AddCommentRequest.builder()
                .content("I am replying with attempt to hide this as internal note.")
                .isInternal(true)
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/comments")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requesterComment)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.isInternal").value(false))
                .andExpect(jsonPath("$.data.isInternalNote").value(false));
    }

    @Test
    @Order(10)
    @DisplayName("10. State machine: Skip state guard prevents resolving NEW tickets directly")
    void testSkipStateGuard_RejectsDirectResolveOfNewTicket() throws Exception {
        // Create an unassigned ticket in NEW status
        CreateTicketRequest newReq = CreateTicketRequest.builder()
                .categoryId(hardwareCategoryId)
                .queueId(tier1QueueId)
                .title("Unassigned Laptop Keyboard Issue")
                .description("Spacebar key is physically sticky.")
                .build();

        MvcResult res = mockMvc.perform(post("/api/helpdesk/tickets")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newReq)))
                .andExpect(status().isCreated())
                .andReturn();

        UUID newTicketId = UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString())
                .path("data").path("id").asText());

        // Attempt to resolve directly from NEW status -> 400 Bad Request
        mockMvc.perform(post("/api/helpdesk/tickets/" + newTicketId + "/resolve")
                        .header("Authorization", "Bearer " + agent1Token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Must be assigned/in-progress")));
    }

    @Test
    @Order(11)
    @DisplayName("11. Lifecycle: Agent marks ticket RESOLVED; Requester CLOSES ticket")
    void testResolveAndCloseLifecycle() throws Exception {
        // Agent 1 resolves createdTicketId
        ResolveTicketRequest resolveReq = ResolveTicketRequest.builder()
                .resolutionNotes("Replaced HDMI cable and updated Dell display drivers. Issue resolved.")
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/resolve")
                        .header("Authorization", "Bearer " + agent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resolveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                .andExpect(jsonPath("$.data.resolvedAt").isNotEmpty());

        // Attempting to resolve an already-RESOLVED ticket returns 409 Conflict
        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/resolve")
                        .header("Authorization", "Bearer " + agent1Token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already RESOLVED")));

        // Requester confirms closure
        CloseTicketRequest closeReq = CloseTicketRequest.builder()
                .feedback("Thank you, display is functioning perfectly now!")
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/close")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(closeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"))
                .andExpect(jsonPath("$.data.closedAt").isNotEmpty());

        // Operations on a CLOSED ticket return 409 Conflict
        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/comments")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(AddCommentRequest.builder().content("One more thing").build())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("CLOSED")));
    }

    @Test
    @Order(12)
    @DisplayName("12. Reopen lifecycle: Requester can reopen a RESOLVED ticket")
    void testReopenResolvedTicket() throws Exception {
        // Create ticket 2
        CreateTicketRequest request = CreateTicketRequest.builder()
                .categoryId(hardwareCategoryId)
                .queueId(tier1QueueId)
                .title("Docking Station Ethernet Port Dropping")
                .description("Dock drops connection every 30 minutes.")
                .priority(TicketPriority.MEDIUM)
                .build();

        MvcResult res = mockMvc.perform(post("/api/helpdesk/tickets")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        UUID ticket2Id = UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString())
                .path("data").path("id").asText());

        // Assign to Agent 1
        mockMvc.perform(post("/api/helpdesk/tickets/" + ticket2Id + "/assign")
                        .header("Authorization", "Bearer " + agent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AssignTicketRequest(agent1Id, "MANUAL"))))
                .andExpect(status().isOk());

        // Agent 1 resolves it
        mockMvc.perform(post("/api/helpdesk/tickets/" + ticket2Id + "/resolve")
                        .header("Authorization", "Bearer " + agent1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResolveTicketRequest("Firmware updated"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"));

        // Requester reopens ticket
        mockMvc.perform(post("/api/helpdesk/tickets/" + ticket2Id + "/reopen")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Drop still occurred this morning\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.resolvedAt").isEmpty());
    }

    @Test
    @Order(13)
    @DisplayName("13. Attachment validation: File > 10MB or executable file rejected with HTTP 400")
    void testAttachmentValidation() throws Exception {
        // Exceeding 10MB
        AddAttachmentRequest largeFile = AddAttachmentRequest.builder()
                .fileName("dump.dmp")
                .fileSizeBytes(15L * 1024 * 1024) // 15MB
                .mimeType("application/octet-stream")
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/attachments")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(largeFile)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("exceeds maximum limit")));

        // Prohibited executable file
        AddAttachmentRequest executableFile = AddAttachmentRequest.builder()
                .fileName("fix_script.exe")
                .fileSizeBytes(5000L)
                .mimeType("application/x-msdownload")
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/attachments")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(executableFile)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Executable file types are strictly prohibited")));

        // Valid attachment metadata succeeds
        AddAttachmentRequest validFile = AddAttachmentRequest.builder()
                .fileName("display_error_screenshot.png")
                .fileSizeBytes(245000L)
                .mimeType("image/png")
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + createdTicketId + "/attachments")
                        .header("Authorization", "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validFile)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fileName").value("display_error_screenshot.png"))
                .andExpect(jsonPath("$.data.filePath", startsWith("tickets/")));
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

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
                .departmentId(deptId)
                .roleName("SUPPORT_AGENT")
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
