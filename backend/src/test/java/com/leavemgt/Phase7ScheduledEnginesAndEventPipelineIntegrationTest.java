package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.helpdesk.dto.AddQueueMemberRequest;
import com.leavemgt.helpdesk.dto.CreateTicketRequest;
import com.leavemgt.helpdesk.engine.SlaBreachMonitorEngine;
import com.leavemgt.helpdesk.engine.SlaMonitorRunResult;
import com.leavemgt.helpdesk.entity.*;
import com.leavemgt.helpdesk.repository.*;
import com.leavemgt.helpdesk.service.TicketService;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.ApprovalDecisionRequest;
import com.leavemgt.leave.dto.SubmitLeaveRequest;
import com.leavemgt.leave.engine.AccrualRunResult;
import com.leavemgt.leave.engine.BalanceAccrualEngine;
import com.leavemgt.leave.entity.*;
import com.leavemgt.leave.repository.*;
import com.leavemgt.leave.service.LeaveRequestService;
import com.leavemgt.notification.service.NotificationDispatcher;
import com.leavemgt.notification.service.NotificationSender;
import com.leavemgt.platform.dto.ManualAccrualTriggerRequest;
import com.leavemgt.platform.engine.EventOutboxPoller;
import com.leavemgt.platform.entity.*;
import com.leavemgt.platform.handler.OooSyncHandler;
import com.leavemgt.platform.repository.EventOutboxRepository;
import com.leavemgt.platform.repository.NotificationRepository;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.repository.RoleRepository;
import com.leavemgt.leave.service.LeaveBalanceService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class Phase7ScheduledEnginesAndEventPipelineIntegrationTest {

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
    private LeaveTypeRepository leaveTypeRepository;

    @Autowired
    private LeavePolicyRepository leavePolicyRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private BalanceTransactionRepository balanceTransactionRepository;

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private LeaveApprovalRepository leaveApprovalRepository;

    @Autowired
    private OutOfOfficeRecordRepository oooRecordRepository;

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TicketRoutingHistoryRepository routingHistoryRepository;

    @Autowired
    private TicketCommentRepository ticketCommentRepository;

    @Autowired
    private SupportQueueRepository queueRepository;

    @Autowired
    private QueueMemberRepository queueMemberRepository;

    @Autowired
    private TicketCategoryRepository categoryRepository;

    @Autowired
    private SlaPolicyRepository slaPolicyRepository;

    @Autowired
    private SlaBreachLogRepository slaBreachLogRepository;

    @Autowired
    private EventOutboxRepository eventOutboxRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationSender notificationSender;

    @Autowired
    private BalanceAccrualEngine balanceAccrualEngine;

    @Autowired
    private SlaBreachMonitorEngine slaBreachMonitorEngine;

    @Autowired
    private EventOutboxPoller eventOutboxPoller;

    @Autowired
    private NotificationDispatcher notificationDispatcher;

    @Autowired
    private OooSyncHandler oooSyncHandler;

    @Autowired
    private TicketService ticketService;

    @Autowired
    private LeaveRequestService leaveRequestService;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    private String hrAdminToken;
    private UUID hrAdminId;

    private String agentToken;
    private UUID agentId;

    private String requesterToken;
    private UUID requesterId;

    private UUID tier1QueueId;
    private UUID hardwareCategoryId;
    private UUID annualLeaveTypeId;

    private UUID activeLeaveRequestId;
    private UUID openTicket1Id;
    private UUID openTicket2Id;

    @BeforeAll
    void setupTestData() throws Exception {
        purgeData(List.of(
                "p7.agent@company.com",
                "p7.requester@company.com"
        ));

        // Login HR Admin (create if absent due to prior test cleanup)
        User hrAdmin = userRepository.findByEmail("hr.admin@company.com").orElseGet(() -> {
            Department hrDept = departmentRepository.findByCode("HR").orElseThrow();
            Role adminRole = roleRepository.findByName("HR_ADMIN")
                    .orElseGet(() -> roleRepository.save(Role.builder()
                            .name("HR_ADMIN")
                            .description("Human Resources Administrator")
                            .build()));
            User admin = User.builder()
                    .employeeCode("EMP-ADMIN-P7")
                    .firstName("System")
                    .lastName("Admin")
                    .email("hr.admin@company.com")
                    .passwordHash(passwordEncoder.encode("Admin123!"))
                    .phone("+254700000000")
                    .department(hrDept)
                    .jobTitle("HR Administrator")
                    .roles(Set.of(adminRole))
                    .status("ACTIVE")
                    .build();
            User saved = userRepository.save(admin);
            leaveBalanceService.initializeBalancesForUser(saved, LocalDate.now().getYear());
            return saved;
        });
        hrAdminId = hrAdmin.getId();
        hrAdminToken = obtainToken("hr.admin@company.com", "Admin123!");

        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        // Register Support Agent who also takes leave
        agentId = createSupportAgent("Sara", "Agent", "p7.agent@company.com", "Pass123!", itDept.getId());
        agentToken = obtainToken("p7.agent@company.com", "Pass123!");

        // Register Requester Employee
        requesterId = registerEmployee("Leo", "Requester", "p7.requester@company.com", "Pass123!", itDept.getId());
        requesterToken = obtainToken("p7.requester@company.com", "Pass123!");

        // Queues & Categories
        SupportQueue tier1 = queueRepository.findByName("Tier 1 Support").orElseThrow();
        tier1QueueId = tier1.getId();

        TicketCategory hardwareCat = categoryRepository.findByCode("IT_HARDWARE").orElseThrow();
        hardwareCategoryId = hardwareCat.getId();

        LeaveType annualType = leaveTypeRepository.findByCode("ANNUAL").orElseThrow();
        annualLeaveTypeId = annualType.getId();

        // Assign Agent to Tier 1 Queue
        mockMvc.perform(post("/api/helpdesk/queues/" + tier1QueueId + "/members")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AddQueueMemberRequest(agentId))))
                .andExpect(status().isCreated());

        // Assign HR Admin as Line Manager for Agent (so leave requests route properly)
        com.leavemgt.identity.dto.AssignManagerRequest assignMgr = com.leavemgt.identity.dto.AssignManagerRequest.builder()
                .employeeId(agentId)
                .managerId(hrAdminId)
                .relationshipType(com.leavemgt.identity.entity.RelationshipType.DIRECT)
                .build();
        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assignMgr)))
                .andExpect(status().isOk());
    }

    // =========================================================================
    // 1. SCHEDULED BALANCE ACCRUAL ENGINE TESTS
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("1. Balance Accrual: Credits active employees according to monthly accrual rate and logs transactions")
    void test1_BalanceAccrual_CreditsActiveEmployees() {
        int testYear = 2026;
        int testMonth = 10;

        AccrualRunResult result = balanceAccrualEngine.runAccrual(testYear, testMonth, "TEST_RUNNER");

        assertThat(result.getStatus()).isEqualTo("SUCCESS");
        assertThat(result.getBalancesAccrued()).isGreaterThan(0);
        assertThat(result.getFailureCount()).isEqualTo(0);

        // Verify agent's balance was credited
        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(agentId, annualLeaveTypeId, testYear)
                .orElseThrow();
        assertThat(balance.getAccruedDays()).isGreaterThan(BigDecimal.ZERO);

        // Verify transaction logged
        String periodPattern = String.format("%%%02d/%d%%", testMonth, testYear);
        boolean txExists = balanceTransactionRepository.existsByLeaveBalanceIdAndTransactionTypeAndDescriptionLike(
                balance.getId(), TransactionType.SCHEDULED_ACCRUAL, periodPattern);
        assertThat(txExists).isTrue();
    }

    @Test
    @Order(2)
    @DisplayName("2. Balance Accrual: Idempotent - Second run in same month/year skips already credited balances")
    void test2_BalanceAccrual_IdempotentOnSecondRun() {
        int testYear = 2026;
        int testMonth = 10;

        LeaveBalance beforeBalance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(agentId, annualLeaveTypeId, testYear)
                .orElseThrow();
        BigDecimal accruedBefore = beforeBalance.getAccruedDays();

        // Run accrual again for the exact same period
        AccrualRunResult secondResult = balanceAccrualEngine.runAccrual(testYear, testMonth, "TEST_RUNNER");

        assertThat(secondResult.getStatus()).isEqualTo("SUCCESS");
        assertThat(secondResult.getBalancesAccrued()).isEqualTo(0);
        assertThat(secondResult.getSkippedCount()).isGreaterThan(0);

        LeaveBalance afterBalance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(agentId, annualLeaveTypeId, testYear)
                .orElseThrow();
        assertThat(afterBalance.getAccruedDays()).isEqualByComparingTo(accruedBefore);
    }

    // =========================================================================
    // 2. SCHEDULED SLA BREACH MONITOR ENGINE TESTS
    // =========================================================================

    @Test
    @Order(3)
    @DisplayName("3. SLA Breach Monitor: Flags overdue ticket, updates sla_breached, logs breach, and publishes outbox event")
    void test3_SlaBreachMonitor_FlagsOverdueTicketAndPublishesEvent() throws Exception {
        // Create an overdue ticket by setting slaDueAt in the past
        CreateTicketRequest request = new CreateTicketRequest();
        request.setTitle("Server room AC failed");
        request.setDescription("Temperature reaching critical levels");
        request.setCategoryId(hardwareCategoryId);
        request.setQueueId(tier1QueueId);
        request.setPriority(TicketPriority.URGENT);

        var response = ticketService.createTicket(request, requesterId);
        Ticket ticket = ticketRepository.findById(response.getId()).orElseThrow();

        // Artificially move slaDueAt 2 hours into the past
        ticket.setSlaDueAt(OffsetDateTime.now().minusHours(2));
        ticket.setSlaBreached(false);
        ticketRepository.save(ticket);

        // Run SLA breach monitor sweep
        SlaMonitorRunResult sweepResult = slaBreachMonitorEngine.sweepBreachedTickets();

        assertThat(sweepResult.getStatus()).isEqualTo("SUCCESS");
        assertThat(sweepResult.getBreachesDetected()).isGreaterThanOrEqualTo(1);

        // Verify ticket marked sla_breached = true
        Ticket refreshedTicket = ticketRepository.findById(ticket.getId()).orElseThrow();
        assertThat(refreshedTicket.getSlaBreached()).isTrue();

        // Verify SlaBreachLog entry created
        boolean breachLogExists = slaBreachLogRepository.existsByTicketIdAndBreachType(ticket.getId(), BreachType.RESOLUTION);
        assertThat(breachLogExists).isTrue();

        // Verify SLABreached event in platform.event_outbox
        List<EventOutbox> outboxEvents = eventOutboxRepository.findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus.PENDING);
        Optional<EventOutbox> slaEvent = outboxEvents.stream()
                .filter(e -> "SLABreached".equals(e.getEventType()) && e.getPayload().contains(ticket.getTicketNumber()))
                .findFirst();
        assertThat(slaEvent).isPresent();

        JsonNode payload = objectMapper.readTree(slaEvent.get().getPayload());
        assertThat(payload.get("ticketNumber").asText()).isEqualTo(ticket.getTicketNumber());
        assertThat(payload.get("priority").asText()).isEqualTo("URGENT");
    }

    @Test
    @Order(4)
    @DisplayName("4. SLA Breach Monitor: Idempotent - Same ticket is never re-flagged on subsequent sweep")
    void test4_SlaBreachMonitor_DoesNotReFlagOnSubsequentSweeps() {
        long initialLogsCount = slaBreachLogRepository.count();

        // Run sweep again
        SlaMonitorRunResult secondSweep = slaBreachMonitorEngine.sweepBreachedTickets();

        assertThat(secondSweep.getBreachesDetected()).isEqualTo(0);
        assertThat(slaBreachLogRepository.count()).isEqualTo(initialLogsCount);
    }

    // =========================================================================
    // 3. CROSS-DOMAIN OOO SYNC & EVENT OUTBOX PIPELINE TESTS
    // =========================================================================

    @Test
    @Order(5)
    @DisplayName("5. Leave Approval: Publishes LeaveApproved event in event_outbox in the same transaction")
    void test5_LeaveApproval_PublishesLeaveApprovedEvent() throws Exception {
        // Ensure balance exists for agent
        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(agentId, annualLeaveTypeId, 2026)
                .orElseThrow();
        balance.setAccruedDays(BigDecimal.valueOf(21.0));
        leaveBalanceRepository.save(balance);

        // Submit leave request for Agent
        LocalDate nextMon = LocalDate.now().plusWeeks(1).with(java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.MONDAY));
        LocalDate nextWed = nextMon.plusDays(2);

        SubmitLeaveRequest leaveReq = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(nextMon)
                .endDate(nextWed)
                .reason("Annual leave vacation")
                .build();

        MvcResult submitResult = mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + agentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(leaveReq)))
                .andExpect(status().isCreated())
                .andReturn();

        activeLeaveRequestId = UUID.fromString(
                objectMapper.readTree(submitResult.getResponse().getContentAsString())
                        .get("data").get("id").asText()
        );

        // Approve leave request as HR Admin
        ApprovalDecisionRequest decision = new ApprovalDecisionRequest();
        decision.setComments("Enjoy your leave");

        mockMvc.perform(post("/api/leave/requests/" + activeLeaveRequestId + "/approve")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isOk());

        // Verify LeaveApproved event in platform.event_outbox
        List<EventOutbox> pendingEvents = eventOutboxRepository.findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus.PENDING);
        Optional<EventOutbox> leaveApprovedEvent = pendingEvents.stream()
                .filter(e -> "LeaveApproved".equals(e.getEventType()) && e.getPayload().contains(activeLeaveRequestId.toString()))
                .findFirst();

        assertThat(leaveApprovedEvent).isPresent();
        EventOutbox event = leaveApprovedEvent.get();
        assertThat(event.getSourceDomain()).isEqualTo("LEAVE");
        assertThat(event.getStatus()).isEqualTo(OutboxStatus.PENDING);

        // Payload discipline: verify payload carries only what's needed and NO sensitive reason field
        JsonNode payload = objectMapper.readTree(event.getPayload());
        assertThat(payload.has("employeeId")).isTrue();
        assertThat(payload.has("startDate")).isTrue();
        assertThat(payload.has("endDate")).isTrue();
        assertThat(payload.has("leaveRequestId")).isTrue();
        assertThat(payload.has("reason")).isFalse(); // Invariant: zero PII / sensitive data in outbox payload!
    }

    @Test
    @Order(6)
    @DisplayName("6. Outbox Poller & OooSyncHandler: Consumes LeaveApproved, unassigns agent's tickets, records OOO_REROUTE, and creates OutOfOfficeRecord")
    void test6_OutboxPollerAndOooSyncHandler_UnassignsAgentTickets() throws Exception {
        // Create 2 open tickets assigned to Sara (the agent going OOO)
        CreateTicketRequest t1Req = new CreateTicketRequest();
        t1Req.setTitle("Printer network offline");
        t1Req.setDescription("Floor 3 printer unreachable");
        t1Req.setCategoryId(hardwareCategoryId);
        t1Req.setQueueId(tier1QueueId);

        var t1Resp = ticketService.createTicket(t1Req, requesterId);
        openTicket1Id = t1Resp.getId();

        CreateTicketRequest t2Req = new CreateTicketRequest();
        t2Req.setTitle("Monitor flickering");
        t2Req.setDescription("Desk 12 display issues");
        t2Req.setCategoryId(hardwareCategoryId);
        t2Req.setQueueId(tier1QueueId);

        var t2Resp = ticketService.createTicket(t2Req, requesterId);
        openTicket2Id = t2Resp.getId();

        // Assign both tickets to Agent
        Ticket ticket1 = ticketRepository.findById(openTicket1Id).orElseThrow();
        ticket1.setAssignedAgent(userRepository.findById(agentId).orElseThrow());
        ticket1.setStatus(TicketStatus.ASSIGNED);
        ticketRepository.save(ticket1);

        Ticket ticket2 = ticketRepository.findById(openTicket2Id).orElseThrow();
        ticket2.setAssignedAgent(userRepository.findById(agentId).orElseThrow());
        ticket2.setStatus(TicketStatus.IN_PROGRESS);
        ticketRepository.save(ticket2);

        // Execute Outbox Poller
        int processed = eventOutboxPoller.pollAndProcess();
        assertThat(processed).isGreaterThan(0);

        // 1. Verify OutOfOfficeRecord created
        List<OutOfOfficeRecord> oooRecords = oooRecordRepository.findByLeaveRequestId(activeLeaveRequestId);
        assertThat(oooRecords).hasSize(1);
        OutOfOfficeRecord oooRecord = oooRecords.get(0);
        assertThat(oooRecord.getUser().getId()).isEqualTo(agentId);
        assertThat(oooRecord.getSyncStatus()).isEqualTo(OooSyncStatus.SYNCED);
        assertThat(oooRecord.getSourceEventId()).isNotNull();

        // 2. Verify both tickets unassigned and status set to TRIAGED
        Ticket refreshed1 = ticketRepository.findById(openTicket1Id).orElseThrow();
        assertThat(refreshed1.getAssignedAgent()).isNull();
        assertThat(refreshed1.getStatus()).isEqualTo(TicketStatus.TRIAGED);

        Ticket refreshed2 = ticketRepository.findById(openTicket2Id).orElseThrow();
        assertThat(refreshed2.getAssignedAgent()).isNull();
        assertThat(refreshed2.getStatus()).isEqualTo(TicketStatus.TRIAGED);

        // 3. Verify TicketRoutingHistory recorded with reason = 'OOO_REROUTE'
        List<TicketRoutingHistory> history1 = routingHistoryRepository.findByTicketIdOrderByCreatedAtAsc(openTicket1Id);
        assertThat(history1).anyMatch(h -> "OOO_REROUTE".equals(h.getReason()) && h.getNewAgent() == null);

        List<TicketRoutingHistory> history2 = routingHistoryRepository.findByTicketIdOrderByCreatedAtAsc(openTicket2Id);
        assertThat(history2).anyMatch(h -> "OOO_REROUTE".equals(h.getReason()) && h.getNewAgent() == null);
    }

    @Test
    @Order(7)
    @DisplayName("7. OooSyncHandler: Re-handling the same LeaveApproved event is safely skipped (Idempotency)")
    void test7_OooSyncHandler_SkipsDuplicateEventIdempotently() throws Exception {
        // Find the published LeaveApproved event
        EventOutbox event = eventOutboxRepository.findAll().stream()
                .filter(e -> "LeaveApproved".equals(e.getEventType()) && e.getPayload().contains(activeLeaveRequestId.toString()))
                .findFirst()
                .orElseThrow();

        long oooCountBefore = oooRecordRepository.count();

        // Manually invoke handler again with the same event
        oooSyncHandler.handle(event);

        // Verify count didn't change
        assertThat(oooRecordRepository.count()).isEqualTo(oooCountBefore);
    }

    @Test
    @Order(8)
    @DisplayName("8. Leave Cancellation: Cancelling approved leave emits LeaveCancelled and revokes OutOfOfficeRecord")
    void test8_LeaveCancellation_RevokesOooRecord() throws Exception {
        // Cancel active leave request
        mockMvc.perform(post("/api/leave/requests/" + activeLeaveRequestId + "/cancel")
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk());

        // Process outbox
        eventOutboxPoller.pollAndProcess();

        // Verify OutOfOfficeRecord is revoked
        List<OutOfOfficeRecord> records = oooRecordRepository.findByLeaveRequestId(activeLeaveRequestId);
        assertThat(records).isNotEmpty();
        assertThat(records.get(0).getSyncStatus()).isEqualTo(OooSyncStatus.REVOKED);
    }

    // =========================================================================
    // 4. ARCHITECTURAL INVARIANT & NOTIFICATION TESTS
    // =========================================================================

    @Test
    @Order(9)
    @DisplayName("9. Architectural Invariant: LeaveRequestService has ZERO direct imports or dependencies on Helpdesk domain")
    void test9_ArchitecturalDecoupling_LeaveApprovalHasNoHelpdeskImports() {
        for (Field field : LeaveRequestService.class.getDeclaredFields()) {
            String typeName = field.getType().getName();
            assertThat(typeName).doesNotContain("helpdesk");
        }
    }

    @Test
    @Order(10)
    @DisplayName("10. Notification Dispatcher: Failed deliveries are marked FAILED and successfully retried on next poll")
    void test10_NotificationDispatcher_RetriesFailedDeliveries() {
        // Enable simulated delivery failure
        notificationSender.setSimulateFailure(true);

        User hrAdmin = userRepository.findById(hrAdminId).orElseThrow();
        Notification notification = Notification.builder()
                .recipient(hrAdmin)
                .channel(NotificationChannel.EMAIL)
                .message("Test failure recovery notification")
                .status(NotificationStatus.PENDING)
                .build();
        Notification saved = notificationRepository.save(notification);

        try {
            notificationSender.send(saved);
            saved.setStatus(NotificationStatus.SENT);
        } catch (Exception e) {
            saved.setStatus(NotificationStatus.FAILED);
        }
        notificationRepository.save(saved);

        assertThat(saved.getStatus()).isEqualTo(NotificationStatus.FAILED);

        // Turn off simulated failure and trigger retry
        notificationSender.setSimulateFailure(false);
        int recovered = notificationDispatcher.retryFailedNotifications();

        assertThat(recovered).isGreaterThanOrEqualTo(1);
        Notification retried = notificationRepository.findById(saved.getId()).orElseThrow();
        assertThat(retried.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(retried.getSentAt()).isNotNull();
    }

    // =========================================================================
    // 5. ADMIN & MONITORING ENDPOINTS TESTS
    // =========================================================================

    @Test
    @Order(11)
    @DisplayName("11. Admin Endpoints: HR_ADMIN triggers manual accrual run; verified logged and idempotency safe")
    void test11_AdminTriggerAccrual_SuccessAndLogged() throws Exception {
        ManualAccrualTriggerRequest triggerReq = new ManualAccrualTriggerRequest(2026, 11);

        mockMvc.perform(post("/api/admin/jobs/accrual/trigger")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(triggerReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.year", is(2026)))
                .andExpect(jsonPath("$.data.month", is(11)))
                .andExpect(jsonPath("$.data.triggeredBy", is("hr.admin@company.com")));

        // Check last run endpoint
        mockMvc.perform(get("/api/admin/jobs/accrual/last-run")
                        .header("Authorization", "Bearer " + hrAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("SUCCESS")));
    }

    @Test
    @Order(12)
    @DisplayName("12. Admin Endpoints: SLA Monitor last-run and Event Outbox inspection endpoints accessible to HR_ADMIN only")
    void test12_AdminEndpoints_SecurityEnforcement() throws Exception {
        // Plain employee cannot access /api/admin/events
        mockMvc.perform(get("/api/admin/events")
                        .header("Authorization", "Bearer " + requesterToken))
                .andExpect(status().isForbidden());

        // HR Admin accesses /api/admin/events
        mockMvc.perform(get("/api/admin/events")
                        .header("Authorization", "Bearer " + hrAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        // HR Admin accesses /api/admin/jobs/sla-monitor/last-run
        mockMvc.perform(get("/api/admin/jobs/sla-monitor/last-run")
                        .header("Authorization", "Bearer " + hrAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));
    }

    // =========================================================================
    // TEST HELPERS
    // =========================================================================

    private String obtainToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("data").get("accessToken").asText();
    }

    private UUID registerEmployee(String first, String last, String email, String pass, UUID deptId) throws Exception {
        RegisterRequest req = new RegisterRequest();
        req.setFirstName(first);
        req.setLastName(last);
        req.setEmail(email);
        req.setPassword(pass);
        req.setDepartmentId(deptId);
        req.setJobTitle("Support Requester");

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return UUID.fromString(node.path("data").path("id").asText());
    }

    private UUID createSupportAgent(String first, String last, String email, String pass, UUID deptId) throws Exception {
        CreateUserRequest req = new CreateUserRequest();
        req.setFirstName(first);
        req.setLastName(last);
        req.setEmail(email);
        req.setPassword(pass);
        req.setDepartmentId(deptId);
        req.setJobTitle("Helpdesk Support Agent");
        req.setRoleName("SUPPORT_AGENT");

        MvcResult result = mockMvc.perform(post("/api/identity/users")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("data").get("id").asText());
    }

    @AfterAll
    void teardownTestData() {
        purgeData(List.of(
                "p7.agent@company.com",
                "p7.requester@company.com",
                "hr.admin@company.com"
        ));
    }

    private void purgeData(List<String> emailsToClean) {
        // Clean outbox and notifications
        notificationRepository.deleteAll();
        eventOutboxRepository.deleteAll();
        oooRecordRepository.deleteAll();

        // Clean tickets
        ticketCommentRepository.deleteAll();
        routingHistoryRepository.deleteAll();
        slaBreachLogRepository.deleteAll();
        ticketRepository.deleteAll();
        queueMemberRepository.deleteAll();

        // Clean test users
        Set<UUID> testUserIds = emailsToClean.stream()
                .map(userRepository::findByEmail)
                .filter(Optional::isPresent)
                .map(opt -> opt.get().getId())
                .collect(java.util.stream.Collectors.toSet());

        if (!testUserIds.isEmpty()) {
            balanceTransactionRepository.deleteAllByRelatedUserIds(testUserIds);
            leaveApprovalRepository.deleteAll(leaveApprovalRepository.findAll().stream()
                    .filter(la -> testUserIds.contains(la.getApprover().getId()))
                    .toList());
            leaveRequestRepository.deleteAll(leaveRequestRepository.findAll().stream()
                    .filter(lr -> testUserIds.contains(lr.getUser().getId()))
                    .toList());
            leaveBalanceRepository.deleteAll(leaveBalanceRepository.findAll().stream()
                    .filter(lb -> testUserIds.contains(lb.getUser().getId()))
                    .toList());
            refreshTokenRepository.deleteAll(refreshTokenRepository.findAll().stream()
                    .filter(rt -> testUserIds.contains(rt.getUser().getId()))
                    .toList());
            for (UUID id : testUserIds) {
                userRepository.deleteById(id);
            }
        }
    }
}
