export interface PaidHolidayRow {
  id: string;
  name: string;
  rule: string;
  active: boolean;
  paid_only_if_weekday: boolean;
}

export interface ResolvedHoliday {
  id: string;
  name: string;
  date: Date;
  paid: boolean;
}

const MANAGER_TITLES = [
  'Owner',
  'Office Manager',
  'Operations Manager',
  'Janitorial Manager',
  'Night Manager',
  'Project Crew Lead',
  'Supply Management',
];

export const isPtoManagerTitle = (title?: string | null) => !!title && MANAGER_TITLES.includes(title);

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};
const DAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

/** Resolve a holiday rule (e.g. "12-25", "last-monday-may", "fourth-thursday-november") to a date. */
export function resolveHolidayDate(rule: string, year: number): Date | null {
  const r = rule.trim().toLowerCase();

  const fixed = r.match(/^(\d{2})-(\d{2})$/);
  if (fixed) return new Date(year, Number(fixed[1]) - 1, Number(fixed[2]));

  const parts = r.split('-');
  if (parts.length === 3) {
    const [ord, dayName, monthName] = parts;
    const dow = DAYS[dayName];
    const month = MONTHS[monthName];
    if (dow === undefined || month === undefined) return null;

    if (ord === 'last') {
      const d = new Date(year, month + 1, 0);
      while (d.getDay() !== dow) d.setDate(d.getDate() - 1);
      return d;
    }
    const n = ORDINALS[ord];
    if (!n) return null;
    const d = new Date(year, month, 1);
    while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + (n - 1) * 7);
    return d.getMonth() === month ? d : null;
  }
  return null;
}

export function resolveHolidaysForYear(rows: PaidHolidayRow[], year: number): ResolvedHoliday[] {
  return rows
    .filter((h) => h.active)
    .map((h) => {
      const date = resolveHolidayDate(h.rule, year);
      if (!date) return null;
      const dow = date.getDay();
      const weekday = dow >= 1 && dow <= 5;
      return { id: h.id, name: h.name, date, paid: h.paid_only_if_weekday ? weekday : true };
    })
    .filter((x): x is ResolvedHoliday => x !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
