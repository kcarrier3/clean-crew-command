import { useEffect, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useModuleSettings } from '@/hooks/useModuleSettings';
import { managerTrainingWeek } from '@/lib/lookaheadCalendar';
import { personName, plannerEntries, plannerOptions, type TrainingSession } from './plannerApi';

export default function ManagerTrainingWeek() {
  const { user, isManager } = useAuth();
  const { isModuleEnabled } = useModuleSettings();
  const enabled = isModuleEnabled('trainingplanner');
  const [rows,setRows] = useState<TrainingSession[]>([]);
  const [options,setOptions] = useState<Awaited<ReturnType<typeof plannerOptions>>>({people:[],managers:[],accounts:[]});
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  useEffect(()=>{
    if (!user || !enabled || !isManager()) return;
    let current=true; const today=new Date(); const start=startOfWeek(today,{weekStartsOn:0});
    Promise.all([plannerEntries(true,format(start,'yyyy-MM-dd'),format(addDays(start,6),'yyyy-MM-dd')),plannerOptions()]).then(([entries,choices])=>{
      if(!current)return; setRows(managerTrainingWeek(entries.filter((entry): entry is TrainingSession=>'worker_id' in entry),user.id,today)); setOptions(choices); setError('');
    }).catch(err=>{if(current)setError(err instanceof Error?err.message:'Could not load training');}).finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id,enabled,isManager()]);
  if(!enabled||!isManager())return null;
  return <section className="border-b border-border pb-5 space-y-3">
    <h2 className="font-semibold text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" />My Training This Week</h2>
    {error?<p role="alert" className="text-destructive">{error}</p>:loading?<p className="text-muted-foreground text-sm">Loading training…</p>:rows.length===0?<p className="text-muted-foreground text-sm">No trainees assigned to you this week.</p>:<div className="divide-y divide-border">{rows.map(row=><div key={row.id} className="py-3 flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="font-medium break-words">{personName(options.people.find(p=>p.id===row.worker_id))}</p><p className="text-sm text-muted-foreground break-words">{options.accounts.find(a=>a.id===row.job_site_id)?.name}</p><p className="text-sm">{format(parseISO(row.session_date),'EEE, MMM d')} · {row.start_time.slice(0,5)}–{row.end_time.slice(0,5)}</p></div><Badge variant={row.published_at?'default':'secondary'} className="h-fit">{row.published_at?'Published':'Draft'}</Badge></div>)}</div>}
  </section>;
}