package com.leavemgt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.helpdesk.dto.CreateCannedResponseRequest;
import com.leavemgt.helpdesk.dto.SubmitCsatRequest;
import com.leavemgt.helpdesk.entity.*;
import com.leavemgt.helpdesk.repository.*;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.RoleRepository;
import com.leavemgt.identity.repository.UserRepository;
import com.leavemgt.leave.entity.LeaveRequest;
import com.leavemgt.leave.entity.LeaveRequestStatus;
import com.leavemgt.leave.entity.LeaveType;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import com.leavemgt.leave.repository.LeaveTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class EnterpriseCapabilitiesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private KnowledgeBaseArticleRepository kbRepository;

    @Autowired
    private CannedResponseRepository cannedRepository;

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TicketCategoryRepository categoryRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private LeaveTypeRepository leaveTypeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testEmployee;
    private User testAdmin;
    private User testAgent;
    private String employeeToken;
    private String adminToken;
    private String agentToken;
    private TicketCategory testCategory;

    @BeforeEach
    void setup() throws Exception {
        Role employeeRole = roleRepository.findByName("EMPLOYEE")
                .orElseGet(() -> roleRepository.save(Role.builder().name("EMPLOYEE").description("Employee").build()));
        Role hrRole = roleRepository.findByName("HR_ADMIN")
                .orElseGet(() -> roleRepository.save(Role.builder().name("HR_ADMIN").description("HR Admin").build()));
        Role agentRole = roleRepository.findByName("SUPPORT_AGENT")
                .orElseGet(() -> roleRepository.save(Role.builder().name("SUPPORT_AGENT").description("Support Agent").build()));

        testEmployee = userRepository.findByEmail("emp.enterprise@company.com").orElse(null);
        if (testEmployee == null) {
            testEmployee = userRepository.save(User.builder()
                    .employeeCode("ENT-001")
                    .email("emp.enterprise@company.com")
                    .passwordHash(passwordEncoder.encode("Password123!"))
                    .firstName("Enterprise")
                    .lastName("Employee")
                    .status("ACTIVE")
                    .roles(Set.of(employeeRole))
                    .build());
        }

        testAdmin = userRepository.findByEmail("hr.enterprise@company.com").orElse(null);
        if (testAdmin == null) {
            testAdmin = userRepository.save(User.builder()
                    .employeeCode("ENT-ADM")
                    .email("hr.enterprise@company.com")
                    .passwordHash(passwordEncoder.encode("Password123!"))
                    .firstName("Enterprise")
                    .lastName("Admin")
                    .status("ACTIVE")
                    .roles(Set.of(hrRole))
                    .build());
        }

        testAgent = userRepository.findByEmail("agent.enterprise@company.com").orElse(null);
        if (testAgent == null) {
            testAgent = userRepository.save(User.builder()
                    .employeeCode("ENT-AGT")
                    .email("agent.enterprise@company.com")
                    .passwordHash(passwordEncoder.encode("Password123!"))
                    .firstName("Enterprise")
                    .lastName("Agent")
                    .status("ACTIVE")
                    .roles(Set.of(agentRole))
                    .build());
        }

        employeeToken = obtainToken("emp.enterprise@company.com", "Password123!");
        adminToken = obtainToken("hr.enterprise@company.com", "Password123!");
        agentToken = obtainToken("agent.enterprise@company.com", "Password123!");

        testCategory = categoryRepository.findByCode("NETWORK")
                .orElseGet(() -> categoryRepository.save(TicketCategory.builder()
                        .name("Network & Connectivity")
                        .code("NETWORK")
                        .defaultPriority(TicketPriority.HIGH)
                        .isActive(true)
                        .build()));
    }

    private String obtainToken(String email, String password) throws Exception {
        LoginRequest req = LoginRequest.builder().email(email).password(password).build();
        MvcResult res = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        return root.path("data").path("accessToken").asText();
    }

    @Test
    @DisplayName("1. Knowledge Base - Search & Deflection API returns relevant suggestions")
    void testKbDeflection() throws Exception {
        kbRepository.save(KnowledgeBaseArticle.builder()
                .title("Corporate VPN Troubleshooting Guide")
                .slug("corporate-vpn-troubleshooting-test")
                .content("Instructions to resolve VPN connection errors.")
                .tags("vpn, network, connection")
                .category(testCategory)
                .isPublished(true)
                .viewCount(5)
                .helpfulCount(3)
                .build());

        mockMvc.perform(get("/api/helpdesk/kb/deflection")
                        .header("Authorization", "Bearer " + employeeToken)
                        .param("query", "vpn connection issue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].title", containsString("VPN")));
    }

    @Test
    @DisplayName("2. Knowledge Base - Helpful Vote increments vote count")
    void testKbVoteHelpful() throws Exception {
        KnowledgeBaseArticle article = kbRepository.save(KnowledgeBaseArticle.builder()
                .title("Password Reset Guide")
                .slug("pwd-reset-test")
                .content("Self-service password steps.")
                .isPublished(true)
                .viewCount(10)
                .helpfulCount(2)
                .build());

        mockMvc.perform(post("/api/helpdesk/kb/" + article.getId() + "/vote")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.helpfulCount").value(3));
    }

    @Test
    @DisplayName("3. Canned Responses - Agent can retrieve and create quick macros")
    void testCannedResponses() throws Exception {
        CreateCannedResponseRequest req = CreateCannedResponseRequest.builder()
                .title("Clear Browser Cache")
                .shortcut("#clear-cache")
                .content("Press Ctrl+Shift+Del in your browser and clear cache.")
                .categoryId(testCategory.getId())
                .build();

        mockMvc.perform(post("/api/helpdesk/canned-responses")
                        .header("Authorization", "Bearer " + agentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.shortcut").value("#clear-cache"));

        mockMvc.perform(get("/api/helpdesk/canned-responses")
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("4. Customer Satisfaction (CSAT) - Rating on resolved ticket")
    void testCsatSubmission() throws Exception {
        Ticket ticket = ticketRepository.save(Ticket.builder()
                .ticketNumber("TICK-TEST-999")
                .requester(testEmployee)
                .category(testCategory)
                .title("Email sync issue")
                .description("Outlook not syncing")
                .status(TicketStatus.RESOLVED)
                .priority(TicketPriority.MEDIUM)
                .resolvedAt(OffsetDateTime.now())
                .build());

        SubmitCsatRequest csatReq = SubmitCsatRequest.builder()
                .rating(5)
                .feedback("Excellent, fast support by the IT team!")
                .build();

        mockMvc.perform(post("/api/helpdesk/tickets/" + ticket.getId() + "/csat")
                        .header("Authorization", "Bearer " + employeeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(csatReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.csatRating").value(5))
                .andExpect(jsonPath("$.data.csatFeedback").value("Excellent, fast support by the IT team!"));
    }

    @Test
    @DisplayName("5. Calendar Integration - iCalendar (.ics) export generates RFC 5545 feed")
    void testIcsExport() throws Exception {
        LeaveType annual = leaveTypeRepository.findByCode("ANNUAL")
                .orElseGet(() -> leaveTypeRepository.save(LeaveType.builder()
                        .name("Annual Leave")
                        .code("ANNUAL")
                        .isPaid(true)
                        .requiresAttachment(false)
                        .build()));

        leaveRequestRepository.save(LeaveRequest.builder()
                .user(testEmployee)
                .leaveType(annual)
                .startDate(LocalDate.now().plusDays(2))
                .endDate(LocalDate.now().plusDays(5))
                .totalDays(new BigDecimal("4.00"))
                .status(LeaveRequestStatus.APPROVED)
                .reason("Vacation")
                .build());

        mockMvc.perform(get("/api/leave/calendar/my-leaves.ics")
                        .header("Authorization", "Bearer " + employeeToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/calendar; charset=UTF-8"))
                .andExpect(header().string("Content-Disposition", containsString("my_approved_leaves.ics")))
                .andExpect(content().string(containsString("BEGIN:VCALENDAR")))
                .andExpect(content().string(containsString("BEGIN:VEVENT")))
                .andExpect(content().string(containsString("SUMMARY:Annual Leave - Enterprise Employee")));
    }

    @Test
    @DisplayName("6. Team Capacity & Absence Heatmap - Calculates availability percentage")
    void testTeamCapacityHeatmap() throws Exception {
        mockMvc.perform(get("/api/leave/requests/team-capacity")
                        .header("Authorization", "Bearer " + employeeToken)
                        .param("startDate", LocalDate.now().toString())
                        .param("endDate", LocalDate.now().plusDays(6).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(7)))
                .andExpect(jsonPath("$.data[0].capacityPercentage").isNumber());
    }

    @Test
    @DisplayName("7. Admin - Leave Encashment Payroll CSV Export")
    void testEncashmentCsvExport() throws Exception {
        mockMvc.perform(get("/api/admin/reports/leave-encashment/export-csv")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("year", String.valueOf(LocalDate.now().getYear())))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/csv; charset=UTF-8"))
                .andExpect(header().string("Content-Disposition", containsString("leave_encashment_payroll_")))
                .andExpect(content().string(containsString("Request ID,Employee Code,Employee Name,Email,Department,Job Title,Leave Type,Year,Days Encashed")));
    }

    @Test
    @DisplayName("8. Admin - Executive Analytics Summary KPI Aggregates")
    void testExecutiveAnalyticsSummary() throws Exception {
        mockMvc.perform(get("/api/admin/analytics/summary")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalEmployees").isNumber())
                .andExpect(jsonPath("$.data.slaCompliancePercentage").isNumber());
    }

    @Test
    @DisplayName("9. Admin - System Audit Logs Pagination and Filtering")
    void testAuditLogs() throws Exception {
        mockMvc.perform(get("/api/admin/audit-logs")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray());
    }
}
