import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock('@/components/billing/billingApi', () => ({ db: { from: mocks.from } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { setRecurringScheduleEnabled } from '@/components/billing/recurringApi';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: { id: 'account-schedule' }, error: null });
});

describe('per-account recurring invoicing switch', () => {
  it('turns only the selected schedule off without changing invoices', async () => {
    await setRecurringScheduleEnabled('account-schedule', false);
    expect(mocks.from.mock.calls).toEqual([['recurring_billing_schedules']]);
    expect(mocks.update).toHaveBeenCalledWith({ status: 'inactive' });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'account-schedule');
  });
  it('turns the selected schedule on', async () => {
    await setRecurringScheduleEnabled('account-schedule', true);
    expect(mocks.update).toHaveBeenCalledWith({ status: 'active' });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'account-schedule');
  });
  it('reports a rejected save instead of claiming success', async () => {
    mocks.single.mockResolvedValue({ error: new Error('Permission denied') });
    await expect(setRecurringScheduleEnabled('account-schedule', false)).rejects.toThrow('Permission denied');
  });
});