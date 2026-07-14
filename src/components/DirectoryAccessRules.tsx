import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DIRECTORY_CATEGORIES, RULE_VIEWER_JOB_TITLES } from '@/lib/directoryCategories';

interface Rule { viewer_job_title: string; visible_category: string }

const key = (jt: string, cat: string) => `${jt}::${cat}`;

export default function DirectoryAccessRules() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('directory_access_rules')
      .select('viewer_job_title, visible_category');
    if (error) {
      toast({ title: 'Failed to load rules', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const set = new Set<string>((data || []).map((r: Rule) => key(r.viewer_job_title, r.visible_category)));
    setSelected(set);
    setOriginal(new Set(set));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = (jt: string, cat: string) => {
    setSelected(prev => {
      const k = key(jt, cat);
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (selected.size !== original.size) return true;
    for (const k of selected) if (!original.has(k)) return true;
    return false;
  }, [selected, original]);

  const save = async () => {
    setSaving(true);
    const toAdd: Rule[] = [];
    const toRemove: Rule[] = [];
    for (const k of selected) if (!original.has(k)) {
      const [viewer_job_title, visible_category] = k.split('::');
      toAdd.push({ viewer_job_title, visible_category });
    }
    for (const k of original) if (!selected.has(k)) {
      const [viewer_job_title, visible_category] = k.split('::');
      toRemove.push({ viewer_job_title, visible_category });
    }

    if (toAdd.length) {
      const rows = toAdd.map(r => ({ ...r, created_by: user?.id }));
      const { error } = await (supabase as any).from('directory_access_rules').insert(rows);
      if (error) { setSaving(false); toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    }
    for (const r of toRemove) {
      const { error } = await (supabase as any)
        .from('directory_access_rules')
        .delete()
        .eq('viewer_job_title', r.viewer_job_title)
        .eq('visible_category', r.visible_category);
      if (error) { setSaving(false); toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    }
    setSaving(false);
    toast({ title: 'Directory rules updated' });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Directory Access Rules</CardTitle>
            <CardDescription>
              For each job title, check which contact categories those employees can see. Managers and admins
              always see the full directory.
            </CardDescription>
          </div>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save rules'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-background border-b">Job title (viewer)</th>
                  {DIRECTORY_CATEGORIES.map(c => (
                    <th key={c.value} className="p-2 text-center border-b whitespace-nowrap font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RULE_VIEWER_JOB_TITLES.map(jt => (
                  <tr key={jt} className="border-b hover:bg-accent/40">
                    <td className="p-2 font-medium sticky left-0 bg-background whitespace-nowrap">{jt}</td>
                    {DIRECTORY_CATEGORIES.map(c => (
                      <td key={c.value} className="p-2 text-center">
                        <Checkbox
                          checked={selected.has(key(jt, c.value))}
                          onCheckedChange={() => toggle(jt, c.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}