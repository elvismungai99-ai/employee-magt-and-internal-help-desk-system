package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.identity.dto.AssignManagerRequest;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.RelationshipType;
import com.leavemgt.identity.entity.ReportingHierarchy;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.identity.repository.ReportingHierarchyRepository;
import com.leavemgt.identity.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Phase2HierarchyIntegrationTest {

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

    private String hrAdminToken;
    private UUID hrAdminId;

    private String employee1Token;
    private UUID employee1Id;

    private String employee2Token;
    private UUID employee2Id;

    private String manager1Token;
    private UUID manager1Id;

    private String manager2Token;
    private UUID manager2Id;

    private String manager3Token;
    private UUID manager3Id;

    private UUID inactiveUserId;

    @BeforeAll
    void setupTestData() throws Exception {
        // Clean previous test users
        List<String> emailsToClean = List.of(
                "p2.emp1@company.com",
                "p2.emp2@company.com",
                "p2.mgr1@company.com",
                "p2.mgr2@company.com",
                "p2.mgr3@company.com",
                "p2.inactive@company.com"
        );
        for (String email : emailsToClean) {
            userRepository.findByEmail(email).ifPresent(user -> {
                hierarchyRepository.deleteAll(hierarchyRepository.findAll().stream()
                        .filter(h -> h.getEmployee().getId().equals(user.getId()) || h.getManager().getId().equals(user.getId()))
                        .toList());
                refreshTokenRepository.deleteAll(refreshTokenRepository.findAll().stream()
                        .filter(rt -> rt.getUser().getId().equals(user.getId()))
                        .toList());
                userRepository.delete(user);
            });
        }

        // Login HR Admin
        User hrAdmin = userRepository.findByEmail("hr.admin@company.com").orElseThrow();
        hrAdminId = hrAdmin.getId();
        hrAdminToken = obtainToken("hr.admin@company.com", "Admin123!");

        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        // Register Employee 1
        employee1Id = registerEmployee("EmpOne", "Test", "p2.emp1@company.com", "Pass123!", itDept.getId());
        employee1Token = obtainToken("p2.emp1@company.com", "Pass123!");

        // Register Employee 2
        employee2Id = registerEmployee("EmpTwo", "Test", "p2.emp2@company.com", "Pass123!", itDept.getId());
        employee2Token = obtainToken("p2.emp2@company.com", "Pass123!");

        // Create Manager 1 via Admin (LINE_MANAGER)
        manager1Id = createManager("ManagerOne", "Lead", "p2.mgr1@company.com", "Pass123!", "LINE_MANAGER", itDept.getId());
        manager1Token = obtainToken("p2.mgr1@company.com", "Pass123!");

        // Create Manager 2 via Admin (LINE_MANAGER)
        manager2Id = createManager("ManagerTwo", "Lead", "p2.mgr2@company.com", "Pass123!", "LINE_MANAGER", itDept.getId());
        manager2Token = obtainToken("p2.mgr2@company.com", "Pass123!");

        // Create Manager 3 via Admin (LINE_MANAGER)
        manager3Id = createManager("ManagerThree", "Lead", "p2.mgr3@company.com", "Pass123!", "LINE_MANAGER", itDept.getId());
        manager3Token = obtainToken("p2.mgr3@company.com", "Pass123!");

        // Register an Inactive User directly for testing status rule
        User inactiveUser = User.builder()
                .employeeCode("EMP-INACTIVE")
                .firstName("Inactive")
                .lastName("User")
                .email("p2.inactive@company.com")
                .passwordHash("hash")
                .status("INACTIVE")
                .build();
        inactiveUserId = userRepository.save(inactiveUser).getId();
    }

    @Test
    @Order(1)
    @DisplayName("HR_ADMIN assigns Manager 1 to Employee 1: confirm row lands with is_active=true and assigned_by set")
    void testAssignManagerSuccess() throws Exception {
        AssignManagerRequest request = AssignManagerRequest.builder()
                .employeeId(employee1Id)
                .managerId(manager1Id)
                .relationshipType(RelationshipType.DIRECT)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.employee.id").value(employee1Id.toString()))
                .andExpect(jsonPath("$.data.manager.id").value(manager1Id.toString()))
                .andExpect(jsonPath("$.data.relationshipType").value("DIRECT"))
                .andExpect(jsonPath("$.data.isActive").value(true))
                .andExpect(jsonPath("$.data.assignedBy.id").value(hrAdminId.toString()));

        // Confirm directly in database
        List<ReportingHierarchy> rows = hierarchyRepository.findActiveDirectRowsForEmployee(employee1Id);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getManager().getId()).isEqualTo(manager1Id);
        assertThat(rows.get(0).getAssignedBy()).isNotNull();
        assertThat(rows.get(0).getAssignedBy().getId()).isEqualTo(hrAdminId);
        assertThat(rows.get(0).getIsActive()).isTrue();
    }

    @Test
    @Order(2)
    @DisplayName("Reject self-reporting: employee cannot report to themselves")
    void testRejectSelfReporting() throws Exception {
        AssignManagerRequest request = AssignManagerRequest.builder()
                .employeeId(employee1Id)
                .managerId(employee1Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Employee cannot be assigned as their own manager"));
    }

    @Test
    @Order(3)
    @DisplayName("Reject 2-node cycle: Manager 1 reports to Manager 2, then Manager 2 attempts to report to Manager 1")
    void testRejectTwoNodeCycle() throws Exception {
        // Step 1: Assign Manager 2 as Manager 1's manager (Manager 1 -> Manager 2)
        AssignManagerRequest req1 = AssignManagerRequest.builder()
                .employeeId(manager1Id)
                .managerId(manager2Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        // Step 2: Attempting to assign Manager 1 as Manager 2's manager must fail with 400 (cycle: M1 -> M2 -> M1)
        AssignManagerRequest cycleReq = AssignManagerRequest.builder()
                .employeeId(manager2Id)
                .managerId(manager1Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cycleReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Cycle detected in reporting hierarchy: employee cannot appear in manager's reporting chain"));
    }

    @Test
    @Order(4)
    @DisplayName("Reject multi-node cycle: M1 -> M2 -> M3, then attempt M3 -> M1")
    void testRejectMultiNodeCycle() throws Exception {
        // Step 1: Manager 1 already reports to Manager 2 from Order(3).
        // Assign Manager 3 as Manager 2's manager (Manager 1 -> Manager 2 -> Manager 3)
        AssignManagerRequest req2 = AssignManagerRequest.builder()
                .employeeId(manager2Id)
                .managerId(manager3Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isOk());

        // Step 2: Attempt to assign Manager 1 as Manager 3's manager (creates cycle: M1 -> M2 -> M3 -> M1)
        AssignManagerRequest cycleReq = AssignManagerRequest.builder()
                .employeeId(manager3Id)
                .managerId(manager1Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cycleReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cycle detected in reporting hierarchy: employee cannot appear in manager's reporting chain"));
    }

    @Test
    @Order(5)
    @DisplayName("Reject assignment with plain EMPLOYEE token: returns 403 Forbidden")
    void testRejectPlainEmployeeAssignment() throws Exception {
        AssignManagerRequest request = AssignManagerRequest.builder()
                .employeeId(employee2Id)
                .managerId(manager1Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + employee1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(6)
    @DisplayName("Log in as employee, call /my-manager: returns assigned manager")
    void testGetMyManager() throws Exception {
        mockMvc.perform(get("/api/identity/hierarchy/my-manager")
                        .header("Authorization", "Bearer " + employee1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.manager.id").value(manager1Id.toString()))
                .andExpect(jsonPath("$.data.manager.fullName").value("ManagerOne Lead"))
                .andExpect(jsonPath("$.data.relationshipType").value("DIRECT"));
    }

    @Test
    @Order(7)
    @DisplayName("Log in as manager, call /my-subordinates: lists the assigned employee")
    void testGetMySubordinatesAsManager() throws Exception {
        mockMvc.perform(get("/api/identity/hierarchy/my-subordinates")
                        .header("Authorization", "Bearer " + manager1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].employee.id").value(employee1Id.toString()))
                .andExpect(jsonPath("$.data[0].employee.fullName").value("EmpOne Test"));
    }

    @Test
    @Order(8)
    @DisplayName("Log in as employee, call /my-subordinates: returns empty list, preventing data leakage")
    void testGetMySubordinatesAsEmployeeReturnsEmpty() throws Exception {
        mockMvc.perform(get("/api/identity/hierarchy/my-subordinates")
                        .header("Authorization", "Bearer " + employee1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @Order(9)
    @DisplayName("Reassignment closes history: old row is set to is_active=false and effective_to=now()")
    void testReassignmentClosesHistory() throws Exception {
        // Reassign Employee 1 from Manager 1 to Manager 3
        AssignManagerRequest reassignReq = AssignManagerRequest.builder()
                .employeeId(employee1Id)
                .managerId(manager3Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reassignReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.manager.id").value(manager3Id.toString()));

        // Check history in database: should have 1 inactive row (Manager 1) and 1 active row (Manager 3)
        List<ReportingHierarchy> allRows = hierarchyRepository.findAll().stream()
                .filter(rh -> rh.getEmployee().getId().equals(employee1Id))
                .toList();

        assertThat(allRows).hasSize(2);

        ReportingHierarchy closedRow = allRows.stream()
                .filter(rh -> rh.getManager().getId().equals(manager1Id))
                .findFirst().orElseThrow();
        assertThat(closedRow.getIsActive()).isFalse();
        assertThat(closedRow.getEffectiveTo()).isNotNull();

        ReportingHierarchy activeRow = allRows.stream()
                .filter(rh -> rh.getManager().getId().equals(manager3Id))
                .findFirst().orElseThrow();
        assertThat(activeRow.getIsActive()).isTrue();
        assertThat(activeRow.getEffectiveTo()).isNull();

        // Verify /my-manager now returns Manager 3
        mockMvc.perform(get("/api/identity/hierarchy/my-manager")
                        .header("Authorization", "Bearer " + employee1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.manager.id").value(manager3Id.toString()));
    }

    @Test
    @Order(10)
    @DisplayName("Reject assigning manager who has no managerial role (plain EMPLOYEE)")
    void testRejectManagerWithoutManagerRole() throws Exception {
        // Attempting to assign employee2 (EMPLOYEE role only) as manager of employee1
        AssignManagerRequest request = AssignManagerRequest.builder()
                .employeeId(employee1Id)
                .managerId(employee2Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Proposed manager does not possess managerial privileges (requires LINE_MANAGER or HR_ADMIN role)"));
    }

    @Test
    @Order(11)
    @DisplayName("Reject assigning inactive user")
    void testRejectInactiveUser() throws Exception {
        AssignManagerRequest request = AssignManagerRequest.builder()
                .employeeId(inactiveUserId)
                .managerId(manager1Id)
                .build();

        mockMvc.perform(post("/api/identity/hierarchy/assign")
                        .header("Authorization", "Bearer " + hrAdminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot assign hierarchy: employee is not in ACTIVE status (current: INACTIVE)"));
    }

    @Test
    @Order(12)
    @DisplayName("HR Admin can query any user's subordinates: GET /api/identity/hierarchy/{userId}/subordinates")
    void testAdminGetSubordinatesForUser() throws Exception {
        // Manager 3 manages Employee 1 (and Manager 2)
        mockMvc.perform(get("/api/identity/hierarchy/" + manager3Id + "/subordinates")
                        .header("Authorization", "Bearer " + hrAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[*].employee.id").value(hasItem(employee1Id.toString())));

        // Plain employee cannot call this admin endpoint (403)
        mockMvc.perform(get("/api/identity/hierarchy/" + manager3Id + "/subordinates")
                        .header("Authorization", "Bearer " + employee1Token))
                .andExpect(status().isForbidden());
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
