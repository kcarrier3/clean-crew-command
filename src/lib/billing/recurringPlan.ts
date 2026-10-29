/** Pure planning for recurring invoices. The database unique keys enforce the same rules. */

export type ScheduleStatus = 'active' | 'hold' | 'inactive';

export interface PlanLine {
  billingItemId: string | null;
  description: string;
  quantity: number;
  rate: number;
  taxable: boolean;
}

export interface PlanSchedule {
  id: string;
  jobSiteId: string;
  siteName: string;
  companyId: string | null;
  billingEmail: string | null;
  consolidated: boolean;
  status: ScheduleStatus;
  poRequired: boolean;
  poNumber: string | null;
  lines: PlanLine[];
  /** Set when this schedule already has an invoice for the period. */
  alreadyInvoicedId: string | null;
}

export interface PlannedLine extends PlanLine {
  scheduleId: string;
  jobSiteId: string;
  serviceLocation: string;
}

export interface InvoiceBatch {
  key: string;
  consolidated: boolean;
  companyId: string | null;
  billingEmail: string | null;
  /** One site, or null when several sites share the invoice. */
  jobSiteId: string | null;
  scheduleIds: string[];
  lines: PlannedLine[];
  amount: number;
}

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const lineAmount = (l: Pick<PlanLine, 'quantity' | 'rate'>) =>
  round2(Number(l.quantity) * Number(l.rate));

export const scheduleAmount = (lines: Pick<PlanLine, 'quantity' | 'rate'>[]) =>
  round2(lines.reduce((s, l) => s + lineAmount(l), 0));

export const consolidateKey = (s: Pick<PlanSchedule, 'id' | 'consolidated' | 'companyId' | 'billingEmail'>, periodStart: string) => {
  if (s.consolidated && s.companyId) {
    return `co:${s.companyId}|${(s.billingEmail ?? '').trim().toLowerCase()}|${periodStart}`;
  }
  return `sch:${s.id}|${periodStart}`;
};

/** Service location stays on the line, separate from the bill-to customer. */
export const invoiceLineDescription = (serviceLocation: string, description: string) => {
  const desc = description.trim();
  const loc = serviceLocation.trim();
  if (!loc) return desc;
  if (desc.toLowerCase().startsWith(loc.toLowerCase())) return desc;
  return `${loc} — ${desc}`;
};

export const planInvoiceBatches = (schedules: PlanSchedule[], periodStart: string): {
  batches: InvoiceBatch[];
  skipped: { scheduleId: string; reason: string }[];
} => {
  const skipped: { scheduleId: string; reason: string }[] = [];
  const open: PlanSchedule[] = [];
  for (const s of schedules) {
    if (s.alreadyInvoicedId) {
      skipped.push({ scheduleId: s.id, reason: 'already-invoiced' });
      continue;
    }
    if (s.status !== 'active') {
      skipped.push({ scheduleId: s.id, reason: s.status });
      continue;
    }
    if (s.poRequired && !(s.poNumber && s.poNumber.trim())) {
      skipped.push({ scheduleId: s.id, reason: 'po-required' });
      continue;
    }
    if (scheduleAmount(s.lines) <= 0) {
      skipped.push({ scheduleId: s.id, reason: 'no-amount' });
      continue;
    }
    open.push(s);
  }

  const groups = new Map<string, PlanSchedule[]>();
  for (const s of open) {
    const key = consolidateKey(s, periodStart);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const batches: InvoiceBatch[] = [];
  for (const [key, members] of groups) {
    const lines: PlannedLine[] = [];
    for (const s of members) {
      for (const l of s.lines) {
        lines.push({
          ...l,
          scheduleId: s.id,
          jobSiteId: s.jobSiteId,
          serviceLocation: s.siteName,
          description: invoiceLineDescription(s.siteName, l.description),
        });
      }
    }
    const sites = [...new Set(members.map(m => m.jobSiteId))];
    batches.push({
      key,
      consolidated: members.some(m => m.consolidated) && members.length > 1,
      companyId: members[0].companyId,
      billingEmail: members[0].billingEmail,
      jobSiteId: sites.length === 1 ? sites[0] : members[0].jobSiteId,
      scheduleIds: members.map(m => m.id),
      lines,
      amount: scheduleAmount(lines),
    });
  }
  return { batches, skipped };
};

/** Active schedules with no send in the current calendar month, once the date is past the 2nd. */
export const notSentThisMonth = (args: {
  status: ScheduleStatus;
  today: string;
  lastSentOn: string | null;
}) => {
  if (args.status !== 'active') return false;
  const day = Number(args.today.slice(8, 10));
  if (!Number.isFinite(day) || day <= 2) return false;
  if (!args.lastSentOn) return true;
  return args.lastSentOn.slice(0, 7) !== args.today.slice(0, 7);
};

export type DeliveryBadge = 'delivered' | 'bounced' | 'failed' | 'pending';

export const deliveryBadge = (status: string | null | undefined): DeliveryBadge | null => {
  const s = (status ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (!s || s === 'notset') return null;
  if (s.includes('bounce')) return 'bounced';
  if (s.includes('fail') || s.includes('complain')) return 'failed';
  if (s.includes('deliver') || s === 'emailsent' || s === 'sent' || s === 'opened') return 'delivered';
  if (s === 'queued' || s === 'draft' || s === 'pending') return 'pending';
  return 'pending';
};

/** "Janitorial:Janitorial Services x1 @435 (Elevator Cleaning)" */
export const parseQbLine = (raw: string): { description: string; quantity: number; rate: number; location: string | null } | null => {
  const text = raw.trim();
  if (!text) return null;
  const m = text.match(/^(.*)\sx([0-9]+(?:\.[0-9]+)?)\s@([0-9]+(?:\.[0-9]+)?)(?:\s+\((.+)\))?$/i);
  if (!m) return { description: text, quantity: 1, rate: 0, location: null };
  const item = m[1].split(':').pop()?.trim() || m[1].trim();
  return {
    description: item,
    quantity: Number(m[2]),
    rate: Number(m[3]),
    location: m[4]?.trim() || null,
  };
};

export const parseQbLines = (raw: string) =>
  raw.split('|').map(part => parseQbLine(part)).filter((l): l is NonNullable<typeof l> => !!l);
