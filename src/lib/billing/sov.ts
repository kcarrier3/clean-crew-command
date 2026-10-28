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

export const SOV_STATE_LABEL: Record<SovBillingState, string> = {
  open: 'Not complete',
  ready: 'Ready to bill',
  held: 'On hold',
  billed: 'Billed',
};
