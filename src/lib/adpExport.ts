/**
 * ADP Workforce Now payroll CSV export.
 *
 * Crew Compass stores punches in `time_entries` (employee + job site + clock in/out).
 * This module turns a pay-period range into one CSV row per
 * employee / work date / job site / earnings code combination so that multiple
 * jobs (and therefore multiple municipalities) worked in a single day stay
 * separate for local tax reporting.
 *
 * The exact ADP Workforce Now import layout varies per account, so the column
 * set + headers are data-driven (see `adp_export_settings`) rather than hard coded.
 */

export type AdpFieldKey =
  | 'adp_file_number'
  | 'crew_compass_employee_code'
  | 'employee_name'
  | 'work_date'
  | 'earnings_code'
  | 'regular_hours'
  | 'overtime_hours'
  | 'total_hours'
  | 'hourly_rate'
  | 'job_name'
  | 'job_cost_code'
  | 'city'
  | 'state'
  | 'tax_jurisdiction'
  | 'location_code'
  | 'department_code';

export interface AdpColumnConfig {
  key: AdpFieldKey;
  header: string;
  enabled: boolean;
}

export interface AdpExportSettings {
  columns: AdpColumnConfig[];
  regular_code: string;
  overtime_code: string;
  date_format: 'MM/DD/YYYY' | 'YYYY-MM-DD';
}

/** Fields ADP cannot match a payroll line without. */
export const REQUIRED_FIELDS: AdpFieldKey[] = ['adp_file_number', 'work_date', 'total_hours'];

export const FIELD_LABELS: Record<AdpFieldKey, string> = {
  adp_file_number: 'ADP file number',
  crew_compass_employee_code: 'Crew Compass employee ID',
  employee_name: 'Employee name',
  work_date: 'Work date',
  earnings_code: 'Earnings code',
  regular_hours: 'Regular hours',
  overtime_hours: 'Overtime hours',
  total_hours: 'Total hours',
  hourly_rate: 'Hourly rate',
  job_name: 'Job / project',
  job_cost_code: 'Job cost code',
  city: 'City',
  state: 'State',
  tax_jurisdiction: 'Tax jurisdiction',
  location_code: 'Location code',
  department_code: 'Department / cost center',
};

export const DEFAULT_COLUMNS: AdpColumnConfig[] = [
  { key: 'adp_file_number', header: 'File Number', enabled: true },
  { key: 'crew_compass_employee_code', header: 'Employee ID', enabled: true },
  { key: 'employee_name', header: 'Employee Name', enabled: true },
  { key: 'work_date', header: 'Pay Date', enabled: true },
  { key: 'earnings_code', header: 'Earnings Code', enabled: true },
  { key: 'regular_hours', header: 'Regular Hours', enabled: true },
  { key: 'overtime_hours', header: 'Overtime Hours', enabled: true },
  { key: 'total_hours', header: 'Total Hours', enabled: true },
  { key: 'hourly_rate', header: 'Rate', enabled: false },
  { key: 'job_name', header: 'Job', enabled: true },
  { key: 'job_cost_code', header: 'Job Cost Code', enabled: true },
  { key: 'city', header: 'City', enabled: true },
  { key: 'state', header: 'State', enabled: true },
  { key: 'tax_jurisdiction', header: 'Tax Jurisdiction', enabled: true },
  { key: 'location_code', header: 'Location Code', enabled: true },
  { key: 'department_code', header: 'Department', enabled: true },
];

export const DEFAULT_SETTINGS: AdpExportSettings = {
  columns: DEFAULT_COLUMNS,
  regular_code: 'REG',
  overtime_code: 'OT',
  date_format: 'MM/DD/YYYY',
};

export interface AdpExportRow {
  employee_id: string;
  crew_compass_employee_code: string;
  adp_file_number: string;
  employee_name: string;
  /** ISO yyyy-mm-dd */
  work_date: string;
  earnings_code: string;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  hourly_rate: number | null;
  job_site_id: string | null;
  job_name: string;
  job_cost_code: string;
  city: string;
  state: string;
  tax_jurisdiction: string;
  location_code: string;
  department_code: string;
}

export interface ValidationIssue {
  rowIndex: number;
  employee_name: string;
  work_date: string;
  field: AdpFieldKey;
  severity: 'error' | 'warning';
  message: string;
}

/** Merge stored settings with defaults so new fields appear automatically. */
export function normalizeSettings(raw: Partial<AdpExportSettings> | null | undefined): AdpExportSettings {
  const stored = Array.isArray(raw?.columns) ? (raw!.columns as AdpColumnConfig[]) : [];
  const columns = DEFAULT_COLUMNS.map((def) => {
    const found = stored.find((c) => c?.key === def.key);
    return found
      ? { key: def.key, header: found.header?.trim() || def.header, enabled: found.enabled !== false }
      : { ...def };
  });
  return {
    columns,
    regular_code: raw?.regular_code?.trim() || DEFAULT_SETTINGS.regular_code,
    overtime_code: raw?.overtime_code?.trim() || DEFAULT_SETTINGS.overtime_code,
    date_format: raw?.date_format === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'MM/DD/YYYY',
  };
}

export function formatWorkDate(iso: string, format: AdpExportSettings['date_format']): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return format === 'YYYY-MM-DD' ? `${y}-${m}-${d}` : `${m}/${d}/${y}`;
}

export const formatHours = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

function cellValue(row: AdpExportRow, key: AdpFieldKey, settings: AdpExportSettings): string {
  switch (key) {
    case 'work_date':
      return formatWorkDate(row.work_date, settings.date_format);
    case 'regular_hours':
      return formatHours(row.regular_hours);
    case 'overtime_hours':
      return formatHours(row.overtime_hours);
    case 'total_hours':
      return formatHours(row.total_hours);
    case 'hourly_rate':
      return row.hourly_rate == null ? '' : row.hourly_rate.toFixed(2);
    default:
      return String(row[key] ?? '');
  }
}

/** RFC 4180 escaping. */
export function escapeCsv(value: string): string {
  const v = value ?? '';
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildAdpCsv(rows: AdpExportRow[], settings: AdpExportSettings): string {
  const cols = settings.columns.filter((c) => c.enabled);
  const lines = [cols.map((c) => escapeCsv(c.header)).join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsv(cellValue(row, c.key, settings))).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, csv: string) {
  // BOM keeps Excel/ADP happy with UTF-8 content.
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateRows(rows: AdpExportRow[], settings: AdpExportSettings): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const enabled = new Set(settings.columns.filter((c) => c.enabled).map((c) => c.key));

  rows.forEach((row, i) => {
    const base = { rowIndex: i, employee_name: row.employee_name, work_date: row.work_date };

    if (!row.adp_file_number) {
      issues.push({ ...base, field: 'adp_file_number', severity: 'error', message: 'Missing ADP file number — set it on the employee profile.' });
    }
    if (!row.work_date) {
      issues.push({ ...base, field: 'work_date', severity: 'error', message: 'Missing work date.' });
    }
    if (!(row.total_hours > 0)) {
      issues.push({ ...base, field: 'total_hours', severity: 'error', message: 'Total hours must be greater than zero.' });
    }
    if (enabled.has('job_name') && !row.job_name) {
      issues.push({ ...base, field: 'job_name', severity: 'warning', message: 'Punch has no job/project assigned.' });
    }
    if (enabled.has('city') && !row.city) {
      issues.push({ ...base, field: 'city', severity: 'warning', message: 'Job has no city set — local tax may be misreported.' });
    }
    if (enabled.has('tax_jurisdiction') && !row.tax_jurisdiction) {
      issues.push({ ...base, field: 'tax_jurisdiction', severity: 'warning', message: 'Job has no tax jurisdiction set.' });
    }
    if (enabled.has('job_cost_code') && !row.job_cost_code) {
      issues.push({ ...base, field: 'job_cost_code', severity: 'warning', message: 'Job has no job cost code.' });
    }
    if (enabled.has('department_code') && !row.department_code) {
      issues.push({ ...base, field: 'department_code', severity: 'warning', message: 'Employee has no ADP department/cost center.' });
    }
  });

  return issues;
}

interface RawEntry {
  employee_id: string;
  job_site_id: string | null;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number | null;
}

interface RawProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  employee_id: string | null;
  adp_file_number: string | null;
  adp_department_code: string | null;
  hourly_rate: number | null;
}

interface RawJobSite {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  tax_jurisdiction: string | null;
  job_cost_code: string | null;
  location_code: string | null;
}

const localDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Sunday-start workweek key (`yyyy-mm-dd` of that Sunday) for an ISO date key.
 * Crew Compass pay periods run Sunday through Saturday, so the 40-hour
 * regular/overtime threshold resets on each Sunday.
 */
export function workweekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - dt.getDay()); // back up to Sunday
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Build export rows.
 *
 * Overtime: the 40-hour threshold is applied per Sunday–Saturday workweek and
 * resets at the start of every week, so a custom range spanning multiple weeks
 * never carries overtime across a week boundary. Within a week, hours beyond 40
 * are attributed to the latest punches (chronological order), which keeps daily
 * job/municipality detail intact and matches the weekly OT rule used by the
 * standard payroll report. A day/job that spans the threshold produces two rows
 * (REG + OT).
 */
export function buildAdpRows(
  entries: RawEntry[],
  profiles: RawProfile[],
  jobSites: RawJobSite[],
  settings: AdpExportSettings
): AdpExportRow[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const siteById = new Map(jobSites.map((s) => [s.id, s]));
  interface Bucket { date: string; week: string; jobId: string | null; hours: number }
  const byEmployee = new Map<string, Bucket[]>();

  for (const e of entries) {
    if (!e.clock_out) continue;
    const hours =
      (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000 -
      (e.break_minutes || 0) / 60;
    if (!(hours > 0)) continue;
    const date = localDateKey(e.clock_in);
    const list = byEmployee.get(e.employee_id) || [];
    const existing = list.find((b) => b.date === date && b.jobId === (e.job_site_id ?? null));
    if (existing) existing.hours += hours;
    else list.push({ date, week: workweekKey(date), jobId: e.job_site_id ?? null, hours });
    byEmployee.set(e.employee_id, list);
  }

  const rows: AdpExportRow[] = [];

  for (const [employeeId, buckets] of byEmployee) {
    const profile = profileById.get(employeeId);
    buckets.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
    // Cumulative hours within the current Sunday–Saturday workweek.
    let cumulative = 0;
    let currentWeek: string | null = null;
    for (const bucket of buckets) {
      if (bucket.week !== currentWeek) {
        currentWeek = bucket.week;
        cumulative = 0; // new workweek -> reset the 40-hour threshold
      }
      const site = bucket.jobId ? siteById.get(bucket.jobId) : undefined;
      const before = cumulative;
      cumulative += bucket.hours;
      const regular = round2(Math.max(0, Math.min(cumulative, 40) - Math.min(before, 40)));
      const overtime = round2(Math.max(0, cumulative - Math.max(before, 40)));
      const shared = {
        employee_id: employeeId,
        crew_compass_employee_code: profile?.employee_id || '',
        adp_file_number: profile?.adp_file_number || '',
        employee_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown employee',
        work_date: bucket.date,
        hourly_rate: profile?.hourly_rate ?? null,
        job_site_id: bucket.jobId,
        job_name: site?.name || '',
        job_cost_code: site?.job_cost_code || '',
        city: site?.city || '',
        state: site?.state || '',
        tax_jurisdiction: site?.tax_jurisdiction || site?.city || '',
        location_code: site?.location_code || '',
        department_code: profile?.adp_department_code || '',
      };
      if (regular > 0) {
        rows.push({ ...shared, earnings_code: settings.regular_code, regular_hours: regular, overtime_hours: 0, total_hours: regular });
      }
      if (overtime > 0) {
        rows.push({ ...shared, earnings_code: settings.overtime_code, regular_hours: 0, overtime_hours: overtime, total_hours: overtime });
      }
    }
  }

  rows.sort(
    (a, b) =>
      a.employee_name.localeCompare(b.employee_name) ||
      a.work_date.localeCompare(b.work_date) ||
      a.job_name.localeCompare(b.job_name) ||
      a.earnings_code.localeCompare(b.earnings_code)
  );

  return rows;
}