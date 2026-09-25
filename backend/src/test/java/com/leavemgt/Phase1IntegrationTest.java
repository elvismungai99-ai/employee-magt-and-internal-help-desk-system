package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RefreshTokenRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.identity.dto.CreateUserRequest;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.leavemgt.identity.repository.RefreshTokenRepository;
import com.leavemgt.identity.repository.ReportingHierarchyRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Phase1IntegrationTest {

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

    private String employeeAccessToken;
    private String employeeRefreshToken;
    private UUID employeeId;

    private String hrAdminAccessToken;
    private UUID managerId;

    @BeforeAll
    void cleanupTestData() {
        List<String> testEmails = List.of(
                "john.doe@company.com",
                "alice.manager@company.com",
                "unauthorized.create@company.com"
        );
        for (String email : testEmails) {
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
    }

    @Test
    @Order(1)
    @DisplayName("Verify DataInitializer created default HR Admin, roles, and departments")
    void testInitialDataSeeded() {
        assertThat(userRepository.findByEmail("hr.admin@company.com")).isPresent();
        assertThat(departmentRepository.findByCode("HR")).isPresent();
        assertThat(departmentRepository.findByCode("IT")).isPresent();
    }

    @Test
    @Order(2)
    @DisplayName("Register new employee and verify strictly EMPLOYEE role assigned")
    void testRegisterEmployee() throws Exception {
        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        RegisterRequest request = RegisterRequest.builder()
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@company.com")
                .password("Password123!")
                .departmentId(itDept.getId())
                .jobTitle("Software Engineer")
                .phone("+254711111111")
                .build();

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("john.doe@company.com"))
                .andExpect(jsonPath("$.data.roles[0]").value("EMPLOYEE"))
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        employeeId = UUID.fromString(jsonNode.path("data").path("id").asText());
    }

    @Test
    @Order(3)
    @DisplayName("Login with newly registered employee")
    void testLoginEmployee() throws Exception {
        LoginRequest request = LoginRequest.builder()
                .email("john.doe@company.com")
                .password("Password123!")
                .build();

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andExpect(jsonPath("$.data.roles[0]").value("EMPLOYEE"))
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        employeeAccessToken = jsonNode.path("data").path("accessToken").asText();
        employeeRefreshToken = jsonNode.path("data").path("refreshToken").asText();
    }

    @Test
    @Order(4)
    @DisplayName("Access /api/identity/users/me as employee without manager")
    void testGetEmployeeProfileBeforeManager() throws Exception {
        mockMvc.perform(get("/api/identity/users/me")
                        .header("Authorization", "Bearer " + employeeAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("john.doe@company.com"))
                .andExpect(jsonPath("$.data.fullName").value("John Doe"))
                .andExpect(jsonPath("$.data.roles[0]").value("EMPLOYEE"))
                .andExpect(jsonPath("$.data.department.code").value("IT"))
                .andExpect(jsonPath("$.data.manager").isEmpty());
    }

    @Test
    @Order(5)
    @DisplayName("Verify Employee cannot access HR Admin endpoint (403 Forbidden)")
    void testEmployeeCannotCreateUsers() throws Exception {
        CreateUserRequest request = CreateUserRequest.builder()
                .firstName("Test")
                .lastName("Manager")
                .email("unauthorized.create@company.com")
                .password("Password123!")
                .roleName("LINE_MANAGER")
                .build();

        mockMvc.perform(post("/api/identity/users")
                        .header("Authorization", "Bearer " + employeeAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(6)
    @DisplayName("Login as HR Admin")
    void testLoginHrAdmin() throws Exception {
        LoginRequest request = LoginRequest.builder()
                .email("hr.admin@company.com")
                .password("Admin123!")
                .build();

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.roles[0]").value("HR_ADMIN"))
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        hrAdminAccessToken = jsonNode.path("data").path("accessToken").asText();
    }

    @Test
    @Order(7)
    @DisplayName("HR Admin creates a LINE_MANAGER")
    void testAdminCreateLineManager() throws Exception {
        Department itDept = departmentRepository.findByCode("IT").orElseThrow();

        CreateUserRequest request = CreateUserRequest.builder()
                .firstName("Alice")
                .lastName("Smith")
                .email("alice.manager@company.com")
                .password("Password123!")
                .roleName("LINE_MANAGER")
                .departmentId(itDept.getId())
                .jobTitle("Engineering Lead")
                .phone("+254722222222")
                .build();

        MvcResult result = mockMvc.perform(post("/api/identity/users")
                        .header("Authorization", "Bearer " + hrAdminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("alice.manager@company.com"))
                .andExpect(jsonPath("$.data.roles[0]").value("LINE_MANAGER"))
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        managerId = UUID.fromString(jsonNode.path("data").path("id").asText());
    }

    @Test
    @Order(8)
    @DisplayName("HR Admin assigns LINE_MANAGER to Employee")
    void testAssignManagerToEmployee() throws Exception {
        mockMvc.perform(put("/api/identity/users/" + employeeId + "/manager")
                        .header("Authorization", "Bearer " + hrAdminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("managerId", managerId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.manager.id").value(managerId.toString()))
                .andExpect(jsonPath("$.data.manager.fullName").value("Alice Smith"));
    }

    @Test
    @Order(9)
    @DisplayName("Verify /api/identity/users/me as employee now shows assigned manager")
    void testGetEmployeeProfileAfterManagerAssigned() throws Exception {
        mockMvc.perform(get("/api/identity/users/me")
                        .header("Authorization", "Bearer " + employeeAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.manager.id").value(managerId.toString()))
                .andExpect(jsonPath("$.data.manager.fullName").value("Alice Smith"))
                .andExpect(jsonPath("$.data.manager.relationshipType").value("DIRECT"));
    }

    @Test
    @Order(10)
    @DisplayName("Refresh token rotation: valid refresh token issues new tokens")
    void testRefreshTokenRotation() throws Exception {
        RefreshTokenRequest request = RefreshTokenRequest.builder()
                .refreshToken(employeeRefreshToken)
                .build();

        MvcResult result = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.refreshToken").isString())
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        String newRefreshToken = jsonNode.path("data").path("refreshToken").asText();
        assertThat(newRefreshToken).isNotEqualTo(employeeRefreshToken);

        // Attempting to reuse old refresh token must fail with 401
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());

        // Update employeeRefreshToken to the new one
        employeeRefreshToken = newRefreshToken;
    }

    @Test
    @Order(11)
    @DisplayName("Logout revokes the refresh token")
    void testLogoutRevokesToken() throws Exception {
        RefreshTokenRequest request = RefreshTokenRequest.builder()
                .refreshToken(employeeRefreshToken)
                .build();

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Using revoked refresh token must fail with 401
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(12)
    @DisplayName("Rate limiting: 5 failed attempts locks out account for 15 minutes (HTTP 429)")
    void testLoginRateLimiting() throws Exception {
        String testEmail = "victim@company.com";
        LoginRequest badRequest = LoginRequest.builder()
                .email(testEmail)
                .password("WrongPassword")
                .build();

        // 5 failed attempts return 401
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badRequest)))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("Invalid email or password"));
        }

        // 6th attempt returns 429 Too Many Requests
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badRequest)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many failed login attempts. Please try again in 15 minutes."));
    }
}
