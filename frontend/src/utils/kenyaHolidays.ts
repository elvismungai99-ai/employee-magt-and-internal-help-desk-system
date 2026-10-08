/**
 * Official Kenyan Public Holidays Utility
 * Based on the Public Holidays Act (Cap. 110 of the Laws of Kenya)
 * and gazetted national holidays.
 */

export interface KenyanHoliday {
  date: string; // YYYY-MM-DD
  day: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  year: number;
  name: string;
  isObserved?: boolean; // When holiday falls on Sunday and is observed on Monday
}

// Computes Easter Sunday for a given year using the Anonymous Gregorian algorithm
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed: 2 = March, 3 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Approximate gazetted dates for Islamic holidays in Kenya (based on moonsighting / Chief Kadhi declarations)
const ISLAMIC_HOLIDAYS_KENYA: Record<number, { eidAlFitr: [number, number]; eidAlAdha: [number, number] }> = {
  2024: { eidAlFitr: [3, 11], eidAlAdha: [5, 17] }, // April 11, June 17
  2025: { eidAlFitr: [2, 31], eidAlAdha: [5, 6] },  // March 31, June 6
  2026: { eidAlFitr: [2, 20], eidAlAdha: [4, 27] }, // March 20, May 27
  2027: { eidAlFitr: [2, 10], eidAlAdha: [4, 17] }, // March 10, May 17
};

/**
 * Returns all statutory Kenyan public holidays for a specific year,
 * including observed Mondays when a holiday falls on a Sunday.
 */
export function getKenyanHolidaysForYear(year: number): KenyanHoliday[] {
  const holidays: KenyanHoliday[] = [];

  const addHoliday = (month: number, day: number, name: string) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    holidays.push({
      date: dateStr,
      day,
      month,
      year,
      name,
    });

    // Kenyan Sunday rule: If a statutory holiday falls on Sunday, the next day (Monday) is an observed public holiday
    const dateObj = new Date(year, month, day);
    if (dateObj.getDay() === 0) {
      const nextDay = new Date(year, month, day + 1);
      const nextDateStr = `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}`;
      holidays.push({
        date: nextDateStr,
        day: nextDay.getDate(),
        month: nextDay.getMonth(),
        year: nextDay.getFullYear(),
        name: `${name} (Observed)`,
        isObserved: true,
      });
    }
  };

  // Fixed National Holidays in Kenya
  addHoliday(0, 1, "New Year's Day");
  addHoliday(4, 1, 'Labour Day');
  addHoliday(5, 1, 'Madaraka Day');
  addHoliday(9, 10, 'Mazingira Day'); // Formerly Moi Day / Utamaduni Day, gazetted Mazingira Day
  addHoliday(9, 20, 'Mashujaa Day'); // Heroes' Day
  addHoliday(11, 12, 'Jamhuri Day'); // Independence & Republic Day
  addHoliday(11, 25, 'Christmas Day');
  addHoliday(11, 26, 'Utamaduni Day / Boxing Day');

  // Easter Holidays
  const easter = getEasterSunday(year);
  const easterDate = new Date(year, easter.month, easter.day);

  // Good Friday (2 days before Easter Sunday)
  const goodFriday = new Date(easterDate);
  goodFriday.setDate(easterDate.getDate() - 2);
  addHoliday(goodFriday.getMonth(), goodFriday.getDate(), 'Good Friday');

  // Easter Monday (1 day after Easter Sunday)
  const easterMonday = new Date(easterDate);
  easterMonday.setDate(easterDate.getDate() + 1);
  addHoliday(easterMonday.getMonth(), easterMonday.getDate(), 'Easter Monday');

  // Gazetted Islamic Holidays
  if (ISLAMIC_HOLIDAYS_KENYA[year]) {
    const { eidAlFitr, eidAlAdha } = ISLAMIC_HOLIDAYS_KENYA[year];
    addHoliday(eidAlFitr[0], eidAlFitr[1], 'Eid al-Fitr');
    addHoliday(eidAlAdha[0], eidAlAdha[1], 'Eid al-Adha');
  }

  return holidays;
}

/**
 * Check if a given date string (YYYY-MM-DD) or Date object is a Kenyan public holiday.
 */
export function isKenyanPublicHoliday(target: string | Date): { isHoliday: boolean; holidayName?: string } {
  let dateStr: string;
  let year: number;

  if (typeof target === 'string') {
    dateStr = target;
    year = parseInt(target.slice(0, 4), 10);
  } else {
    const pad = (n: number) => n.toString().padStart(2, '0');
    year = target.getFullYear();
    dateStr = `${year}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  }

  if (isNaN(year)) return { isHoliday: false };

  const holidays = getKenyanHolidaysForYear(year);
  const match = holidays.find((h) => h.date === dateStr);

  if (match) {
    return { isHoliday: true, holidayName: match.name };
  }
  return { isHoliday: false };
}

/**
 * Calculate working days in Kenya between two dates (inclusive),
 * excluding Saturdays (day 6), Sundays (day 0), and Kenyan gazetted public holidays.
 */
export function calculateKenyanWorkingDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  const [eY, eM, eD] = endDateStr.split('-').map(Number);
  if (!sY || !eY) return 0;

  const start = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);
  if (start > end) return 0;

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend) {
      const { isHoliday } = isKenyanPublicHoliday(current);
      if (!isHoliday) {
        workingDays++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}
