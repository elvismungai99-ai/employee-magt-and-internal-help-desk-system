package com.leavemgt.leave.service;

import com.leavemgt.leave.entity.LeaveRequest;
import com.leavemgt.leave.entity.LeaveRequestStatus;
import com.leavemgt.leave.repository.LeaveRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CalendarService {

    private final LeaveRequestRepository leaveRequestRepository;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Transactional(readOnly = true)
    public String generateIcsForUser(UUID userId) {
        List<LeaveRequest> approvedLeaves = leaveRequestRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(r -> r.getStatus() == LeaveRequestStatus.APPROVED)
                .toList();

        return buildIcsContent("My Approved Leaves", approvedLeaves);
    }

    @Transactional(readOnly = true)
    public String generateIcsForDepartment(UUID departmentId) {
        List<LeaveRequest> allRequests = leaveRequestRepository.findAllByOrderByCreatedAtDesc();
        List<LeaveRequest> departmentApproved = allRequests.stream()
                .filter(r -> r.getStatus() == LeaveRequestStatus.APPROVED)
                .filter(r -> r.getUser() != null && r.getUser().getDepartment() != null &&
                             r.getUser().getDepartment().getId().equals(departmentId))
                .toList();

        return buildIcsContent("Department Team Leaves", departmentApproved);
    }

    private String buildIcsContent(String calendarName, List<LeaveRequest> leaves) {
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\n");
        sb.append("VERSION:2.0\r\n");
        sb.append("PRODID:-//LeaveMgt//Leave Management System//EN\r\n");
        sb.append("CALSCALE:GREGORIAN\r\n");
        sb.append("METHOD:PUBLISH\r\n");
        sb.append("X-WR-CALNAME:").append(calendarName).append("\r\n");

        for (LeaveRequest req : leaves) {
            if (req.getStartDate() == null || req.getEndDate() == null) continue;

            String employeeName = req.getUser() != null ? req.getUser().getFullName() : "Employee";
            String leaveType = req.getLeaveType() != null ? req.getLeaveType().getName() : "Leave";
            String domain = "leavemgt.local";
            if (req.getUser() != null && req.getUser().getEmail() != null && req.getUser().getEmail().contains("@")) {
                domain = req.getUser().getEmail().substring(req.getUser().getEmail().indexOf('@') + 1);
            }
            String uid = "leave-" + req.getId() + "@" + domain;
            
            // In iCalendar, DTEND for full-day events is exclusive, so add 1 day to end date
            LocalDate startDate = req.getStartDate();
            LocalDate endDateExclusive = req.getEndDate().plusDays(1);

            sb.append("BEGIN:VEVENT\r\n");
            sb.append("UID:").append(uid).append("\r\n");
            sb.append("DTSTAMP:").append(DATE_FORMATTER.format(LocalDate.now())).append("T000000Z\r\n");
            sb.append("DTSTART;VALUE=DATE:").append(DATE_FORMATTER.format(startDate)).append("\r\n");
            sb.append("DTEND;VALUE=DATE:").append(DATE_FORMATTER.format(endDateExclusive)).append("\r\n");
            sb.append("SUMMARY:").append(escapeIcs(leaveType + " - " + employeeName)).append("\r\n");
            sb.append("DESCRIPTION:").append(escapeIcs("Approved " + leaveType + " (" + req.getTotalDays() + " days). Reason: " + (req.getReason() != null ? req.getReason() : "None"))).append("\r\n");
            sb.append("STATUS:CONFIRMED\r\n");
            sb.append("TRANSP:OPAQUE\r\n");
            sb.append("END:VEVENT\r\n");
        }

        sb.append("END:VCALENDAR\r\n");
        return sb.toString();
    }

    private String escapeIcs(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                   .replace(";", "\\;")
                   .replace(",", "\\,")
                   .replace("\n", "\\n")
                   .replace("\r", "");
    }
}
