/** How a schedule-of-values checkpoint shows up for the office. */
export type SovBillingState = 'open' | 'ready' | 'held' | 'billed';

export const sovBillingState = (
  phaseStatus: string | null | undefined,
  eventStatus: string | null | undefined,
): SovBillingState => {
  if (eventStatus === 'invoiced') return 'billed';
  if (eventStatus === 'hold') return 'held';
  if (phaseStatus === 'complete' && eventStatus !== 'cancelled') return 'ready';
  return 'open';
};

export interface ProgressBillLine {
  name: string;
  scheduled: number;
  previouslyBilled: number;
  thisPeriod: number;
  remaining: number;
}

/** One row of a progress invoice. Partial percent and retainage can change the amounts later. */
export const progressBillLine = (
  name: string,
  scheduled: number,
  eventStatus: string | null | undefined,
  eventInvoiceId: string | null | undefined,
  thisInvoiceId: string,
): ProgressBillLine => {
  const onThisInvoice = eventStatus === 'invoiced' && eventInvoiceId === thisInvoiceId;
  const billedEarlier = eventStatus === 'invoiced' && eventInvoiceId && eventInvoiceId !== thisInvoiceId;
  const thisPeriod = onThisInvoice ? scheduled : 0;
  const previouslyBilled = billedEarlier ? scheduled : 0;
  return {
    name,
    scheduled,
    previouslyBilled,
    thisPeriod,
    remaining: Math.max(scheduled - previouslyBilled - thisPeriod, 0),
  };
};

export const SOV_STATE_LABEL: Record<SovBillingState, string> = {
  open: 'Not complete',
  ready: 'Ready to bill',
  held: 'On hold',
  billed: 'Billed',
};
