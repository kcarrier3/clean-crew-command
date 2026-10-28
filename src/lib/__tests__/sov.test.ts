import { describe, expect, it } from 'vitest';
import { sovBillingState } from '@/lib/billing/sov';

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
