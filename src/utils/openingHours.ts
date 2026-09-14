/**
 * Opening hours evaluator and weekly schedule parser for ConferenceWalker.
 * Uses opening_hours.js with robust fallback evaluation to parse standard
 * OpenStreetMap opening_hours syntax, evaluate whether a venue is currently Open,
 * Closed, or Unknown, and extract user-friendly localized daily schedules.
 */

import opening_hours from 'opening_hours';
import { OpeningStatus } from '../types/poi';

export interface DayScheduleItem {
  dayName: string; // e.g. "Monday" (current locale-specific full weekday name)
  shortDayName: string; // e.g. "Mon"
  hoursText: string; // e.g. "08:00 – 17:00", "Closed", or "Open 24 hours"
  isToday: boolean;
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export interface WeeklySchedule {
  days: DayScheduleItem[];
  rawText: string;
}

// Day mapping matching OSM conventions: Mo, Tu, We, Th, Fr, Sa, Su
const OSM_DAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const;
const DAY_ORDER: Record<string, number> = {
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
  su: 0,
};

interface TimeRange {
  startMinutes: number; // minutes from midnight (0 - 1440)
  endMinutes: number;   // minutes from midnight (0 - 1440 or >1440 for past midnight)
}

interface DaySchedule {
  days: Set<number>; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  ranges: TimeRange[];
  isOff: boolean;
}

/**
 * Parses time string "HH:MM" into minutes from midnight (0 - 1439).
 */
function parseTimeString(timeStr: string): number | null {
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Expands a day token like "Mo-Fr", "Mo,We,Fr", or "Sa" into a set of day numbers (0-6).
 */
function parseDayTokens(daysStr: string): Set<number> | null {
  const result = new Set<number>();
  const daySegments = daysStr.split(',');

  for (const seg of daySegments) {
    const trimmed = seg.trim().toLowerCase();
    if (trimmed.includes('-')) {
      const [startDayStr, endDayStr] = trimmed.split('-');
      if (!(startDayStr in DAY_ORDER) || !(endDayStr in DAY_ORDER)) {
        return null;
      }
      let current = DAY_ORDER[startDayStr];
      const target = DAY_ORDER[endDayStr];

      // Walk through cyclic days from start to target
      while (true) {
        result.add(current);
        if (current === target) break;
        current = (current + 1) % 7;
      }
    } else {
      if (!(trimmed in DAY_ORDER)) {
        return null;
      }
      result.add(DAY_ORDER[trimmed]);
    }
  }

  return result.size > 0 ? result : null;
}

/**
 * Evaluates whether a venue is Open, Closed, or Unknown based on its OSM opening_hours tag.
 *
 * @param openingHoursStr Raw opening_hours string from OSM tags (e.g. "Mo-Su 07:00-22:00")
 * @param now Current client date or mock date for evaluation
 */
export function evaluateOpeningHours(
  openingHoursStr: string | null | undefined,
  now: Date = new Date()
): OpeningStatus {
  if (!openingHoursStr || typeof openingHoursStr !== 'string') {
    return 'unknown';
  }

  const raw = openingHoursStr.trim();
  if (!raw) return 'unknown';

  // 1. 24/7 is always open
  if (raw === '24/7' || raw.toLowerCase() === 'open 24/7') {
    return 'open';
  }

  // 2. Closed / Off directly
  if (raw.toLowerCase() === 'closed' || raw.toLowerCase() === 'off') {
    return 'closed';
  }

  // 3. Try parsing with opening_hours.js
  try {
    const oh = new opening_hours(raw);
    const state = oh.getStateString(now);
    if (state === 'open') return 'open';
    if (state === 'close' || (state as string) === 'closed') return 'closed';
    if (state === 'unknown') return 'unknown';
  } catch {
    // Continue to custom parser fallback if opening_hours.js threw syntax exception
  }

  const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Split multiple day rules separated by semicolon
  const ruleBlocks = raw.split(';').map((s) => s.trim()).filter(Boolean);
  if (ruleBlocks.length === 0) return 'unknown';

  const daySchedules: DaySchedule[] = [];
  let parsedAny = false;

  for (const block of ruleBlocks) {
    // Check for "off" notation, e.g. "Su off" or "Su closed"
    const isOffRule = /\b(off|closed)\b/i.test(block);

    // Regex matching day specifiers followed by time ranges or off
    // Examples: "Mo-Fr 08:00-17:00", "Sa,Su 10:00-14:00, 16:00-20:00", "09:00-18:00"
    const match = block.match(/^([a-z,\-\s]+)?\s*([0-9:,\s\-]+|off|closed)$/i);
    if (!match) continue;

    const daysPart = match[1]?.trim();
    const timePart = match[2]?.trim();

    let applicableDays: Set<number> | null = null;
    if (daysPart) {
      applicableDays = parseDayTokens(daysPart);
    } else {
      // If no day specified, applies to all days
      applicableDays = new Set([0, 1, 2, 3, 4, 5, 6]);
    }

    if (!applicableDays) continue;

    if (isOffRule) {
      daySchedules.push({
        days: applicableDays,
        ranges: [],
        isOff: true,
      });
      parsedAny = true;
      continue;
    }

    // Parse comma-separated time ranges, e.g. "11:30-14:30, 17:00-22:00"
    const rangeTokens = timePart.split(',');
    const ranges: TimeRange[] = [];

    for (const rt of rangeTokens) {
      const parts = rt.trim().split('-');
      if (parts.length !== 2) continue;
      const startMin = parseTimeString(parts[0]);
      let endMin = parseTimeString(parts[1]);

      if (startMin !== null && endMin !== null) {
        // If end time is before start time (e.g. 18:00-02:00 past midnight)
        if (endMin < startMin) {
          endMin += 1440;
        }
        ranges.push({ startMinutes: startMin, endMinutes: endMin });
      }
    }

    if (ranges.length > 0) {
      daySchedules.push({
        days: applicableDays,
        ranges,
        isOff: false,
      });
      parsedAny = true;
    }
  }

  if (!parsedAny) {
    return 'unknown';
  }

  // Check matching schedule for today
  for (const sched of daySchedules) {
    if (sched.days.has(currentDay)) {
      if (sched.isOff) {
        return 'closed';
      }
      for (const range of sched.ranges) {
        if (currentMinutes >= range.startMinutes && currentMinutes <= range.endMinutes) {
          return 'open';
        }
      }
    }
  }

  // Also check yesterday's late-night shifts that extend past midnight (endMinutes > 1440)
  const previousDay = (currentDay + 6) % 7;
  for (const sched of daySchedules) {
    if (sched.days.has(previousDay)) {
      for (const range of sched.ranges) {
        if (range.endMinutes > 1440) {
          const pastMidnightEnd = range.endMinutes - 1440;
          if (currentMinutes <= pastMidnightEnd) {
            return 'open';
          }
        }
      }
    }
  }

  // If valid schedules were parsed, any time outside scheduled operating hours is closed
  return 'closed';
}

/**
 * Returns human-readable badge text and CSS class name for opening status.
 */
export function getOpeningBadge(status: OpeningStatus): { text: string; className: string } {
  switch (status) {
    case 'open':
      return { text: 'Open Now', className: 'status-open' };
    case 'closed':
      return { text: 'Closed', className: 'status-closed' };
    case 'unknown':
    default:
      return { text: 'Hours Unknown', className: 'status-unknown' };
  }
}

/**
 * Formats a single time range interval into user-friendly "HH:MM – HH:MM".
 */
function formatIntervalText(start: Date, end: Date, dayStart: Date, dayEnd: Date): string {
  const sH = String(start.getHours()).padStart(2, '0');
  const sM = String(start.getMinutes()).padStart(2, '0');

  let eH = String(end.getHours()).padStart(2, '0');
  let eM = String(end.getMinutes()).padStart(2, '0');

  // If the interval extends up to the end of the day / next midnight (00:00 of next day)
  if (
    end.getTime() === dayEnd.getTime() ||
    (end.getHours() === 0 && end.getMinutes() === 0 && start.getTime() !== end.getTime())
  ) {
    eH = '24';
    eM = '00';
  }

  return `${sH}:${sM} \u2013 ${eH}:${eM}`;
}

/**
 * Parses an OSM opening_hours string into a 7-day user-friendly weekly schedule
 * using opening_hours.js. Formats weekday names according to the current locale
 * and identifies the current weekday for bold highlighting.
 *
 * Returns null if the opening_hours string cannot be parsed.
 *
 * @param openingHoursStr Raw opening_hours string from OSM tags (e.g. "Mo-Fr 08:00-17:00; Sa 10:00-14:00; Su off")
 * @param now Current client date or mock date for evaluation
 * @param locale Optional BCP 47 locale tag (e.g. "en-US", defaults to user/browser locale)
 */
export function parseWeeklySchedule(
  openingHoursStr: string | null | undefined,
  now: Date = new Date(),
  locale?: string
): WeeklySchedule | null {
  if (!openingHoursStr || typeof openingHoursStr !== 'string') {
    return null;
  }

  const raw = openingHoursStr.trim();
  if (!raw) return null;

  try {
    const oh = new opening_hours(raw);

    // Calculate Monday of the reference week containing now
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);

    const days: DayScheduleItem[] = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 0, 0, 0, 0);
      const dayEnd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i + 1, 0, 0, 0, 0);

      const isToday =
        dayStart.getFullYear() === now.getFullYear() &&
        dayStart.getMonth() === now.getMonth() &&
        dayStart.getDate() === now.getDate();

      const dayName = dayStart.toLocaleDateString(locale, { weekday: 'long' });
      const shortDayName = dayStart.toLocaleDateString(locale, { weekday: 'short' });
      const dayIndex = dayStart.getDay();

      const intervals = oh.getOpenIntervals(dayStart, dayEnd);

      let hoursText: string;
      if (intervals.length === 0) {
        hoursText = 'Closed';
      } else if (
        intervals.length === 1 &&
        intervals[0][0].getTime() <= dayStart.getTime() &&
        intervals[0][1].getTime() >= dayEnd.getTime()
      ) {
        hoursText = 'Open 24 hours';
      } else {
        hoursText = intervals
          .map(([s, e]) => formatIntervalText(s, e, dayStart, dayEnd))
          .join(', ');
      }

      days.push({
        dayName,
        shortDayName,
        hoursText,
        isToday,
        dayIndex,
      });
    }

    return {
      days,
      rawText: raw,
    };
  } catch {
    return null;
  }
}
