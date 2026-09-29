package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.identity.repository.ReportingHierarchyRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.dto.AdjustBalanceRequest;
import com.leavemgt.leave.dto.CreateLeavePolicyRequest;
import com.leavemgt.leave.dto.CreateLeaveTypeRequest;
import com.leavemgt.leave.dto.LeaveBalanceResponse;
import com.leavemgt.leave.entity.LeaveBalance;
import com.leavemgt.leave.entity.LeavePolicy;
import com.leavemgt.leave.entity.LeaveType;
import com.leavemgt.leave.entity.TransactionType;
import com.leavemgt.leave.repository.BalanceTransactionRepository;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeavePolicyRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import com.leavemgt.leave.service.LeaveBalanceService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.Year;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Phase3LeaveCatalogIntegrationTest {

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
    private LeavePolicyRepository leavePolicyRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private BalanceTransactionRepository balanceTransactionRepository;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    private String hrAdminToken;
    private UUID hrAdminId;

    private String employeeToken;
    private UUID employeeId;

    private String secondEmployeeToken;
    private UUID secondEmployeeId;

    @BeforeAll
    void setupTestData() throws Exception {
        // Clean previous test users
        List<String> emailsToClean = List.of(
                "p3.emp@company.com",
                "p3.emp2@company.com",
                "p3.admincreate@company.com"
        );
        for (String email : emailsToClean) {
            userRepository.findByEmail(email).ifPresent(user -> {
                leaveBalanceRepository.deleteAll(leaveBalanceRepository.findAllByUserId(user.getId()));
                hierarchyRepository.deleteAll(hierarchyRepository.findAll().stream()
                        .filter(h -> h.getEmployee().getId().equals(user.getId()) || h.getManager().getId().equals(user.getId()))
                        .toList());
                refreshTokenRepository.deleteAll(refreshTokenRepository.findAll().stream()
                        .filter(rt -> rt.getUser().getId().equals(user.getId()))
                        .toList());
                userRepository.delete(user);
            });
        }

        // Clean up test leave types from prior runs
        leaveTypeRepository.findByCode("STUDY").ifPresent(lt -> {
            leavePolicyRepository.deleteAll(leavePolicyRepository.findAll().stream().filter(p -> p.getLeaveType().getId().equals(lt.getId())).toList());
            leaveBalanceRepository.deleteAll(leaveBalanceRepository.findAll().stream().filter(b -> b.getLeaveType().getId().equals(lt.getId())).toList());
            leaveTypeRepository.delete(lt);
        });

        // Login HR Admin
        User hrAdmin = userRepository.findByEmail("hr.admin@company.com").orElseThrow();
        hrAdminId = hrAdmin.getId();
        hrAdminToken = obtainToken("hr.admin@company.com", "Admin123!");

        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        // Register Employee
        employeeId = registerEmployee("Jane", "Doe", "p3.emp@company.com", "Pass123!", itDept.getId());
        employeeToken = obtainToken("p3.emp@company.com", "Pass123!");

        // Register Second Employee
        secondEmployeeId = registerEmployee("Bob", "Ross", "p3.emp2@company.com", "Pass123!", itDept.getId());
        secondEmployeeToken = obtainToken("p3.emp2@company.com", "Pass123!");
    }

    @Test
    @Order(1)
    @DisplayName("Verify DataInitializer seeded 5 statutory Kenyan leave types and active policies")
    void testSeederLeaveTypesAndPolicies() throws Exception {
        List<String> expectedCodes = List.of("ANNUAL", "SICK", "CASUAL", "MATERNITY", "PATERNITY");
        int currentYear = Year.now().getValue();

        for (String code : expectedCodes) {
            LeaveType type = leaveTypeRepository.findByCode(code).orElseThrow();
            assertThat(type.getIsActive()).isTrue();

            LeavePolicy policy = leavePolicyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(type.getId(), currentYear)
                    .orElseThrow();
            assertThat(policy.getIsActive()).isTrue();
            assertThat(policy.getAnnualAllowance()).isGreaterThan(BigDecimal.ZERO);
        }

        // Verify specific statutory entitlements under Kenya Employment Act 2007
        LeaveType annualType = leaveTypeRepository.findByCode("ANNUAL").orElseThrow();
        LeavePolicy annualPolicy = leavePolicyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(annualType.getId(), currentYear).orElseThrow();
        assertThat(annualPolicy.getAnnualAllowance()).isEqualByComparingTo(new BigDecimal("21.00"));
        assertThat(annualPolicy.getMonthlyAccrualRate()).isEqualByComparingTo(new BigDecimal("1.75"));

        LeaveType maternityType = leaveTypeRepository.findByCode("MATERNITY").orElseThrow();
        LeavePolicy maternityPolicy = leavePolicyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(maternityType.getId(), currentYear).orElseThrow();
        assertThat(maternityPolicy.getAnnualAllowance()).isEqualByComparingTo(new BigDecimal("90.00"));

        LeaveType paternityType = leaveTypeRepository.findByCode("PATERNITY").orElseThrow();
        LeavePolicy paternityPolicy = leavePolicyRepository.findByLeaveTypeIdAndEffectiveYearAndIsActiveTrue(paternityType.getId(), currentYear).orElseThrow();
        assertThat(paternityPolicy.getAnnualAllowance()).isEqualByComparingTo(new BigDecimal("14.00"));
    }

    @Test
    @Order(2)
    @DisplayName("Creating employee via POST /api/identity/users automatically initializes balances for active types")
    void testAdminCreateUserInitializesBalances() throws Exception {
        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        CreateUserRequest request = CreateUserRequest.builder()
                .firstName("Samuel")
                .lastName("Kip")
                .email("p3.admincreate@company.com")
                .password("Password123!")
                .roleName("EMPLOYEE")
                .departmentId(itDept.getId())
                .jobTitle("Junior Dev")
                .build();

        MvcResult result = mockMvc.perform(post("/api/identity/users")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID createdUserId = UUID.fromString(jsonNode.path("data").path("id").asText());

        // Verify leave_balances rows created in PostgreSQL
        int currentYear = Year.now().getValue();
        List<LeaveBalance> balances = leaveBalanceRepository.findByUserIdAndYear(createdUserId, currentYear);
        assertThat(balances).isNotEmpty();

        // Must cover all active leave types
        long activeTypeCount = leaveTypeRepository.findAllByIsActiveTrue().size();
        assertThat(balances).hasSize((int) activeTypeCount);

        for (LeaveBalance b : balances) {
            assertThat(b.getAccruedDays()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(b.getUsedDays()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(b.getPendingDays()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(b.getCarriedOverDays()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(b.getEntitledDays()).isGreaterThan(BigDecimal.ZERO);
        }
    }

    @Test
    @Order(3)
    @DisplayName("Idempotency: calling initialization twice for the same user does not duplicate rows")
    void testIdempotentBalanceInitialization() {
        int currentYear = Year.now().getValue();
        User employee = userRepository.findById(employeeId).orElseThrow();

        int initialCount = leaveBalanceRepository.findByUserIdAndYear(employeeId, currentYear).size();
        assertThat(initialCount).isGreaterThan(0);

        // Call again
        List<LeaveBalanceResponse> secondCall = leaveBalanceService.initializeBalancesForUser(employee, currentYear);
        int afterCount = leaveBalanceRepository.findByUserIdAndYear(employeeId, currentYear).size();

        assertThat(afterCount).isEqualTo(initialCount);
        assertThat(secondCall).hasSize(initialCount);
    }

    @Test
    @Order(4)
    @DisplayName("Employee calls GET /api/leave/balances/me: returns correct breakdown with availableDays")
    void testGetMyBalances() throws Exception {
        mockMvc.perform(get("/api/leave/balances/me")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data", hasSize(5)))
                .andExpect(jsonPath("$.data[0].userId").value(employeeId.toString()))
                .andExpect(jsonPath("$.data[0].availableDays").exists())
                .andExpect(jsonPath("$.data[0].entitledDays").isNumber())
                .andExpect(jsonPath("$.data[0].accruedDays").isNumber());
    }

    @Test
    @Order(5)
    @DisplayName("IDOR prevention: passing another user ID to /me is ignored, returns only caller's balances")
    void testIdorProtectionOnBalancesMe() throws Exception {
        // Attempt to pass ?userId=<otherUser> to /me
        mockMvc.perform(get("/api/leave/balances/me?userId=" + secondEmployeeId)
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].userId").value(employeeId.toString()));
    }

    @Test
    @Order(6)
    @DisplayName("Plain EMPLOYEE cannot create policies or leave types: returns 403 Forbidden")
    void testEmployeeCannotCreatePolicyOrType() throws Exception {
        CreateLeavePolicyRequest policyRequest = CreateLeavePolicyRequest.builder()
                .leaveTypeId(leaveTypeRepository.findByCode("ANNUAL").orElseThrow().getId())
                .policyName("Hacked Policy")
                .annualAllowance(new BigDecimal("100.00"))
                .effectiveYear(2027)
                .build();

        mockMvc.perform(post("/api/leave/policies")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(policyRequest)))
                .andExpect(status().isForbidden());

        CreateLeaveTypeRequest typeRequest = CreateLeaveTypeRequest.builder()
                .code("HACK")
                .name("Hack Leave")
                .build();

        mockMvc.perform(post("/api/leave/types")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(typeRequest)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(7)
    @DisplayName("HR Admin creates/updates policy: closes out prior active policy for that type")
    void testCreatePolicyClosesPriorActivePolicy() throws Exception {
        LeaveType annualType = leaveTypeRepository.findByCode("ANNUAL").orElseThrow();
        int targetYear = Year.now().getValue() + 1; // Future year policy update

        CreateLeavePolicyRequest request1 = CreateLeavePolicyRequest.builder()
                .leaveTypeId(annualType.getId())
                .policyName("Annual Policy v1")
                .annualAllowance(new BigDecimal("22.00"))
                .monthlyAccrualRate(new BigDecimal("1.83"))
                .maxCarryoverDays(new BigDecimal("5.00"))
                .effectiveYear(targetYear)
                .build();

        MvcResult res1 = mockMvc.perform(post("/api/leave/policies")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request1)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode node1 = objectMapper.readTree(res1.getResponse().getContentAsString());
        UUID policy1Id = UUID.fromString(node1.path("data").path("id").asText());

        // Now create a revised policy for the same type
        CreateLeavePolicyRequest request2 = CreateLeavePolicyRequest.builder()
                .leaveTypeId(annualType.getId())
                .policyName("Annual Policy v2 Revised")
                .annualAllowance(new BigDecimal("24.00"))
                .monthlyAccrualRate(new BigDecimal("2.00"))
                .maxCarryoverDays(new BigDecimal("6.00"))
                .effectiveYear(targetYear)
                .build();

        MvcResult res2 = mockMvc.perform(post("/api/leave/policies")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request2)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode node2 = objectMapper.readTree(res2.getResponse().getContentAsString());
        UUID policy2Id = UUID.fromString(node2.path("data").path("id").asText());

        // Verify policy1 is now inactive (closed out), and policy2 is active
        LeavePolicy p1 = leavePolicyRepository.findById(policy1Id).orElseThrow();
        assertThat(p1.getIsActive()).isFalse();

        LeavePolicy p2 = leavePolicyRepository.findById(policy2Id).orElseThrow();
        assertThat(p2.getIsActive()).isTrue();
        assertThat(p2.getAnnualAllowance()).isEqualByComparingTo(new BigDecimal("24.00"));
    }

    @Test
    @Order(8)
    @DisplayName("Balance integrity: used_days <= accrued_days + carried_over_days holds; violations rejected")
    void testBalanceIntegrityConstraint() throws Exception {
        int currentYear = Year.now().getValue();
        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndYear(employeeId, currentYear).get(0);

        // Attempt deduction exceeding available balance (0.00 accrued, attempting 5.00 deduction)
        AdjustBalanceRequest badDeduction = AdjustBalanceRequest.builder()
                .transactionType(TransactionType.DEDUCTION)
                .amountDays(new BigDecimal("5.00"))
                .description("Excess deduction")
                .build();

        mockMvc.perform(post("/api/leave/balances/" + balance.getId() + "/adjust")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badDeduction)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        // Now accrue 10 days legitimately
        AdjustBalanceRequest accrual = AdjustBalanceRequest.builder()
                .transactionType(TransactionType.MANUAL_ADJUSTMENT)
                .amountDays(new BigDecimal("10.00"))
                .description("Q1 Accrual")
                .build();

        mockMvc.perform(post("/api/leave/balances/" + balance.getId() + "/adjust")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(accrual)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accruedDays").value(10.0));

        // Now deduct 4 days (4 <= 10, valid)
        AdjustBalanceRequest validDeduction = AdjustBalanceRequest.builder()
                .transactionType(TransactionType.DEDUCTION)
                .amountDays(new BigDecimal("4.00"))
                .description("Approved leave deduction")
                .build();

        mockMvc.perform(post("/api/leave/balances/" + balance.getId() + "/adjust")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validDeduction)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.usedDays").value(4.0))
                .andExpect(jsonPath("$.data.availableDays").value(6.0));
    }

    @Test
    @Order(9)
    @DisplayName("Leave type deactivation marks is_active=false without deleting historical balances")
    void testDeactivateLeaveType() throws Exception {
        // Create custom type
        CreateLeaveTypeRequest request = CreateLeaveTypeRequest.builder()
                .code("STUDY")
                .name("Study Leave")
                .description("Leave for educational exams")
                .build();

        MvcResult result = mockMvc.perform(post("/api/leave/types")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID studyTypeId = UUID.fromString(jsonNode.path("data").path("id").asText());

        // Deactivate it
        mockMvc.perform(patch("/api/leave/types/" + studyTypeId + "/deactivate")
                        .header("Authorization", "Bearer " + hrAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isActive").value(false));

        // Active types endpoint must no longer include STUDY
        mockMvc.perform(get("/api/leave/types")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.code == 'STUDY')]").doesNotExist());

        // Record still safely exists in database
        assertThat(leaveTypeRepository.findById(studyTypeId)).isPresent();
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
}
