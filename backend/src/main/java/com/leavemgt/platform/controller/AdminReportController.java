package com.leavemgt.platform.controller;

import com.leavemgt.identity.entity.User;
import com.leavemgt.leave.entity.LeaveBalance;
import com.leavemgt.leave.entity.LeaveRequest;
import com.leavemgt.leave.repository.LeaveBalanceRepository;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/reports")
@PreAuthorize("hasAnyAuthority('ROLE_HR_ADMIN', 'HR_ADMIN')")
@Transactional(readOnly = true)
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
    public ResponseEntity<byte[]> exportLeaveBalancesCsv(
            @RequestParam(name = "year", required = false) Integer yearParam) {
        int year = yearParam != null ? yearParam : LocalDate.now().getYear();
        log.info("Exporting leave balances CSV for year {}", year);

        StringWriter sw = new StringWriter();
        PrintWriter writer = new PrintWriter(sw);
        writer.println("Employee Code,Full Name,Email,Department,Job Title,Leave Type,Year,Entitled Days,Accrued Days,Used Days,Pending Days,Carried Over Days,Available Days");

        List<LeaveBalance> balances = balanceRepository.findAllByYearWithUserAndDepartment(year);
        for (LeaveBalance b : balances) {
            User u = b.getUser();
            String empCode = u != null && u.getEmployeeCode() != null ? escapeCsv(u.getEmployeeCode()) : "";
            String name = u != null && u.getFullName() != null ? escapeCsv(u.getFullName()) : "";
            String email = u != null && u.getEmail() != null ? escapeCsv(u.getEmail()) : "";
            String dept = u != null && u.getDepartment() != null && u.getDepartment().getName() != null
                    ? escapeCsv(u.getDepartment().getName()) : "General";
            String jobTitle = u != null && u.getJobTitle() != null ? escapeCsv(u.getJobTitle()) : "";
            String leaveType = b.getLeaveType() != null && b.getLeaveType().getName() != null
                    ? escapeCsv(b.getLeaveType().getName()) : "";

            writer.printf(Locale.US, "%s,%s,%s,%s,%s,%s,%d,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f%n",
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

        byte[] csvData = sw.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leave_balances_" + year + ".csv\"")
                .body(csvData);
    }

    @GetMapping("/department-absences/export-csv")
    public ResponseEntity<byte[]> exportDepartmentAbsencesCsv(
            @RequestParam(name = "year", required = false) Integer yearParam) {
        int year = yearParam != null ? yearParam : LocalDate.now().getYear();
        log.info("Exporting department absences CSV for year {}", year);

        StringWriter sw = new StringWriter();
        PrintWriter writer = new PrintWriter(sw);
        writer.println("Request ID,Employee Code,Employee Name,Email,Department,Leave Type,Start Date,End Date,Total Days,Status,Reason,Created At");

        List<LeaveRequest> requests = requestRepository.findAllByOrderByCreatedAtDesc();
        for (LeaveRequest lr : requests) {
            if (lr.getStartDate() != null && lr.getStartDate().getYear() == year) {
                User u = lr.getUser();
                String reqId = lr.getId() != null ? lr.getId().toString() : "";
                String empCode = u != null && u.getEmployeeCode() != null ? escapeCsv(u.getEmployeeCode()) : "";
                String name = u != null && u.getFullName() != null ? escapeCsv(u.getFullName()) : "";
                String email = u != null && u.getEmail() != null ? escapeCsv(u.getEmail()) : "";
                String dept = u != null && u.getDepartment() != null && u.getDepartment().getName() != null
                        ? escapeCsv(u.getDepartment().getName()) : "General";
                String leaveType = lr.getLeaveType() != null && lr.getLeaveType().getName() != null
                        ? escapeCsv(lr.getLeaveType().getName()) : "";
                String reason = escapeCsv(lr.getReason());
                String status = lr.getStatus() != null ? lr.getStatus().name() : "";
                String createdAt = lr.getCreatedAt() != null ? lr.getCreatedAt().toString() : "";

                writer.printf(Locale.US, "%s,%s,%s,%s,%s,%s,%s,%s,%.2f,%s,%s,%s%n",
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

        byte[] csvData = sw.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"department_absences_" + year + ".csv\"")
                .body(csvData);
    }

    @GetMapping("/leave-liability/export-csv")
    public ResponseEntity<byte[]> exportLeaveLiabilityCsv(
            @RequestParam(name = "year", required = false) Integer yearParam) {
        int year = yearParam != null ? yearParam : LocalDate.now().getYear();
        log.info("Exporting leave liability CSV for year {}", year);

        StringWriter sw = new StringWriter();
        PrintWriter writer = new PrintWriter(sw);
        writer.println("Department,Employee Count,Total Entitled Days,Total Accrued Days,Total Used Days,Total Available Days");

        List<LeaveBalance> balances = balanceRepository.findAllByYearWithUserAndDepartment(year);
        Map<String, List<LeaveBalance>> deptMap = balances.stream()
                .collect(Collectors.groupingBy(b -> {
                    if (b != null && b.getUser() != null && b.getUser().getDepartment() != null && b.getUser().getDepartment().getName() != null) {
                        return b.getUser().getDepartment().getName();
                    }
                    return "General";
                }));

        for (Map.Entry<String, List<LeaveBalance>> entry : deptMap.entrySet()) {
            String dept = escapeCsv(entry.getKey());
            List<LeaveBalance> list = entry.getValue() != null ? entry.getValue() : Collections.emptyList();
            long uniqueEmployees = list.stream()
                    .filter(Objects::nonNull)
                    .map(b -> b.getUser() != null ? b.getUser().getId() : null)
                    .filter(Objects::nonNull)
                    .distinct()
                    .count();

            BigDecimal totalEntitled = list.stream()
                    .filter(Objects::nonNull)
                    .map(b -> b.getEntitledDays() != null ? b.getEntitledDays() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalAccrued = list.stream()
                    .filter(Objects::nonNull)
                    .map(b -> b.getAccruedDays() != null ? b.getAccruedDays() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalUsed = list.stream()
                    .filter(Objects::nonNull)
                    .map(b -> b.getUsedDays() != null ? b.getUsedDays() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalAvailable = list.stream()
                    .filter(Objects::nonNull)
                    .map(b -> {
                        BigDecimal avail = b.getAvailableDays();
                        return avail != null ? avail : BigDecimal.ZERO;
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            writer.printf(Locale.US, "%s,%d,%.2f,%.2f,%.2f,%.2f%n",
                    dept,
                    uniqueEmployees,
                    totalEntitled,
                    totalAccrued,
                    totalUsed,
                    totalAvailable
            );
        }
        writer.flush();

        byte[] csvData = sw.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leave_liability_" + year + ".csv\"")
                .body(csvData);
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
