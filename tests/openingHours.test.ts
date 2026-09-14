import { describe, it, expect } from 'vitest';
import { evaluateOpeningHours, getOpeningBadge, parseWeeklySchedule } from '../src/utils/openingHours';

describe('openingHours utility', () => {
  it('handles null, empty, or undefined as unknown', () => {
    expect(evaluateOpeningHours(null)).toBe('unknown');
    expect(evaluateOpeningHours(undefined)).toBe('unknown');
    expect(evaluateOpeningHours('')).toBe('unknown');
    expect(evaluateOpeningHours('   ')).toBe('unknown');
    expect(evaluateOpeningHours('gibberish random string')).toBe('unknown');
  });

  it('correctly handles 24/7 schedules', () => {
    expect(evaluateOpeningHours('24/7')).toBe('open');
    expect(evaluateOpeningHours('Open 24/7')).toBe('open');
  });

  it('evaluates standard weekday schedules', () => {
    const hours = 'Mo-Fr 08:00-17:00';
    // Wednesday at 10:00 AM (Open)
    const wedOpen = new Date('2026-09-09T10:00:00'); // Wednesday
    expect(evaluateOpeningHours(hours, wedOpen)).toBe('open');

    // Wednesday at 18:30 (Closed)
    const wedClosed = new Date('2026-09-09T18:30:00');
    expect(evaluateOpeningHours(hours, wedClosed)).toBe('closed');

    // Sunday (No rule for Sunday -> closed)
    const sun = new Date('2026-09-13T12:00:00');
    expect(evaluateOpeningHours(hours, sun)).toBe('closed');
  });

  it('evaluates split shift schedules', () => {
    const hours = 'Mo-Fr 11:30-14:30, 17:00-22:00';
    // Thursday at 12:30 PM (lunch shift -> open)
    const thuLunch = new Date('2026-09-10T12:30:00');
    expect(evaluateOpeningHours(hours, thuLunch)).toBe('open');

    // Thursday at 15:30 PM (between shifts -> closed)
    const thuBreak = new Date('2026-09-10T15:30:00');
    expect(evaluateOpeningHours(hours, thuBreak)).toBe('closed');

    // Thursday at 19:00 PM (dinner shift -> open)
    const thuDinner = new Date('2026-09-10T19:00:00');
    expect(evaluateOpeningHours(hours, thuDinner)).toBe('open');
  });

  it('evaluates late-night overnight shifts extending past midnight', () => {
    const hours = 'Fr-Sa 18:00-02:00';
    // Friday at 23:00 (Open)
    const friNight = new Date('2026-09-11T23:00:00');
    expect(evaluateOpeningHours(hours, friNight)).toBe('open');

    // Saturday at 01:15 AM (Open, past midnight shift from Friday)
    const satEarly = new Date('2026-09-12T01:15:00');
    expect(evaluateOpeningHours(hours, satEarly)).toBe('open');

    // Saturday at 03:30 AM (Closed)
    const satLate = new Date('2026-09-12T03:30:00');
    expect(evaluateOpeningHours(hours, satLate)).toBe('closed');
  });

  it('handles explicit off or closed day notations', () => {
    const hours = 'Mo-Sa 10:00-18:00; Su off';
    // Sunday (explicitly off -> closed)
    const sunday = new Date('2026-09-13T12:00:00');
    expect(evaluateOpeningHours(hours, sunday)).toBe('closed');

    // Monday at 12:00 (Open)
    const monday = new Date('2026-09-14T12:00:00');
    expect(evaluateOpeningHours(hours, monday)).toBe('open');
  });

  it('provides formatted badge classes and labels', () => {
    expect(getOpeningBadge('open')).toEqual({ text: 'Open Now', className: 'status-open' });
    expect(getOpeningBadge('closed')).toEqual({ text: 'Closed', className: 'status-closed' });
    expect(getOpeningBadge('unknown')).toEqual({ text: 'Hours Unknown', className: 'status-unknown' });
  });

  describe('parseWeeklySchedule', () => {
    it('returns null for null, empty, or unparseable hours', () => {
      expect(parseWeeklySchedule(null)).toBeNull();
      expect(parseWeeklySchedule(undefined)).toBeNull();
      expect(parseWeeklySchedule('')).toBeNull();
      expect(parseWeeklySchedule('   ')).toBeNull();
      expect(parseWeeklySchedule('completely invalid gibberish')).toBeNull();
    });

    it('parses standard weekday schedules into 7 user-friendly days and bolds current weekday', () => {
      const hours = 'Mo-Fr 08:00-17:00; Sa 10:00-14:00; Su off';
      // Wednesday reference date
      const wednesday = new Date('2026-09-09T10:00:00');
      const schedule = parseWeeklySchedule(hours, wednesday, 'en-US');

      expect(schedule).not.toBeNull();
      expect(schedule!.days).toHaveLength(7);

      // Check order: Monday through Sunday
      const dayNames = schedule!.days.map((d) => d.dayName);
      expect(dayNames).toEqual([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]);

      // Check current weekday bold/today flag
      const todayDay = schedule!.days.find((d) => d.isToday);
      expect(todayDay).toBeDefined();
      expect(todayDay!.dayName).toBe('Wednesday');
      expect(todayDay!.hoursText).toBe('08:00 – 17:00');

      // Check Monday - Friday hours
      for (let i = 0; i < 5; i++) {
        expect(schedule!.days[i].hoursText).toBe('08:00 – 17:00');
      }

      // Check Saturday hours
      expect(schedule!.days[5].hoursText).toBe('10:00 – 14:00');

      // Check Sunday closed
      expect(schedule!.days[6].hoursText).toBe('Closed');
    });

    it('parses 24/7 schedules with Open 24 hours on all 7 days', () => {
      const schedule = parseWeeklySchedule('24/7', new Date('2026-09-11T14:00:00'), 'en-US');
      expect(schedule).not.toBeNull();
      expect(schedule!.days).toHaveLength(7);
      schedule!.days.forEach((day) => {
        expect(day.hoursText).toBe('Open 24 hours');
      });
    });

    it('parses split-shift schedules with comma-separated daily intervals', () => {
      const hours = 'Mo-Fr 11:30-14:30, 17:00-22:00; Sa 12:00-23:00';
      const thursday = new Date('2026-09-10T12:00:00');
      const schedule = parseWeeklySchedule(hours, thursday, 'en-US');

      expect(schedule).not.toBeNull();
      // Thursday (index 3)
      expect(schedule!.days[3].dayName).toBe('Thursday');
      expect(schedule!.days[3].isToday).toBe(true);
      expect(schedule!.days[3].hoursText).toBe('11:30 – 14:30, 17:00 – 22:00');

      // Saturday (index 5)
      expect(schedule!.days[5].dayName).toBe('Saturday');
      expect(schedule!.days[5].hoursText).toBe('12:00 – 23:00');

      // Sunday (index 6)
      expect(schedule!.days[6].dayName).toBe('Sunday');
      expect(schedule!.days[6].hoursText).toBe('Closed');
    });

    it('formats localized weekday names according to specified locale', () => {
      const hours = 'Mo-Su 09:00-18:00';
      const ref = new Date('2026-09-11T12:00:00'); // Friday
      const scheduleFr = parseWeeklySchedule(hours, ref, 'fr-FR');
      expect(scheduleFr).not.toBeNull();

      // In French: lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche
      const namesFr = scheduleFr!.days.map((d) => d.dayName.toLowerCase());
      expect(namesFr).toContain('vendredi');
      expect(namesFr[4]).toBe('vendredi');
      expect(scheduleFr!.days[4].isToday).toBe(true);
    });
  });
});
