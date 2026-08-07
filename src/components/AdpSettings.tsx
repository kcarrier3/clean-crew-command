import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, Loader2, RotateCcw, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AdpExportSettings,
  DEFAULT_SETTINGS,
  FIELD_LABELS,
  REQUIRED_FIELDS,
  normalizeSettings,
} from '@/lib/adpExport';

const AdpSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AdpExportSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('adp_export_settings')
        .select('columns, regular_code, overtime_code, date_format')
        .eq('singleton', true)
        .maybeSingle();
      setSettings(normalizeSettings(data as any));
      setLoading(false);
    })();
  }, []);

  const updateColumn = (key: string, patch: { header?: string; enabled?: boolean }) => {
    setSettings((s) => ({
      ...s,
      columns: s.columns.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('adp_export_settings').upsert(
        {
          singleton: true,
          columns: settings.columns as any,
          regular_code: settings.regular_code,
          overtime_code: settings.overtime_code,
          date_format: settings.date_format,
          updated_by: userData.user?.id ?? null,
        },
        { onConflict: 'singleton' }
      );
      if (error) throw error;
      toast({ title: 'Saved', description: 'ADP export mapping updated.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading ADP settings…</div>;
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Matching your ADP template</AlertTitle>
        <AlertDescription>
          ADP Workforce Now import layouts vary by account. The defaults below export immediately; once you share
          your ADP sample CSV/template, rename the headers here (or toggle columns off) to match it exactly.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Earnings codes &amp; formats</CardTitle>
          <CardDescription>Values ADP expects for regular and overtime lines.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="reg-code">Regular earnings code</Label>
            <Input id="reg-code" value={settings.regular_code} onChange={(e) => setSettings({ ...settings, regular_code: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ot-code">Overtime earnings code</Label>
            <Input id="ot-code" value={settings.overtime_code} onChange={(e) => setSettings({ ...settings, overtime_code: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="date-format">Date format</Label>
            <Select value={settings.date_format} onValueChange={(v) => setSettings({ ...settings, date_format: v as AdpExportSettings['date_format'] })}>
              <SelectTrigger id="date-format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Column mapping</CardTitle>
          <CardDescription>Rename exported headers and toggle optional columns. Required matching fields cannot be turned off.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.columns.map((col) => {
            const required = REQUIRED_FIELDS.includes(col.key);
            return (
              <div key={col.key} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-center border-b pb-3 last:border-0">
                <div className="text-sm font-medium">
                  {FIELD_LABELS[col.key]}
                  {required && <span className="ml-2 text-xs text-muted-foreground">(required)</span>}
                </div>
                <Input
                  value={col.header}
                  onChange={(e) => updateColumn(col.key, { header: e.target.value })}
                  placeholder="ADP column header"
                />
                <Switch
                  checked={col.enabled || required}
                  disabled={required}
                  onCheckedChange={(v) => updateColumn(col.key, { enabled: v })}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save mapping</>}
        </Button>
        <Button variant="outline" onClick={() => setSettings(DEFAULT_SETTINGS)}>
          <RotateCcw className="h-4 w-4 mr-2" />Reset to defaults
        </Button>
      </div>
    </div>
  );
};

export default AdpSettings;