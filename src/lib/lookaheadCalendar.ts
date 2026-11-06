import { addDays, format, startOfWeek } from 'date-fns';

export interface TrainingInput {
  worker_id: string; manager_id: string; job_site_id: string;
  session_date: string; start_time: string; end_time: string;
}
export const validateTraining = (input: TrainingInput): string | null => {
  if (!input.worker_id) return 'Choose a worker';
  if (!input.manager_id) return 'Choose a training manager';
  if (!input.job_site_id) return 'Choose an existing account';
  if (!input.session_date || !input.start_time || !input.end_time) return 'Enter the date and times';
  if (input.end_time <= input.start_time) return 'End time must be after start time';
  return null;
};
export const managerTrainingWeek = <T extends { manager_id: string; session_date: string }>(rows: T[], managerId: string, today: Date): T[] => {
  const start = startOfWeek(today, { weekStartsOn: 0 });
  const first = format(start, 'yyyy-MM-dd');
  const last = format(addDays(start, 6), 'yyyy-MM-dd');
  return rows.filter(row => row.manager_id === managerId && row.session_date >= first && row.session_date <= last);
};
export const trainingIsPublished = (publishedAt: string | null): boolean => publishedAt !== null;