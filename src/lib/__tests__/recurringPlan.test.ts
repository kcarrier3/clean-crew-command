import { describe, expect, it } from 'vitest';
import {
  deliveryBadge, invoiceLineDescription, notSentThisMonth, parseQbLines,
  planInvoiceBatches, scheduleAmount, type PlanSchedule,
} from '@/lib/billing/recurringPlan';

const line = (rate: number, description = 'Janitorial Services') => ({
  billingItemId: 'item-janitorial',
  description,
  quantity: 1,
  rate,
  taxable: true,
});

const schedule = (patch: Partial<PlanSchedule> & Pick<PlanSchedule, 'id' | 'jobSiteId' | 'siteName'>): PlanSchedule => ({
  companyId: 'co-1',
  billingEmail: 'ap@example.com',
  consolidated: false,
  status: 'active',
  poRequired: false,
  poNumber: null,
  lines: [line(100)],
  alreadyInvoicedId: null,
  ...patch,
});

describe('planInvoiceBatches', () => {
  it('does not invoice a schedule that already has an invoice for the period', () => {
    const first = planInvoiceBatches([
      schedule({ id: 's1', jobSiteId: 'site', siteName: 'North' }),
    ], '2026-10-01');
    expect(first.batches).toHaveLength(1);
    const again = planInvoiceBatches([
      schedule({ id: 's1', jobSiteId: 'site', siteName: 'North', alreadyInvoicedId: 'inv-1' }),
    ], '2026-10-01');
    expect(again.batches).toHaveLength(0);
    expect(again.skipped[0].reason).toBe('already-invoiced');
  });

  it('keeps two schedules on one site as two invoices when bill-to differs', () => {
    const { batches } = planInvoiceBatches([
      schedule({
        id: 'club', jobSiteId: 'vermilion', siteName: 'Vermilion Shores',
        companyId: 'continental', billingEmail: 'invoices@continentalmgmt.com',
        lines: [line(435, 'Clubhouse')],
      }),
      schedule({
        id: 'elev', jobSiteId: 'vermilion', siteName: 'Vermilion Shores',
        companyId: 'lawrence', billingEmail: 'ap@lawrencemanagement.com',
        lines: [line(90, 'Elevator cleaning')],
      }),
    ], '2026-10-01');
    expect(batches).toHaveLength(2);
    expect(batches.map(b => b.amount).sort((a, b) => a - b)).toEqual([90, 435]);
    expect(new Set(batches.map(b => b.companyId))).toEqual(new Set(['continental', 'lawrence']));
  });

  it('combines consolidated schedules for one bill-to into one invoice labeled by site', () => {
    const sites = [
      ['hall', 'Avon City Hall', 1355],
      ['util', 'Avon Utilities', 500],
      ['senior', 'Avon Senior Center', 700],
      ['police', 'Avon Police', 1800],
      ['street', 'Avon Street', 735],
    ] as const;
    const { batches } = planInvoiceBatches(sites.map(([id, name, rate]) => schedule({
      id, jobSiteId: id, siteName: name, companyId: 'avon', billingEmail: 'financedept@cityofavon.com',
      consolidated: true, lines: [line(rate)],
    })), '2026-10-01');
    expect(batches).toHaveLength(1);
    expect(batches[0].consolidated).toBe(true);
    expect(batches[0].companyId).toBe('avon');
    expect(batches[0].lines).toHaveLength(5);
    expect(batches[0].lines.map(l => l.serviceLocation)).toEqual(sites.map(([, name]) => name));
    expect(batches[0].lines[0].description.startsWith('Avon City Hall — ')).toBe(true);
    expect(batches[0].amount).toBe(1355 + 500 + 700 + 1800 + 735);
  });

  it('does not combine schedules that are not marked consolidated', () => {
    const { batches } = planInvoiceBatches([
      schedule({ id: 'a', jobSiteId: 'a', siteName: 'A', consolidated: false }),
      schedule({ id: 'b', jobSiteId: 'b', siteName: 'B', consolidated: false }),
    ], '2026-10-01');
    expect(batches).toHaveLength(2);
  });

  it('skips inactive, hold, missing PO, and zero-dollar schedules', () => {
    const { batches, skipped } = planInvoiceBatches([
      schedule({ id: 'off', jobSiteId: 'a', siteName: 'A', status: 'inactive' }),
      schedule({ id: 'hold', jobSiteId: 'b', siteName: 'B', status: 'hold' }),
      schedule({ id: 'po', jobSiteId: 'c', siteName: 'C', poRequired: true, poNumber: '  ' }),
      schedule({ id: 'zero', jobSiteId: 'd', siteName: 'D', lines: [line(0)] }),
    ], '2026-10-01');
    expect(batches).toHaveLength(0);
    expect(skipped.map(s => s.reason).sort()).toEqual(['hold', 'inactive', 'no-amount', 'po-required']);
  });
});

describe('schedule amounts and delivery', () => {
  it('sums line quantity times rate', () => {
    expect(scheduleAmount([
      { quantity: 2, rate: 10.5 },
      { quantity: 1, rate: 0.1 },
    ])).toBe(21.1);
  });

  it('flags active schedules not sent after the 2nd', () => {
    expect(notSentThisMonth({ status: 'active', today: '2026-10-02', lastSentOn: null })).toBe(false);
    expect(notSentThisMonth({ status: 'active', today: '2026-10-03', lastSentOn: null })).toBe(true);
    expect(notSentThisMonth({ status: 'active', today: '2026-10-15', lastSentOn: '2026-10-01' })).toBe(false);
    expect(notSentThisMonth({ status: 'active', today: '2026-10-15', lastSentOn: '2026-09-01' })).toBe(true);
    expect(notSentThisMonth({ status: 'hold', today: '2026-10-15', lastSentOn: null })).toBe(false);
  });

  it('maps Resend and QuickBooks delivery statuses', () => {
    expect(deliveryBadge('delivered')).toBe('delivered');
    expect(deliveryBadge('EmailSent')).toBe('delivered');
    expect(deliveryBadge('bounced')).toBe('bounced');
    expect(deliveryBadge('failed')).toBe('failed');
    expect(deliveryBadge('queued')).toBe('pending');
    expect(deliveryBadge('NotSet')).toBe(null);
  });

  it('parses QuickBooks recurring lines including a location', () => {
    const lines = parseQbLines('Janitorial:Janitorial Services x1 @1420 | Janitorial:Janitorial Services x1 @70 (Engineering Office)');
    expect(lines).toEqual([
      { description: 'Janitorial Services', quantity: 1, rate: 1420, location: null },
      { description: 'Janitorial Services', quantity: 1, rate: 70, location: 'Engineering Office' },
    ]);
    expect(invoiceLineDescription('Crocker Park', 'Janitorial Services')).toBe('Crocker Park — Janitorial Services');
  });
});
