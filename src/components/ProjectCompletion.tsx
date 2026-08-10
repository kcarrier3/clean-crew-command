import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Circle, Plus, Trash2, Receipt, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Phase {
  id: string;
  name: string;
  sequence: number;
  status: string;
  completed_at: string | null;
  completion_notes: string | null;
  billing_acknowledged_at: string | null;
}

interface Props {
  jobSiteId: string;
  jobSiteName: string;
  onChanged?: () => void;
}

/** Completion + billing hand-off for one-time (project) job sites. */
export const ProjectCompletion = ({ jobSiteId, jobSiteName, onChanged }: Props) => {
  const { user, isManager } = useAuth();
  const { toast } = useToast();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newPhase, setNewPhase] = useState('');
  const [completeTarget, setCompleteTarget] = useState<{ kind: 'project' | 'phase'; id?: string; label: string } | null>(null);
  const [notes, setNotes] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: siteRow }, { data: phaseRows }] = await Promise.all([
      supabase.from('job_sites')
        .select('is_phased, completion_status, completed_at, completion_notes, billing_acknowledged_at')
        .eq('id', jobSiteId).maybeSingle(),
      supabase.from('project_phases').select('*').eq('job_site_id', jobSiteId).order('sequence'),
    ]);
    setSite(siteRow);
    setPhases((phaseRows as Phase[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobSiteId]);

  const submitCompletion = async () => {
    if (!completeTarget) return;
    setSaving(true);
    try {
      if (completeTarget.kind === 'phase') {
        const { error } = await supabase.from('project_phases').update({
          status: 'complete',
          completed_at: new Date().toISOString(),
          completed_by: user?.id ?? null,
          completion_notes: notes.trim() || null,
        }).eq('id', completeTarget.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('job_sites').update({
          completion_status: 'complete',
          completed_at: new Date().toISOString(),
          completed_by: user?.id ?? null,
          completion_notes: notes.trim() || null,
        }).eq('id', jobSiteId);
        if (error) throw error;
      }
      toast({ title: 'Marked complete', description: `${completeTarget.label} is ready for billing.` });
      setCompleteTarget(null);
      setNotes('');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({ title: 'Could not mark complete', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reopen = async (phaseId?: string) => {
    const q = phaseId
      ? supabase.from('project_phases').update({ status: 'in_progress', completed_at: null, completed_by: null }).eq('id', phaseId)
      : supabase.from('job_sites').update({ completion_status: 'in_progress', completed_at: null, completed_by: null }).eq('id', jobSiteId);
    const { error } = await q;
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    await load();
    onChanged?.();
  };

  const acknowledgeBilling = async (phaseId?: string) => {
    const patch = { billing_acknowledged_at: new Date().toISOString(), billing_acknowledged_by: user?.id ?? null };
    const q = phaseId
      ? supabase.from('project_phases').update(patch).eq('id', phaseId)
      : supabase.from('job_sites').update(patch).eq('id', jobSiteId);
    const { error } = await q;
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: 'Marked as billed' });
    await load();
  };

  const addPhase = async () => {
    if (!newPhase.trim()) return;
    const { error } = await supabase.from('project_phases').insert({
      job_site_id: jobSiteId,
      name: newPhase.trim(),
      sequence: (phases[phases.length - 1]?.sequence ?? 0) + 1,
    });
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    if (!site?.is_phased) await supabase.from('job_sites').update({ is_phased: true }).eq('id', jobSiteId);
    setNewPhase('');
    setAddOpen(false);
    await load();
  };

  const removePhase = async (id: string) => {
    const { error } = await supabase.from('project_phases').delete().eq('id', id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    await load();
  };

  if (loading) return null;

  const projectComplete = site?.completion_status === 'complete';
  const allPhasesDone = phases.length > 0 && phases.every(p => p.status === 'complete');

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Job Completion
          </CardTitle>
          {isManager && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Phase
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {phases.length > 0 && (
            <div className="space-y-2">
              {phases.map(p => (
                <div key={p.id} className="flex items-center gap-2 rounded-md border p-2">
                  {p.status === 'complete'
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {p.completed_at && (
                      <p className="text-xs text-muted-foreground">
                        Completed {format(new Date(p.completed_at), 'MMM d, yyyy')}
                        {p.billing_acknowledged_at ? ' · Billed' : ' · Ready for billing'}
                      </p>
                    )}
                  </div>
                  {isManager && p.status !== 'complete' && (
                    <Button size="sm" onClick={() => { setCompleteTarget({ kind: 'phase', id: p.id, label: p.name }); setNotes(''); }}>
                      Phase complete
                    </Button>
                  )}
                  {isManager && p.status === 'complete' && !p.billing_acknowledged_at && (
                    <Button size="sm" variant="outline" onClick={() => acknowledgeBilling(p.id)}>
                      <Receipt className="h-3.5 w-3.5 mr-1" /> Billed
                    </Button>
                  )}
                  {isManager && p.status === 'complete' && (
                    <Button size="sm" variant="ghost" onClick={() => reopen(p.id)}>Reopen</Button>
                  )}
                  {isManager && p.status !== 'complete' && (
                    <Button size="sm" variant="ghost" onClick={() => removePhase(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Whole job</p>
              {projectComplete ? (
                <p className="text-xs text-muted-foreground">
                  Completed {site.completed_at ? format(new Date(site.completed_at), 'MMM d, yyyy') : ''}
                  {site.billing_acknowledged_at ? ' · Billed' : ' · Ready for billing'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {phases.length > 0 && !allPhasesDone ? 'Phases still open' : 'In progress'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {projectComplete ? (
                <>
                  <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  {isManager && !site.billing_acknowledged_at && (
                    <Button size="sm" variant="outline" onClick={() => acknowledgeBilling()}>
                      <Receipt className="h-3.5 w-3.5 mr-1" /> Billed
                    </Button>
                  )}
                  {isManager && <Button size="sm" variant="ghost" onClick={() => reopen()}>Reopen</Button>}
                </>
              ) : isManager ? (
                <Button size="sm" onClick={() => { setCompleteTarget({ kind: 'project', label: jobSiteName }); setNotes(''); }}>
                  Project complete
                </Button>
              ) : (
                <Badge variant="secondary">In progress</Badge>
              )}
            </div>
          </div>
          {!isManager && (
            <p className="text-xs text-muted-foreground">Only managers can mark a phase or job complete.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add phase</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="phase_name">Phase name</Label>
            <Input id="phase_name" value={newPhase} onChange={e => setNewPhase(e.target.value)} placeholder="e.g. Phase 1 — Rough clean" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addPhase}>Add phase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeTarget} onOpenChange={o => !o && setCompleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark "{completeTarget?.label}" complete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This flags the work as finished so the office manager knows it is ready for billing.
          </p>
          <div className="space-y-2">
            <Label htmlFor="completion_notes">Notes for billing (optional)</Label>
            <Textarea id="completion_notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>Cancel</Button>
            <Button onClick={submitCompletion} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Mark complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
