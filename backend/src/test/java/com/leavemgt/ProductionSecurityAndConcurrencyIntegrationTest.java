package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.identity.repository.ReportingHierarchyRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.LeaveRequestResponse;
import com.leavemgt.leave.dto.SubmitLeaveRequest;
import com.leavemgt.leave.entity.LeaveBalance;
import com.leavemgt.leave.entity.LeaveType;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import com.leavemgt.leave.service.HolidayService;
import com.leavemgt.leave.service.LeaveRequestService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Enterprise Production Readiness, Security, Concurrency & Data Integrity Test Suite.
 * Validates BOLA/IDOR protection, RBAC, JWT tampering, Kenyan holiday calculations,
 * double-deduction race conditions, and leave liability reporting.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ProductionSecurityAndConcurrencyIntegrationTest {

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
    private LeaveRequestService leaveRequestService;

    @Autowired
    private HolidayService holidayService;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private String hrAdminToken;
    private String employeeToken;
    private User employeeUser;
    private User secondEmployeeUser;
    private String secondEmployeeToken;
    private LeaveType annualLeaveType;

    @BeforeAll
    void setupProductionTestEnvironment() throws Exception {
        purgeUsers(List.of("sec.employee@company.com", "sec.attacker@company.com"));

        // 1. Authenticate as seeded HR Admin
        LoginRequest adminLogin = LoginRequest.builder()
                .email("hr.admin@company.com")
                .password("Admin123!")
                .build();

        MvcResult adminResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminLogin)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode adminJson = objectMapper.readTree(adminResult.getResponse().getContentAsString());
        hrAdminToken = adminJson.path("data").path("accessToken").asText();

        // 2. Register first test Employee
        Department itDept = departmentRepository.findByCode("IT").orElseThrow();
        RegisterRequest empRegister = RegisterRequest.builder()
                .firstName("Security")
                .lastName("Tester")
                .email("sec.employee@company.com")
                .password("Password123!")
                .departmentId(itDept.getId())
                .jobTitle("QA Security Engineer")
                .phone("+254711999888")
                .build();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(empRegister)))
                .andExpect(status().isCreated());

        employeeUser = userRepository.findByEmail("sec.employee@company.com").orElseThrow();

        // 3. Login as first Employee
        LoginRequest empLogin = LoginRequest.builder()
                .email("sec.employee@company.com")
                .password("Password123!")
                .build();

        MvcResult empResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(empLogin)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode empJson = objectMapper.readTree(empResult.getResponse().getContentAsString());
        employeeToken = empJson.path("data").path("accessToken").asText();

        // 4. Register second test Employee (to test cross-employee authorization)
        RegisterRequest secondEmpRegister = RegisterRequest.builder()
                .firstName("Second")
                .lastName("Employee")
                .email("sec.attacker@company.com")
                .password("Password123!")
                .departmentId(itDept.getId())
                .jobTitle("Analyst")
                .phone("+254711999777")
                .build();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(secondEmpRegister)))
                .andExpect(status().isCreated());

        secondEmployeeUser = userRepository.findByEmail("sec.attacker@company.com").orElseThrow();

        LoginRequest secondEmpLogin = LoginRequest.builder()
                .email("sec.attacker@company.com")
                .password("Password123!")
                .build();

        MvcResult secondEmpResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(secondEmpLogin)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode secondEmpJson = objectMapper.readTree(secondEmpResult.getResponse().getContentAsString());
        secondEmployeeToken = secondEmpJson.path("data").path("accessToken").asText();

        // 5. Retrieve Annual Leave Type
        annualLeaveType = leaveTypeRepository.findByName("Annual Leave")
                .orElseGet(() -> leaveTypeRepository.findAll().get(0));
    }

    @AfterAll
    void tearDown() {
        purgeUsers(List.of("sec.employee@company.com", "sec.attacker@company.com"));
    }

    private void purgeUsers(List<String> emails) {
        for (String email : emails) {
            userRepository.findByEmail(email).ifPresent(user -> {
                UUID uid = user.getId();
                jdbcTemplate.execute("DELETE FROM platform.notifications WHERE recipient_id = '" + uid + "'");
                jdbcTemplate.execute("DELETE FROM leave.out_of_office_records WHERE user_id = '" + uid + "'");
                jdbcTemplate.execute("DELETE FROM helpdesk.ticket_comments WHERE author_id = '" + uid + "'");
                jdbcTemplate.execute("DELETE FROM helpdesk.ticket_routing_history WHERE changed_by_id = '" + uid + "' OR previous_agent_id = '" + uid + "' OR new_agent_id = '" + uid + "'");
                jdbcTemplate.execute("DELETE FROM helpdesk.tickets WHERE requester_id = '" + uid + "' OR assigned_agent_id = '" + uid + "'");
                jdbcTemplate.execute("DELETE FROM helpdesk.queue_members WHERE agent_user_id = '" + uid + "' OR assigned_by = '" + uid + "'");
                jdbcTemplate.execute("DELETE FROM leave.balance_transactions WHERE leave_balance_id IN (SELECT id FROM leave.leave_balances WHERE user_id = '" + uid + "')");
                jdbcTemplate.execute("DELETE FROM leave.leave_approvals WHERE approver_id = '" + uid + "' OR leave_request_id IN (SELECT id FROM leave.leave_requests WHERE user_id = '" + uid + "')");
                jdbcTemplate.execute("DELETE FROM leave.leave_requests WHERE user_id = '" + uid + "'");
                jdbcTemplate.execute("DELETE FROM leave.leave_balances WHERE user_id = '" + uid + "'");
                jdbcTemplate.execute("UPDATE identity.reporting_hierarchy SET assigned_by = NULL WHERE assigned_by = '" + uid + "'");
                hierarchyRepository.deleteAll(hierarchyRepository.findAll().stream()
                        .filter(h -> h.getEmployee().getId().equals(uid) || h.getManager().getId().equals(uid))
                        .toList());
                refreshTokenRepository.deleteAll(refreshTokenRepository.findAll().stream()
                        .filter(rt -> rt.getUser().getId().equals(uid))
                        .toList());
                userRepository.delete(user);
            });
        }
    }

    // =========================================================================
    // 1. APPLICATION SECURITY (AppSec) & AUTHENTICATION TESTS
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("AppSec: Unauthenticated requests to protected endpoints are rejected with 401 Unauthorized")
    void test1_UnauthenticatedRequestsRejectedWith401() throws Exception {
        // Leave balances
        mockMvc.perform(get("/api/leave/balances"))
                .andExpect(status().isUnauthorized());

        // Admin employee directory
        mockMvc.perform(get("/api/admin/employees"))
                .andExpect(status().isUnauthorized());

        // Help Desk tickets
        mockMvc.perform(get("/api/helpdesk/tickets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(2)
    @DisplayName("AppSec: Forged and tampered JWT access tokens are rejected with 401 Unauthorized")
    void test2_TamperedJwtTokensRejectedWith401() throws Exception {
        // Forged signature token
        String forgedToken = employeeToken.substring(0, employeeToken.length() - 5) + "XYZ12";

        mockMvc.perform(get("/api/leave/balances")
                        .header("Authorization", "Bearer " + forgedToken))
                .andExpect(status().isUnauthorized());

        // Completely fake token
        mockMvc.perform(get("/api/leave/balances")
                        .header("Authorization", "Bearer not.a.valid.jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(3)
    @DisplayName("AppSec: Role-Based Access Control (RBAC) - Employees cannot access Admin endpoints (403 Forbidden)")
    void test3_EmployeeForbiddenFromAdminEndpoints() throws Exception {
        // Standard employee attempting to view admin employee registry
        mockMvc.perform(get("/api/admin/employees")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());

        // Standard employee attempting to export leave liability reports
        mockMvc.perform(get("/api/admin/reports/leave-liability/export-csv")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(4)
    @DisplayName("AppSec: Broken Object-Level Authorization (BOLA/IDOR) - Employee cannot approve another employee leave")
    void test4_EmployeeCannotApproveLeaveRequests() throws Exception {
        // Create a legitimate leave request by Employee 1
        LocalDate start = LocalDate.now().plusDays(10);
        while (!holidayService.isWorkingDay(start)) {
            start = start.plusDays(1);
        }
        LocalDate end = start.plusDays(1);
        while (!holidayService.isWorkingDay(end)) {
            end = end.plusDays(1);
        }

        SubmitLeaveRequest req = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveType.getId())
                .startDate(start)
                .endDate(end)
                .reason("Legitimate team member request")
                .build();

        LeaveRequestResponse created = leaveRequestService.submitRequest(req, employeeUser.getId());

        // Employee 2 (attacker) attempts to approve Employee 1's leave request
        String approvalPayload = "{\"decision\":\"APPROVED\",\"comments\":\"Unauthorized approval attempt\"}";

        mockMvc.perform(post("/api/leave/requests/" + created.getId() + "/approve")
                        .header("Authorization", "Bearer " + secondEmployeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(approvalPayload))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // 2. KENYAN STATUTORY WORKING DAY & PUBLIC HOLIDAY CALCULATIONS
    // =========================================================================

    @Test
    @Order(5)
    @DisplayName("Kenya Labor Law: Statutory holidays are recognized and excluded from working days")
    void test5_KenyanPublicHolidaysRecognized() {
        // 1. Madaraka Day (June 1)
        LocalDate madarakaDay = LocalDate.of(2026, 6, 1);
        assertThat(holidayService.isPublicHoliday(madarakaDay)).isTrue();
        assertThat(holidayService.isWorkingDay(madarakaDay)).isFalse();

        // 2. Mashujaa Day (October 20)
        LocalDate mashujaaDay = LocalDate.of(2026, 10, 20);
        assertThat(holidayService.isPublicHoliday(mashujaaDay)).isTrue();
        assertThat(holidayService.isWorkingDay(mashujaaDay)).isFalse();

        // 3. Weekends are never working days
        LocalDate saturday = LocalDate.of(2026, 6, 6);
        LocalDate sunday = LocalDate.of(2026, 6, 7);
        assertThat(holidayService.isWorkingDay(saturday)).isFalse();
        assertThat(holidayService.isWorkingDay(sunday)).isFalse();

        // 4. Leave spanning Friday to Monday (4 calendar days) calculates as 2 working days
        LocalDate friday = LocalDate.of(2026, 5, 8);
        LocalDate monday = LocalDate.of(2026, 5, 11);
        long workingDays = holidayService.calculateWorkingDays(friday, monday);
        assertThat(workingDays).isEqualTo(2L);
    }

    // =========================================================================
    // 3. OVERLAPPING LEAVE VALIDATION
    // =========================================================================

    @Test
    @Order(6)
    @DisplayName("Business Integrity: Overlapping leave requests for the same dates are strictly rejected")
    void test6_OverlappingLeaveRequestsRejected() {
        LocalDate start = LocalDate.now().plusDays(25);
        while (!holidayService.isWorkingDay(start)) {
            start = start.plusDays(1);
        }
        LocalDate end = start.plusDays(2);
        while (!holidayService.isWorkingDay(end)) {
            end = end.plusDays(1);
        }

        SubmitLeaveRequest firstRequest = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveType.getId())
                .startDate(start)
                .endDate(end)
                .reason("First scheduled trip")
                .build();

        // Submit first valid request
        leaveRequestService.submitRequest(firstRequest, employeeUser.getId());

        // Attempting to submit second overlapping request for the same employee
        SubmitLeaveRequest overlappingRequest = SubmitLeaveRequest.builder()
                .leaveTypeId(annualLeaveType.getId())
                .startDate(start.plusDays(1))
                .endDate(end.plusDays(1))
                .reason("Overlapping trip attempt")
                .build();

        assertThatThrownBy(() -> leaveRequestService.submitRequest(overlappingRequest, employeeUser.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("A pending or approved leave request already exists");
    }

    // =========================================================================
    // 4. CONCURRENCY & RACE CONDITION DEFENSE (PESSIMISTIC LOCKING)
    // =========================================================================

    @Test
    @Order(7)
    @DisplayName("Concurrency: Simultaneous leave requests honor Pessimistic Locking and never exceed available balance")
    void test7_ConcurrentLeaveRequestsPreventNegativeBalance() throws Exception {
        int year = LocalDate.now().getYear();

        // Ensure clean test balance of exactly 3 days for second employee
        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(
                secondEmployeeUser.getId(), annualLeaveType.getId(), year).orElseThrow();
        balance.setAccruedDays(new BigDecimal("3.00"));
        balance.setUsedDays(BigDecimal.ZERO);
        balance.setPendingDays(BigDecimal.ZERO);
        leaveBalanceRepository.saveAndFlush(balance);

        // Prepare 2 concurrent threads each attempting to request 2 days (total 4 days > 3 days available)
        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);

        AtomicInteger successfulRequests = new AtomicInteger(0);
        AtomicInteger rejectedRequests = new AtomicInteger(0);

        LocalDate baseDate = LocalDate.now().plusDays(50);
        while (!holidayService.isWorkingDay(baseDate)) {
            baseDate = baseDate.plusDays(1);
        }

        LocalDate req1Start = baseDate;
        LocalDate req1End = req1Start.plusDays(1);
        while (holidayService.calculateWorkingDays(req1Start, req1End) != 2) {
            req1End = req1End.plusDays(1);
        }

        LocalDate req2Start = req1End.plusDays(5);
        LocalDate req2End = req2Start.plusDays(1);
        while (holidayService.calculateWorkingDays(req2Start, req2End) != 2) {
            req2End = req2End.plusDays(1);
        }

        final LocalDate date1S = req1Start;
        final LocalDate date1E = req1End;
        final LocalDate date2S = req2Start;
        final LocalDate date2E = req2End;

        executor.submit(() -> {
            try {
                startLatch.await();
                SubmitLeaveRequest r = SubmitLeaveRequest.builder()
                        .leaveTypeId(annualLeaveType.getId())
                        .startDate(date1S)
                        .endDate(date1E)
                        .reason("Concurrent booking thread 1")
                        .build();
                leaveRequestService.submitRequest(r, secondEmployeeUser.getId());
                successfulRequests.incrementAndGet();
            } catch (Exception ex) {
                rejectedRequests.incrementAndGet();
            } finally {
                doneLatch.countDown();
            }
        });

        executor.submit(() -> {
            try {
                startLatch.await();
                SubmitLeaveRequest r = SubmitLeaveRequest.builder()
                        .leaveTypeId(annualLeaveType.getId())
                        .startDate(date2S)
                        .endDate(date2E)
                        .reason("Concurrent booking thread 2")
                        .build();
                leaveRequestService.submitRequest(r, secondEmployeeUser.getId());
                successfulRequests.incrementAndGet();
            } catch (Exception ex) {
                rejectedRequests.incrementAndGet();
            } finally {
                doneLatch.countDown();
            }
        });

        // Trigger simultaneous execution
        startLatch.countDown();
        doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        // Exactly one request must succeed and one must be rejected (3 days total, requests are 2 + 2 = 4 days)
        assertThat(successfulRequests.get()).isEqualTo(1);
        assertThat(rejectedRequests.get()).isEqualTo(1);

        // Verify balance state remained consistent without going negative
        LeaveBalance updatedBalance = leaveBalanceRepository.findByUserIdAndLeaveTypeIdAndYear(
                secondEmployeeUser.getId(), annualLeaveType.getId(), year).orElseThrow();
        BigDecimal availableDays = updatedBalance.getAccruedDays()
                .subtract(updatedBalance.getUsedDays())
                .subtract(updatedBalance.getPendingDays());

        assertThat(availableDays).isGreaterThanOrEqualTo(BigDecimal.ZERO);
        assertThat(updatedBalance.getPendingDays()).isEqualTo(new BigDecimal("2.00"));
    }

    // =========================================================================
    // 5. PRODUCTION DATA INTEGRITY & LIABILITY REPORTING
    // =========================================================================

    @Test
    @Order(8)
    @DisplayName("Reporting & Data Integrity: Leave liability CSV export generates valid CSV without errors")
    void test8_LeaveLiabilityCsvExportReturnsValidCsv() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/admin/reports/leave-liability/export-csv")
                        .header("Authorization", "Bearer " + hrAdminToken))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andReturn();

        String csvContent = result.getResponse().getContentAsString();
        assertThat(csvContent).isNotBlank();

        // Verify standard CSV headers
        String firstLine = csvContent.lines().findFirst().orElse("");
        assertThat(firstLine).contains("Department");
        assertThat(firstLine).contains("Employee Count");
        assertThat(firstLine).contains("Total Accrued Days");
        assertThat(firstLine).contains("Total Available Days");
    }
}
