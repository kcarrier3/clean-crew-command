/**
 * Service types supported by the Crew Compass estimator.
 *
 * Janitorial keeps its own recurring monthly engine (calc.ts). Every other
 * service is a one-time / project bid handled by specialtyCalc.ts.
 */

export type ServiceType =
  | 'janitorial'
  | 'construction_cleaning'
  | 'carpet_cleaning'
  | 'floor_scrubbing'
  | 'vct_strip_wax';

export const SERVICE_TYPES: {
  value: ServiceType;
  label: string;
  short: string;
  description: string;
  recurring: boolean;
}[] = [
  {
    value: 'janitorial',
    label: 'Janitorial',
    short: 'Janitorial',
    description: 'Recurring nightly / weekly cleaning priced per month.',
    recurring: true,
  },
  {
    value: 'construction_cleaning',
    label: 'Construction Cleaning',
    short: 'Construction',
    description: 'Rough, final and punch-clean phases priced as one project.',
    recurring: false,
  },
  {
    value: 'carpet_cleaning',
    label: 'Carpet Cleaning',
    short: 'Carpet',
    description: 'One-time extraction or encapsulation cleaning.',
    recurring: false,
  },
  {
    value: 'floor_scrubbing',
    label: 'Floor Scrubbing',
    short: 'Scrub',
    description: 'Machine scrub / deep clean of hard floor surfaces.',
    recurring: false,
  },
  {
    value: 'vct_strip_wax',
    label: 'VCT Strip & Wax',
    short: 'Strip & Wax',
    description: 'Strip, neutralize and re-coat VCT with finish.',
    recurring: false,
  },
];

export const SERVICE_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_TYPES.map(s => [s.value, s.label])
);

export const isServiceType = (v: unknown): v is ServiceType =>
  SERVICE_TYPES.some(s => s.value === v);

export const normalizeServiceType = (v: unknown): ServiceType =>
  isServiceType(v) ? v : 'janitorial';

export const isRecurringService = (v: unknown): boolean =>
  normalizeServiceType(v) === 'janitorial';