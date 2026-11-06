import { describe, expect, it } from 'vitest';
import { managerTrainingWeek, trainingIsPublished, validateTraining } from '../lookaheadCalendar';
const valid = { worker_id:'worker', manager_id:'manager', job_site_id:'account', session_date:'2026-11-06', start_time:'09:00', end_time:'12:00' };
describe('Training calendar requirements',()=>{
  it('requires a training manager',()=>expect(validateTraining({...valid,manager_id:''})).not.toBeNull());
  it('requires a worker',()=>expect(validateTraining({...valid,worker_id:''})).not.toBeNull());
  it('requires an existing account selection',()=>expect(validateTraining({...valid,job_site_id:''})).not.toBeNull());
  it('accepts complete training details',()=>expect(validateTraining(valid)).toBeNull());
  it('rejects end times before start',()=>expect(validateTraining({...valid,end_time:'08:00'})).not.toBeNull());
  it('does not treat drafts as published',()=>expect(trainingIsPublished(null)).toBe(false));
  it('recognizes explicit publication',()=>expect(trainingIsPublished('2026-11-06T23:00:00Z')).toBe(true));
  it('shows only the logged in managers trainees',()=>expect(managerTrainingWeek([{manager_id:'manager',session_date:'2026-11-06'},{manager_id:'other',session_date:'2026-11-06'}],'manager',new Date(2026,10,6))).toEqual([{manager_id:'manager',session_date:'2026-11-06'}]));
  it('includes Sunday through Saturday but not adjacent weeks',()=>expect(managerTrainingWeek(['2026-10-31','2026-11-01','2026-11-07','2026-11-08'].map(session_date=>({manager_id:'manager',session_date})),'manager',new Date(2026,10,6)).map(row=>row.session_date)).toEqual(['2026-11-01','2026-11-07']));
});