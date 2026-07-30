import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { EstimatorShell } from '@/components/estimator/EstimatorShell';
import { FALLBACK_DEFAULTS, money, type EstimatorDefaults } from '@/components/estimator/calc';

const FIELDS: { key: keyof EstimatorDefaults; label: string; step: string; hint?: string }[] = [
  { key: 'base_wage', label: 'Default base wage ($/hr)', step: '0.25' },
  { key: 'labor_burden_percent', label: 'Labor burden (%)', step: '0.5', hint: 'Taxes, insurance, workers comp' },
  { key: 'supply_low', label: 'Supply preset — low ($/labor hr)', step: '0.05' },
  { key: 'supply_standard', label: 'Supply preset — standard ($/labor hr)', step: '0.05' },
  { key: 'supply_high', label: 'Supply preset — high ($/labor hr)', step: '0.05' },
  { key: 'default_production_rate', label: 'Default production rate (sq ft/hr)', step: '50' },
  { key: 'weeks_per_month', label: 'Weeks per month', step: '0.01' },
  { key: 'default_overhead_percent', label: 'Default overhead (%)', step: '0.5' },
  { key: 'default_target_margin_percent', label: 'Default target profit (%)', step: '0.5' },
];

export default function EstimatorSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, canApproveEstimate } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [values, setValues] = useState<EstimatorDefaults>(FALLBACK_DEFAULTS);
  const [rates, setRates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: r }] = await Promise.all([
        (supabase as any).from('estimate_settings').select('*').limit(1).maybeSingle(),
        (supabase as any).from('estimate_production_rates').select('*').eq('active', true).order('building_type'),
      ]);
      if (s) {
        setId(s.id);
        setValues({
          base_wage: Number(s.base_wage),
          labor_burden_percent: Number(s.labor_burden_percent),
          supply_low: Number(s.supply_low),
          supply_standard: Number(s.supply_standard),
          supply_high: Number(s.supply_high),
          default_production_rate: Number(s.default_production_rate),
          weeks_per_month: Number(s.weeks_per_month),
          default_overhead_percent: Number(s.default_overhead_percent),
          default_target_margin_percent: Number(s.default_target_margin_percent),
        });
      }
      setRates(r || []);
    };
    if (user) load();
  }, [user]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('estimate_settings')
      .update({ ...values, updated_by: user?.id })
      .eq('id', id);
    setSaving(false);
    if (error) toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    else toast({ title: 'Estimator defaults saved' });
  };

  const saveRate = async (rateId: string, sqft: number) => {
    const { error } = await (supabase as any)
      .from('estimate_production_rates')
      .update({ sqft_per_hour: sqft })
      .eq('id', rateId);
    if (error) toast({ title: 'Could not save rate', description: error.message, variant: 'destructive' });
  };

  if (loading) return null;

  if (!canApproveEstimate()) {
    return (
      <EstimatorShell title="Estimator settings" backTo="/estimates">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Only an owner or admin can change estimator defaults.
          </CardContent>
        </Card>
      </EstimatorShell>
    );
  }

  const loadedRate = values.base_wage * (1 + values.labor_burden_percent / 100);

  return (
    <EstimatorShell
      title="Estimator settings"
      subtitle="Company defaults for new estimates"
      backTo="/estimates"
      actions={<Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>}
    >
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Defaults</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(f => (
              <div key={f.key}>
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number"
                  step={f.step}
                  inputMode="decimal"
                  value={values[f.key] as number}
                  onChange={e => setValues({ ...values, [f.key]: parseFloat(e.target.value) || 0 })}
                />
                {f.hint && <p className="text-[11px] text-muted-foreground mt-1">{f.hint}</p>}
              </div>
            ))}
            <div className="sm:col-span-2 rounded-md bg-muted p-3 text-sm">
              Loaded labor rate: <strong>{money(loadedRate)}/hr</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Production rates (sq ft / hour)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rates.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 text-sm truncate">
                  {r.building_type} — <span className="text-muted-foreground">{r.area_type}</span>
                </div>
                <Input
                  type="number"
                  step="50"
                  inputMode="numeric"
                  className="w-28"
                  defaultValue={r.sqft_per_hour}
                  onBlur={e => saveRate(r.id, parseInt(e.target.value, 10) || r.sqft_per_hour)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </EstimatorShell>
  );
}