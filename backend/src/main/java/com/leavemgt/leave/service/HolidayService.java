package com.leavemgt.leave.service;

import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

/**
 * Service for computing official Kenyan Public Holidays and determining working days.
 * Based on the Public Holidays Act (Cap. 110 of the Laws of Kenya), gazetted holidays,
 * Easter Sunday (Anonymous Gregorian algorithm), and national observation rules
 * (if a holiday falls on Sunday, the following Monday is an observed public holiday).
 */
@Service
public class HolidayService {

    // Approximate gazetted dates for Islamic holidays in Kenya (based on moonsighting)
    private static final Map<Integer, List<int[]>> ISLAMIC_HOLIDAYS = Map.of(
            2024, List.of(new int[]{4, 11}, new int[]{6, 17}), // Eid al-Fitr, Eid al-Adha
            2025, List.of(new int[]{3, 31}, new int[]{6, 6}),
            2026, List.of(new int[]{3, 20}, new int[]{5, 27}),
            2027, List.of(new int[]{3, 10}, new int[]{5, 17})
    );

    /**
     * Returns true if the given date is a statutory or gazetted public holiday in Kenya.
     */
    public boolean isPublicHoliday(LocalDate date) {
        if (date == null) return false;
        Set<LocalDate> holidays = getHolidaysForYear(date.getYear());
        return holidays.contains(date);
    }

    /**
     * Returns true if the date is a normal working business day (Mon-Fri and NOT a public holiday).
     */
    public boolean isWorkingDay(LocalDate date) {
        if (date == null) return false;
        DayOfWeek dow = date.getDayOfWeek();
        if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
            return false;
        }
        return !isPublicHoliday(date);
    }

    /**
     * Calculates the number of working days between startDate and endDate (inclusive),
     * excluding weekends (Sat/Sun) and all gazetted public holidays.
     */
    public long calculateWorkingDays(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null || startDate.isAfter(endDate)) {
            return 0;
        }

        long workingDays = 0;
        LocalDate curr = startDate;
        while (!curr.isAfter(endDate)) {
            if (isWorkingDay(curr)) {
                workingDays++;
            }
            curr = curr.plusDays(1);
        }
        return workingDays;
    }

    /**
     * Computes all official public holidays for a given year.
     */
    public Set<LocalDate> getHolidaysForYear(int year) {
        Set<LocalDate> holidays = new HashSet<>();

        // 1. Fixed National Holidays
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 1, 1));   // New Year's Day
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 5, 1));   // Labour Day
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 6, 1));   // Madaraka Day
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 10, 10)); // Mazingira Day
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 10, 20)); // Mashujaa Day
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 12, 12)); // Jamhuri Day
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 12, 25)); // Christmas Day
        addHolidayWithSundayRule(holidays, LocalDate.of(year, 12, 26)); // Utamaduni / Boxing Day

        // 2. Easter Holidays (Good Friday and Easter Monday)
        int[] easter = computeEasterSunday(year);
        LocalDate easterSunday = LocalDate.of(year, easter[0], easter[1]);
        holidays.add(easterSunday.minusDays(2)); // Good Friday
        holidays.add(easterSunday.plusDays(1));  // Easter Monday

        // 3. Islamic Holidays (Eid al-Fitr and Eid al-Adha)
        List<int[]> islamicDates = ISLAMIC_HOLIDAYS.get(year);
        if (islamicDates != null) {
            for (int[] date : islamicDates) {
                addHolidayWithSundayRule(holidays, LocalDate.of(year, date[0], date[1]));
            }
        }

        return holidays;
    }

    private void addHolidayWithSundayRule(Set<LocalDate> holidays, LocalDate date) {
        holidays.add(date);
        // Kenyan Public Holidays Act: If a public holiday falls on a Sunday, the succeeding day (Monday) is observed
        if (date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            holidays.add(date.plusDays(1));
        }
    }

    /**
     * Computes Easter Sunday month and day using the Anonymous Gregorian algorithm.
     * Returns int[]{month, day}
     */
    private int[] computeEasterSunday(int year) {
        int a = year % 19;
        int b = year / 100;
        int c = year % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31;
        int day = ((h + l - 7 * m + 114) % 31) + 1;
        return new int[]{month, day};
    }
}
