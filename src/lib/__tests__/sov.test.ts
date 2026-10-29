import { describe, expect, it } from 'vitest';
import { progressBillLine, sovBillingState } from '@/lib/billing/sov';

describe('sovBillingState', () => {
  it('stays open until the checkpoint is complete', () => {
    expect(sovBillingState('in_progress', null)).toBe('open');
  });

  it('is ready to bill once complete and not yet invoiced', () => {
    expect(sovBillingState('complete', 'ready')).toBe('ready');
    expect(sovBillingState('complete', null)).toBe('ready');
  });

  it('is billed only while the billing event is invoiced', () => {
    expect(sovBillingState('complete', 'invoiced')).toBe('billed');
  });

  it('returns to unbilled when the invoice is voided and the event is ready again', () => {
    expect(sovBillingState('complete', 'ready')).toBe('ready');
  });

  it('does not treat a cancelled event as ready', () => {
    expect(sovBillingState('in_progress', 'cancelled')).toBe('open');
  });
});

describe('progressBillLine', () => {
  it('puts this invoice on this period and leaves the rest remaining', () => {
    const line = progressBillLine('Rough-in', 1000, 'invoiced', 'inv-1', 'inv-1');
    expect(line.thisPeriod).toBe(1000);
    expect(line.previouslyBilled).toBe(0);
    expect(line.remaining).toBe(0);
  });

  it('counts an earlier invoice as previously billed', () => {
    const line = progressBillLine('Demo', 400, 'invoiced', 'inv-old', 'inv-1');
    expect(line.previouslyBilled).toBe(400);
    expect(line.thisPeriod).toBe(0);
    expect(line.remaining).toBe(0);
  });

  it('leaves an open checkpoint remaining', () => {
    const line = progressBillLine('Final', 250, 'ready', null, 'inv-1');
    expect(line.thisPeriod).toBe(0);
    expect(line.remaining).toBe(250);
  });
});
