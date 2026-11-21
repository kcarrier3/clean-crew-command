import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { JOB_TITLES } from '@/lib/jobTitles';
import { ALL_PERMISSIONS } from '@/components/TeamRoster';

const isLocked = (title: string, perm: string) => title === 'Project Crew Lead' && perm === 'edit_schedules';

export default function PositionPermissionsSettings() {
  const { toast } = useToast();
  const [title, setTitle] = useState<string>(JOB_TITLES[0]);
  const [all, setAll] = useState<Record<string, Set<string>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from('job_title_permissions').select('job_title, permission');
    if (error) toast({ title: 'Could not load positions', description: error.message, variant: 'destructive' });
    const map: Record<string, Set<string>> = {};
    for (const r of data ?? []) (map[r.job_title] ??= new Set()).add(r.permission);
    setAll(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected(new Set(all[title] ?? [])); }, [title, all]);

  const original = all[title] ?? new Set<string>();
  const dirty = useMemo(() => selected.size !== original.size || [...selected].some(p => !original.has(p)), [selected, original]);
  const categories = Array.from(new Set(ALL_PERMISSIONS.map(p => p.category)));

  const toggle = (perm: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(perm) ? next.delete(perm) : next.add(perm);
    return next;
  });

  const save = async () => {
    setSaving(true);
    const add = [...selected].filter(p => !original.has(p)).map(permission => ({ job_title: title, permission }));
    const remove = [...original].filter(p => !selected.has(p));
    try {
      if (add.length) {
        const { error } = await (supabase as any).from('job_title_permissions').insert(add);
        if (error) throw error;
      }
      if (remove.length) {
        const { error } = await (supabase as any).from('job_title_permissions').delete().eq('job_title', title).in('permission', remove);
        if (error) throw error;
      }
      const { data: count, error } = await (supabase as any).rpc('apply_job_title_permissions', { _job_title: title });
      if (error) throw error;
      toast({ title: `${title} updated`, description: `Applied to ${count ?? 0} ${count === 1 ? 'person' : 'people'}.` });
      await load();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Position permissions</CardTitle>
        <CardDescription>
          Choose what each position can see and do. Saving updates everyone in that position, including anyone customized by hand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={title} onValueChange={setTitle}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {JOB_TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat}>
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">{cat}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.filter(p => p.category === cat).map(p => {
                    const locked = isLocked(title, p.key);
                    return (
                      <label key={p.key} className={`flex items-center gap-2 text-sm ${locked ? 'opacity-50' : 'cursor-pointer'}`}>
                        <Checkbox checked={!locked && selected.has(p.key)} disabled={locked} onCheckedChange={() => toggle(p.key)} />
                        {p.label}{locked && ' (not allowed for crew leads)'}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save and apply'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
