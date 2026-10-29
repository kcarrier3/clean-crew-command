import { describe, expect, it } from 'vitest';
import { allocatePayment, arBucket, customerBalances, toCsv, unappliedAmount } from '@/lib/billing/paymentApply';

describe('allocatePayment', () => {
  it('applies a partial payment to the oldest invoice and leaves the rest open', () => {
    const { allocations, unapplied } = allocatePayment(40, [
      { id: 'newer', balance: 100, dueDate: '2026-11-01' },
      { id: 'older', balance: 100, dueDate: '2026-09-01' },
    ]);
    expect(allocations).toEqual([{ invoiceId: 'older', amount: 40 }]);
    expect(unapplied).toBe(0);
  });

  it('splits one payment across invoices and keeps the overpayment unapplied', () => {
    const { allocations, unapplied } = allocatePayment(150, [
      { id: 'a', balance: 60, dueDate: '2026-08-01' },
      { id: 'b', balance: 70, dueDate: '2026-09-01' },
    ]);
    expect(allocations).toEqual([
      { invoiceId: 'a', amount: 60 },
      { invoiceId: 'b', amount: 70 },
    ]);
    expect(unapplied).toBe(20);
    expect(unappliedAmount(150, allocations.map(a => a.amount))).toBe(20);
  });

  it('does not allocate a void or zero balance', () => {
    const { allocations, unapplied } = allocatePayment(25, [{ id: 'z', balance: 0, dueDate: '2026-01-01' }]);
    expect(allocations).toEqual([]);
    expect(unapplied).toBe(25);
  });
});

describe('A/R aging', () => {
  const today = '2026-10-29';

  it('buckets current, 30, 60, 90, and 90+', () => {
    expect(arBucket('2026-11-01', today)).toBe('current');
    expect(arBucket('2026-10-29', today)).toBe('current');
    expect(arBucket('2026-10-01', today)).toBe('30');
    expect(arBucket('2026-09-01', today)).toBe('60');
    expect(arBucket('2026-08-01', today)).toBe('90');
    expect(arBucket('2026-06-01', today)).toBe('90+');
  });

  it('sums a customer balance and skips void and draft invoices', () => {
    const rows = customerBalances([
      { id: '1', customerId: 'c', customerName: 'Avon', balance: 100, dueDate: '2026-11-01', status: 'sent' },
      { id: '2', customerId: 'c', customerName: 'Avon', balance: 50, dueDate: '2026-08-01', status: 'partially_paid' },
      { id: '3', customerId: 'c', customerName: 'Avon', balance: 999, dueDate: '2026-01-01', status: 'void' },
      { id: '4', customerId: 'c', customerName: 'Avon', balance: 10, dueDate: '2026-10-01', status: 'draft' },
    ], today);
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(150);
    expect(rows[0].buckets.current).toBe(100);
    expect(rows[0].buckets['90']).toBe(50);
  });

  it('writes a bookkeeper csv', () => {
    const csv = toCsv([{ kind: 'payment', amount: 10, memo: 'Check, front' }]);
    expect(csv.split('\n')[0]).toBe('kind,amount,memo');
    expect(csv).toContain('"Check, front"');
  });
});
