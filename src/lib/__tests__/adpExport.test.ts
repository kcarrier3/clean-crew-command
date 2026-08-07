import { describe, it, expect } from 'vitest';
import { buildAdpRows, workweekKey, DEFAULT_SETTINGS } from '../adpExport';

const profile = {
  id: 'e1', first_name: 'Ann', last_name: 'Lee', employee_id: 'CC1',
  adp_file_number: '1001', adp_department_code: 'D1', hourly_rate: 20,
};
const site = (id: string, name: string, city: string) => ({
  id, name, city, state: 'OH', tax_jurisdiction: city, job_cost_code: id, location_code: id,
});
// 10-hour punch on a given local date at a given job
const punch = (date: string, jobId: string) => ({
  employee_id: 'e1', job_site_id: jobId,
  clock_in: `${date}T08:00:00`, clock_out: `${date}T18:00:00`, break_minutes: 0,
});

describe('workweekKey', () => {
  it('maps a Sunday–Saturday week to its Sunday', () => {
    expect(workweekKey('2026-08-02')).toBe('2026-08-02'); // Sunday
    expect(workweekKey('2026-08-08')).toBe('2026-08-02'); // Saturday
    expect(workweekKey('2026-08-09')).toBe('2026-08-09'); // next Sunday
  });
});

describe('buildAdpRows overtime', () => {
  const sites = [site('j1', 'Job One', 'Akron'), site('j2', 'Job Two', 'Canton')];

  it('resets the 40-hour threshold each Sunday–Saturday workweek', () => {
    // Week 1: Sun 8/2 .. Thu 8/6 = 5 x 10h = 50h -> 40 REG + 10 OT
    // Week 2: Sun 8/9 .. Thu 8/13 = 5 x 10h = 50h -> 40 REG + 10 OT
    const dates = ['2026-08-02','2026-08-03','2026-08-04','2026-08-05','2026-08-06',
                   '2026-08-09','2026-08-10','2026-08-11','2026-08-12','2026-08-13'];
    const rows = buildAdpRows(dates.map(d => punch(d, 'j1')), [profile], sites, DEFAULT_SETTINGS);
    const sum = (code: string) => rows.filter(r => r.earnings_code === code)
      .reduce((s, r) => s + r.total_hours, 0);
    expect(sum(DEFAULT_SETTINGS.regular_code)).toBe(80);
    expect(sum(DEFAULT_SETTINGS.overtime_code)).toBe(20);
  });

  it('keeps separate rows per day/job and preserves municipality attribution', () => {
    const rows = buildAdpRows(
      [punch('2026-08-03', 'j1'), punch('2026-08-03', 'j2')],
      [profile], sites, DEFAULT_SETTINGS
    );
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.city).sort()).toEqual(['Akron', 'Canton']);
    expect(rows.every(r => r.work_date === '2026-08-03')).toBe(true);
  });
});
