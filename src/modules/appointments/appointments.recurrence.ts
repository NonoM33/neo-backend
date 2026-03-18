import type { RecurrenceRule } from '../../db/schema/appointments';
import type { DayOfWeek } from './appointments.schema';

const DAY_OF_WEEK_MAP: Record<DayOfWeek, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 0,
};

/**
 * Expand a recurrence rule into a list of dates starting from startDate.
 * Limits expansion to maxMonths (default 6) into the future.
 *
 * @param rule The recurrence rule
 * @param startDate The date of the first occurrence
 * @param maxMonths Maximum months to expand ahead (default 6)
 * @returns Array of occurrence dates
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  startDate: Date,
  maxMonths: number = 6
): Date[] {
  const dates: Date[] = [];
  const maxDate = new Date(startDate);
  maxDate.setMonth(maxDate.getMonth() + maxMonths);

  // If rule has endDate, use the earlier of endDate and maxDate
  const effectiveEndDate =
    rule.endDate && rule.endDate < maxDate ? rule.endDate : maxDate;

  const maxOccurrences = rule.maxOccurrences ?? Infinity;
  const interval = rule.interval ?? 1;
  const daysOfWeek = (rule.daysOfWeek as DayOfWeek[] | null) ?? [];

  let current = new Date(startDate);

  switch (rule.frequency) {
    case 'quotidien': {
      while (current <= effectiveEndDate && dates.length < maxOccurrences) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + interval);
      }
      break;
    }

    case 'hebdomadaire': {
      if (daysOfWeek.length > 0) {
        // Generate for specific days of the week
        const targetDays = daysOfWeek.map((d) => DAY_OF_WEEK_MAP[d]);

        // Start from the beginning of the week containing startDate
        const weekStart = new Date(current);
        const currentDay = weekStart.getDay(); // 0=Sun
        // Move to Monday of the current week
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
        weekStart.setDate(weekStart.getDate() + mondayOffset);

        let weekCurrent = new Date(weekStart);

        while (weekCurrent <= effectiveEndDate && dates.length < maxOccurrences) {
          // Check each target day in this week
          for (const targetDay of targetDays) {
            const candidate = new Date(weekCurrent);
            // Calculate offset from Monday (day 1) to target day
            const dayOffset = targetDay === 0 ? 6 : targetDay - 1;
            candidate.setDate(weekCurrent.getDate() + dayOffset);
            // Preserve the time from startDate
            candidate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), startDate.getMilliseconds());

            if (candidate >= startDate && candidate <= effectiveEndDate && dates.length < maxOccurrences) {
              dates.push(new Date(candidate));
            }
          }
          // Move to next interval week
          weekCurrent.setDate(weekCurrent.getDate() + 7 * interval);
        }
      } else {
        // No specific days - repeat on the same day of the week
        while (current <= effectiveEndDate && dates.length < maxOccurrences) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 7 * interval);
        }
      }
      break;
    }

    case 'bi_hebdomadaire': {
      // Every 2 weeks (or 2*interval weeks)
      const biWeekInterval = 2 * interval;
      if (daysOfWeek.length > 0) {
        const targetDays = daysOfWeek.map((d) => DAY_OF_WEEK_MAP[d]);
        const weekStart = new Date(current);
        const currentDay = weekStart.getDay();
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
        weekStart.setDate(weekStart.getDate() + mondayOffset);

        let weekCurrent = new Date(weekStart);

        while (weekCurrent <= effectiveEndDate && dates.length < maxOccurrences) {
          for (const targetDay of targetDays) {
            const candidate = new Date(weekCurrent);
            const dayOffset = targetDay === 0 ? 6 : targetDay - 1;
            candidate.setDate(weekCurrent.getDate() + dayOffset);
            candidate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), startDate.getMilliseconds());

            if (candidate >= startDate && candidate <= effectiveEndDate && dates.length < maxOccurrences) {
              dates.push(new Date(candidate));
            }
          }
          weekCurrent.setDate(weekCurrent.getDate() + 7 * biWeekInterval);
        }
      } else {
        while (current <= effectiveEndDate && dates.length < maxOccurrences) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 14 * interval);
        }
      }
      break;
    }

    case 'mensuel': {
      while (current <= effectiveEndDate && dates.length < maxOccurrences) {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + interval);
      }
      break;
    }
  }

  // Sort chronologically
  dates.sort((a, b) => a.getTime() - b.getTime());

  return dates;
}
