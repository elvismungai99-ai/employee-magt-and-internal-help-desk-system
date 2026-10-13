package com.leavemgt.platform.controller;

import com.leavemgt.identity.entity.User;
import com.leavemgt.leave.entity.LeaveBalance;
import com.leavemgt.leave.entity.LeaveRequest;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/reports")
@PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
@Slf4j
public class AdminReportController {

    private final LeaveBalanceRepository balanceRepository;
    private final LeaveRequestRepository requestRepository;

    public AdminReportController(LeaveBalanceRepository balanceRepository,
                                 LeaveRequestRepository requestRepository) {
        this.balanceRepository = balanceRepository;
        this.requestRepository = requestRepository;
    }

    @GetMapping("/leave-balances/export-csv")
    public void exportLeaveBalancesCsv(
            @RequestParam(name = "year", required = false) Integer yearParam,
            HttpServletResponse response) throws IOException {
        int year = yearParam != null ? yearParam : LocalDate.now().getYear();
        log.info("Exporting leave balances CSV for year {}", year);

        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"leave_balances_" + year + ".csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("Employee Code,Full Name,Email,Department,Job Title,Leave Type,Year,Entitled Days,Accrued Days,Used Days,Pending Days,Carried Over Days,Available Days");

        List<LeaveBalance> balances = balanceRepository.findAllByYear(year);
        for (LeaveBalance b : balances) {
            User u = b.getUser();
            String empCode = u != null && u.getEmployeeCode() != null ? escapeCsv(u.getEmployeeCode()) : "";
            String name = u != null ? escapeCsv(u.getFullName()) : "";
            String email = u != null ? escapeCsv(u.getEmail()) : "";
            String dept = u != null && u.getDepartment() != null ? escapeCsv(u.getDepartment().getName()) : "General";
            String jobTitle = u != null && u.getJobTitle() != null ? escapeCsv(u.getJobTitle()) : "";
            String leaveType = b.getLeaveType() != null ? escapeCsv(b.getLeaveType().getName()) : "";

            writer.printf("%s,%s,%s,%s,%s,%s,%d,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f%n",
                    empCode,
                    name,
                    email,
                    dept,
                    jobTitle,
                    leaveType,
                    b.getYear(),
                    b.getEntitledDays() != null ? b.getEntitledDays() : BigDecimal.ZERO,
                    b.getAccruedDays() != null ? b.getAccruedDays() : BigDecimal.ZERO,
                    b.getUsedDays() != null ? b.getUsedDays() : BigDecimal.ZERO,
                    b.getPendingDays() != null ? b.getPendingDays() : BigDecimal.ZERO,
                    b.getCarriedOverDays() != null ? b.getCarriedOverDays() : BigDecimal.ZERO,
                    b.getAvailableDays() != null ? b.getAvailableDays() : BigDecimal.ZERO
            );
        }
        writer.flush();
    }

    @GetMapping("/department-absences/export-csv")
    public void exportDepartmentAbsencesCsv(
            @RequestParam(name = "year", required = false) Integer yearParam,
            HttpServletResponse response) throws IOException {
        int year = yearParam != null ? yearParam : LocalDate.now().getYear();
        log.info("Exporting department absences CSV for year {}", year);

        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"department_absences_" + year + ".csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("Request ID,Employee Code,Employee Name,Email,Department,Leave Type,Start Date,End Date,Total Days,Status,Reason,Created At");

        List<LeaveRequest> requests = requestRepository.findAllByOrderByCreatedAtDesc();
        for (LeaveRequest lr : requests) {
            if (lr.getStartDate() != null && lr.getStartDate().getYear() == year) {
                User u = lr.getUser();
                String reqId = lr.getId().toString();
                String empCode = u != null && u.getEmployeeCode() != null ? escapeCsv(u.getEmployeeCode()) : "";
                String name = u != null ? escapeCsv(u.getFullName()) : "";
                String email = u != null ? escapeCsv(u.getEmail()) : "";
                String dept = u != null && u.getDepartment() != null ? escapeCsv(u.getDepartment().getName()) : "General";
                String leaveType = lr.getLeaveType() != null ? escapeCsv(lr.getLeaveType().getName()) : "";
                String reason = escapeCsv(lr.getReason());
                String status = lr.getStatus() != null ? lr.getStatus().name() : "";
                String createdAt = lr.getCreatedAt() != null ? lr.getCreatedAt().toString() : "";

                writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%.2f,%s,%s,%s%n",
                        reqId,
                        empCode,
                        name,
                        email,
                        dept,
                        leaveType,
                        lr.getStartDate(),
                        lr.getEndDate(),
                        lr.getTotalDays() != null ? lr.getTotalDays() : BigDecimal.ZERO,
                        status,
                        reason,
                        createdAt
                );
            }
        }
        writer.flush();
    }

    @GetMapping("/leave-liability/export-csv")
    public void exportLeaveLiabilityCsv(
            @RequestParam(name = "year", required = false) Integer yearParam,
            HttpServletResponse response) throws IOException {
        int year = yearParam != null ? yearParam : LocalDate.now().getYear();
        log.info("Exporting leave liability CSV for year {}", year);

        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"leave_liability_" + year + ".csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("Department,Employee Count,Total Entitled Days,Total Accrued Days,Total Used Days,Total Available Days");

        List<LeaveBalance> balances = balanceRepository.findAllByYear(year);
        Map<String, List<LeaveBalance>> deptMap = balances.stream()
                .collect(Collectors.groupingBy(b -> (b.getUser() != null && b.getUser().getDepartment() != null)
                        ? b.getUser().getDepartment().getName() : "General"));

        for (Map.Entry<String, List<LeaveBalance>> entry : deptMap.entrySet()) {
            String dept = escapeCsv(entry.getKey());
            List<LeaveBalance> list = entry.getValue();
            long uniqueEmployees = list.stream().map(b -> b.getUser().getId()).distinct().count();

            BigDecimal totalEntitled = list.stream().map(b -> b.getEntitledDays() != null ? b.getEntitledDays() : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalAccrued = list.stream().map(b -> b.getAccruedDays() != null ? b.getAccruedDays() : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalUsed = list.stream().map(b -> b.getUsedDays() != null ? b.getUsedDays() : BigDecimal.ZERO).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalAvailable = list.stream().map(LeaveBalance::getAvailableDays).reduce(BigDecimal.ZERO, BigDecimal::add);

            writer.printf("%s,%d,%.2f,%.2f,%.2f,%.2f%n",
                    dept,
                    uniqueEmployees,
                    totalEntitled,
                    totalAccrued,
                    totalUsed,
                    totalAvailable
            );
        }
        writer.flush();
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
