package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.identity.dto.AssignManagerRequest;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.RelationshipType;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.identity.repository.ReportingHierarchyRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.ApprovalDecisionRequest;
import com.leavemgt.leave.dto.SubmitLeaveRequest;
import com.leavemgt.leave.entity.*;
import com.leavemgt.leave.repository.*;
import com.leavemgt.leave.service.LeaveBalanceService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.Year;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
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
class Phase4LeaveApprovalIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ReportingHierarchyRepository hierarchyRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private LeaveTypeRepository leaveTypeRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private LeaveApprovalRepository leaveApprovalRepository;

    @Autowired
    private BalanceTransactionRepository balanceTransactionRepository;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    private String hrAdminToken;
    private UUID hrAdminId;

    private String manager1Token;
    private UUID manager1Id;

    private String manager2Token;
    private UUID manager2Id;

    private String employee1Token;
    private UUID employee1Id;

    private String employee2Token;
    private UUID employee2Id;

    private UUID annualLeaveTypeId;
    private int currentYear;

    private UUID testRequestId1;
    private UUID testRequestId2;

    @BeforeAll
    void setupTestData() throws Exception {
        currentYear = Year.now().getValue();

        // 1. Clean previous test data in topological order
        List<String> emailsToClean = List.of(
                "p4.mgr1@company.com",
                "p4.mgr2@company.com",
                "p4.emp1@company.com",
                "p4.emp2@company.com"
        );
        java.util.Set<UUID> testUserIds = emailsToClean.stream()
                .map(userRepository::findByEmail)
                .filter(java.util.Optional::isPresent)
                .map(opt -> opt.get().getId())
                .collect(java.util.stream.Collectors.toSet());

        if (!testUserIds.isEmpty()) {
            leaveApprovalRepository.deleteAllByRelatedUserIds(testUserIds);
            leaveRequestRepository.deleteAllByUserIdIn(testUserIds);
            balanceTransactionRepository.deleteAllByRelatedUserIds(testUserIds);

            for (UUID uId : testUserIds) {
                leaveBalanceRepository.deleteAll(leaveBalanceRepository.findAllByUserId(uId));
            }

            hierarchyRepository.deleteAll(hierarchyRepository.findAll().stream()
                    .filter(h -> testUserIds.contains(h.getEmployee().getId()) || (h.getManager() != null && testUserIds.contains(h.getManager().getId())))
                    .toList());

            refreshTokenRepository.deleteAll(refreshTokenRepository.findAll().stream()
                    .filter(rt -> testUserIds.contains(rt.getUser().getId()))
                    .toList());

            for (UUID uId : testUserIds) {
                userRepository.deleteById(uId);
            }
        }

        // 2. Obtain HR Admin token
        User hrAdmin = userRepository.findByEmail("hr.admin@company.com").orElseThrow();
        hrAdminId = hrAdmin.getId();
        hrAdminToken = obtainToken("hr.admin@company.com", "Admin123!");

        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        // 3. Register Managers & Employees
        manager1Id = createManager("Manager", "One", "p4.mgr1@company.com", "Pass123!", "LINE_MANAGER", itDept.getId());
        manager1Token = obtainToken("p4.mgr1@company.com", "Pass123!");

        manager2Id = createManager("Manager", "Two", "p4.mgr2@company.com", "Pass123!", "LINE_MANAGER", itDept.getId());
        manager2Token = obtainToken("p4.mgr2@company.com", "Pass123!");

        employee1Id = registerEmployee("Alice", "Emp", "p4.emp1@company.com", "Pass123!", itDept.getId());
        employee1Token = obtainToken("p4.emp1@company.com", "Pass123!");

        employee2Id = registerEmployee("Bob", "Emp", "p4.emp2@company.com", "Pass123!", itDept.getId());
        employee2Token = obtainToken("p4.emp2@company.com", "Pass123!");

        // 4. Assign Hierarchy: Employee 1 -> Manager 1, Employee 2 -> Manager 2
        AssignManagerRequest assign1 = AssignManagerRequest.builder()
                .employeeId(employee1Id)
                .managerId(manager1Id)
                .relationshipType(RelationshipType.DIRECT)
                .build();
        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assign1)))
                .andExpect(status().isOk());

        AssignManagerRequest assign2 = AssignManagerRequest.builder()
                .employeeId(employee2Id)
                .managerId(manager2Id)
                .relationshipType(RelationshipType.DIRECT)
                .build();
        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assign2)))
                .andExpect(status().isOk());

        // 5. Initialize leave balances for Employee 1 & 2
        User emp1User = userRepository.findById(employee1Id).orElseThrow();
        leaveBalanceService.initializeBalancesForUser(emp1User, currentYear);

        User emp2User = userRepository.findById(employee2Id).orElseThrow();
        leaveBalanceService.initializeBalancesForUser(emp2User, currentYear);

        LeaveType annualType = leaveTypeRepository.findByCode("ANNUAL").orElseThrow();
        annualLeaveTypeId = annualType.getId();

        // Credit initial accrued days so employees have available balance to request leave
        LeaveBalance bal1 = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee1Id, annualLeaveTypeId, currentYear).orElseThrow();
        bal1.setAccruedDays(new BigDecimal("20.00"));
        leaveBalanceRepository.save(bal1);

        LeaveBalance bal2 = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee2Id, annualLeaveTypeId, currentYear).orElseThrow();
        bal2.setAccruedDays(new BigDecimal("20.00"));
        leaveBalanceRepository.save(bal2);
    }

    @Test
    @Order(1)
    @DisplayName("1. Submit leave request: places hold on pending_days and routes to direct line manager")
    void testSubmitLeaveRequest_HoldsPendingDaysAndRoutesToLineManager() throws Exception {
        // Monday next week
        LocalDate nextMon = LocalDate.now().plusWeeks(1).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        LocalDate nextWed = nextMon.plusDays(2); // Mon, Tue, Wed = 3 working days

        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(nextMon)
                .endDate(nextWed)
                .reason("Vacation trip")
                .build();

        MvcResult result = mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.totalDays").value(3.0))
                .andExpect(jsonPath("$.data.approvals", hasSize(1)))
                .andExpect(jsonPath("$.data.approvals[0].approverEmail").value("p4.mgr1@company.com"))
                .andExpect(jsonPath("$.data.approvals[0].status").value("PENDING"))
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        testRequestId1 = UUID.fromString(json.path("data").path("id").asText());

        // Verify balance pending hold: pending_days == 3.00, used_days == 0.00
        LeaveBalance bal = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee1Id, annualLeaveTypeId, currentYear).orElseThrow();
        assertThat(bal.getPendingDays()).isEqualByComparingTo(new BigDecimal("3.00"));
        assertThat(bal.getUsedDays()).isEqualByComparingTo(new BigDecimal("0.00"));
    }

    @Test
    @Order(2)
    @DisplayName("2. Weekend exclusion: Friday to Monday spans 4 calendar days but exactly 2 working days")
    void testWeekendExclusion_CountsOnlyWorkingDays() throws Exception {
        // Friday next week + 1
        LocalDate nextFri = LocalDate.now().plusWeeks(2).with(TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY));
        LocalDate followingMon = nextFri.plusDays(3); // Sat & Sun excluded -> Fri + Mon = 2 days

        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(nextFri)
                .endDate(followingMon)
                .reason("Long weekend")
                .build();

        MvcResult result = mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.totalDays").value(2.0))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        testRequestId2 = UUID.fromString(json.path("data").path("id").asText());

        // Balance pending should now be 3.00 + 2.00 = 5.00
        LeaveBalance bal = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee1Id, annualLeaveTypeId, currentYear).orElseThrow();
        assertThat(bal.getPendingDays()).isEqualByComparingTo(new BigDecimal("5.00"));
    }

    @Test
    @Order(3)
    @DisplayName("3. Date validation: End date before start date rejected with HTTP 400")
    void testDateValidation_EndDateBeforeStartDate() throws Exception {
        LocalDate start = LocalDate.now().plusWeeks(3);
        LocalDate end = start.minusDays(2);

        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(start)
                .endDate(end)
                .reason("Invalid dates")
                .build();

        mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @Order(4)
    @DisplayName("4. Date validation: Start date in past rejected with HTTP 400")
    void testDateValidation_StartDateInPast() throws Exception {
        LocalDate past = LocalDate.now().minusDays(5);

        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(past)
                .endDate(past.plusDays(2))
                .reason("Past dates")
                .build();

        mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @Order(5)
    @DisplayName("5. Overlap validation: Overlapping active or pending request rejected with HTTP 400")
    void testOverlapValidation_Rejected() throws Exception {
        // testRequestId1 was next week Monday to Wednesday. Attempt Tuesday to Thursday.
        LocalDate nextMon = LocalDate.now().plusWeeks(1).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        LocalDate nextTue = nextMon.plusDays(1);
        LocalDate nextThu = nextMon.plusDays(3);

        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(nextTue)
                .endDate(nextThu)
                .reason("Overlapping trip")
                .build();

        mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already exists for the selected date range")));
    }

    @Test
    @Order(6)
    @DisplayName("6. Insufficient balance: Requesting more days than available rejected with HTTP 400")
    void testInsufficientBalance_Rejected() throws Exception {
        LocalDate start = LocalDate.now().plusWeeks(5).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        LocalDate end = start.plusDays(60); // Over 40 working days, exceeds 21 statutory days

        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(start)
                .endDate(end)
                .reason("Too long sabbatical")
                .build();

        mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Insufficient leave balance")));
    }

    @Test
    @Order(7)
    @DisplayName("7. Relationship-based RBAC: Unassigned manager cannot approve another manager's employee request (HTTP 403)")
    void testRelationshipAuthorization_UnassignedManagerForbidden() throws Exception {
        // Manager 2 attempts to approve Employee 1's request (which is assigned to Manager 1)
        ApprovalDecisionRequest decision = ApprovalDecisionRequest.builder().comments("Illegal approval").build();

        mockMvc.perform(post("/api/leave/requests/" + testRequestId1 + "/approve")
                        .header("Authorization", "Bearer " + manager2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @Order(8)
    @DisplayName("8. Line Manager approval: Decrements pending_days, increments used_days, writes DEDUCTION ledger transaction")
    void testLineManagerApproval_Success() throws Exception {
        ApprovalDecisionRequest decision = ApprovalDecisionRequest.builder().comments("Approved. Enjoy your holiday!").build();

        mockMvc.perform(post("/api/leave/requests/" + testRequestId1 + "/approve")
                        .header("Authorization", "Bearer " + manager1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.approvals[0].status").value("APPROVED"))
                .andExpect(jsonPath("$.data.approvals[0].comments").value("Approved. Enjoy your holiday!"));

        // Check balance: pending decremented from 5.00 to 2.00, used incremented from 0.00 to 3.00
        LeaveBalance bal = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee1Id, annualLeaveTypeId, currentYear).orElseThrow();
        assertThat(bal.getPendingDays()).isEqualByComparingTo(new BigDecimal("2.00"));
        assertThat(bal.getUsedDays()).isEqualByComparingTo(new BigDecimal("3.00"));

        // Check ledger transaction
        List<BalanceTransaction> txs = balanceTransactionRepository.findByLeaveBalanceIdOrderByCreatedAtDesc(bal.getId());
        assertThat(txs).isNotEmpty();
        BalanceTransaction deduction = txs.get(0);
        assertThat(deduction.getTransactionType()).isEqualTo(TransactionType.DEDUCTION);
        assertThat(deduction.getAmountDays()).isEqualByComparingTo(new BigDecimal("3.00"));
        assertThat(deduction.getCreatedBy().getId()).isEqualTo(manager1Id);
    }

    @Test
    @Order(9)
    @DisplayName("9. State machine integrity: Cannot approve an already APPROVED request (HTTP 409 Conflict)")
    void testStateSafety_CannotApproveAlreadyApproved() throws Exception {
        ApprovalDecisionRequest decision = ApprovalDecisionRequest.builder().comments("Duplicate approve").build();

        mockMvc.perform(post("/api/leave/requests/" + testRequestId1 + "/approve")
                        .header("Authorization", "Bearer " + manager1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already APPROVED")));
    }

    @Test
    @Order(10)
    @DisplayName("10. Line Manager rejection: Releases pending_days hold and leaves used_days untouched")
    void testLineManagerRejection_ReleasesHold() throws Exception {
        ApprovalDecisionRequest decision = ApprovalDecisionRequest.builder().comments("Sorry, project deadline").build();

        mockMvc.perform(post("/api/leave/requests/" + testRequestId2 + "/reject")
                        .header("Authorization", "Bearer " + manager1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.approvals[0].status").value("REJECTED"));

        // Check balance: pending was 2.00, now releases back to 0.00; used remains 3.00
        LeaveBalance bal = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee1Id, annualLeaveTypeId, currentYear).orElseThrow();
        assertThat(bal.getPendingDays()).isEqualByComparingTo(new BigDecimal("0.00"));
        assertThat(bal.getUsedDays()).isEqualByComparingTo(new BigDecimal("3.00"));
    }

    @Test
    @Order(11)
    @DisplayName("11. Self-service cancellation: Employee cancels own pending request and pending_days is released")
    void testSelfServiceCancellation_Success() throws Exception {
        // Employee 1 submits a 1-day request
        LocalDate futureMon = LocalDate.now().plusWeeks(4).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(futureMon)
                .endDate(futureMon)
                .reason("Personal business")
                .build();

        MvcResult result = mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID cancelRequestId = UUID.fromString(json.path("data").path("id").asText());

        // Balance pending is 1.00
        LeaveBalance bal = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee1Id, annualLeaveTypeId, currentYear).orElseThrow();
        assertThat(bal.getPendingDays()).isEqualByComparingTo(new BigDecimal("1.00"));

        // Employee 2 cannot cancel Employee 1's request
        mockMvc.perform(post("/api/leave/requests/" + cancelRequestId + "/cancel")
                        .header("Authorization", "Bearer " + employee2Token))
                .andExpect(status().isForbidden());

        // Employee 1 cancels own request
        mockMvc.perform(post("/api/leave/requests/" + cancelRequestId + "/cancel")
                        .header("Authorization", "Bearer " + employee1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        // Balance pending released to 0.00
        bal = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee1Id, annualLeaveTypeId, currentYear).orElseThrow();
        assertThat(bal.getPendingDays()).isEqualByComparingTo(new BigDecimal("0.00"));
    }

    @Test
    @Order(12)
    @DisplayName("12. HR Admin override: Can approve on behalf of manager with explicit audit")
    void testHrAdminOverride_Approval() throws Exception {
        // Employee 2 submits leave routed to Manager 2
        LocalDate nextMon = LocalDate.now().plusWeeks(3).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(nextMon)
                .endDate(nextMon.plusDays(1)) // 2 days
                .reason("Dental appointment")
                .build();

        MvcResult result = mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID emp2RequestId = UUID.fromString(json.path("data").path("id").asText());

        // HR Admin overrides and approves directly
        ApprovalDecisionRequest decision = ApprovalDecisionRequest.builder().comments("Approved by HR on behalf of absent manager").build();
        mockMvc.perform(post("/api/leave/requests/" + emp2RequestId + "/approve")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.approvals[0].approverEmail").value("hr.admin@company.com"));

        // Employee 2 balance checked
        LeaveBalance bal = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(employee2Id, annualLeaveTypeId, currentYear).orElseThrow();
        assertThat(bal.getUsedDays()).isEqualByComparingTo(new BigDecimal("2.00"));
    }

    @Test
    @Order(13)
    @DisplayName("13. Anti-IDOR: /my-requests only returns caller's requests and /pending-approvals only returns assigned requests")
    void testMyRequestsAndPendingApprovals_AntiIdor() throws Exception {
        // Employee 1 sees their own requests
        mockMvc.perform(get("/api/leave/requests/my-requests")
                        .header("Authorization", "Bearer " + employee1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", not(empty())))
                .andExpect(jsonPath("$.data[*].employeeEmail", everyItem(equalTo("p4.emp1@company.com"))));

        // Employee 2 submits a new pending request
        LocalDate date = LocalDate.now().plusWeeks(5).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveTypeId)
                .startDate(date)
                .endDate(date)
                .reason("Quick checkup")
                .build();

        mockMvc.perform(post("/api/leave/requests")
                        .header("Authorization", "Bearer " + employee2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        // Manager 1 should NOT see Employee 2's pending approval
        mockMvc.perform(get("/api/leave/requests/pending-approvals")
                        .header("Authorization", "Bearer " + manager1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].employeeEmail", not(hasItem("p4.emp2@company.com"))));

        // Manager 2 DOES see Employee 2's pending approval
        mockMvc.perform(get("/api/leave/requests/pending-approvals")
                        .header("Authorization", "Bearer " + manager2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].employeeEmail", hasItem("p4.emp2@company.com")));
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

    private UUID createManager(String first, String last, String email, String password, String role, UUID deptId) throws Exception {
        CreateUserRequest req = CreateUserRequest.builder()
                .firstName(first)
                .lastName(last)
                .email(email)
                .password(password)
                .roleName(role)
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
