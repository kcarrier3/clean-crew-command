import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isRecurringService, SERVICE_LABELS, type ServiceType } from './serviceTypes';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Default service days for N cleanings/week: weekdays first, then Sat, then Sun. */
function defaultServiceDays(perWeek: number): number[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const n = Math.max(0, Math.min(7, Math.round(perWeek)));
  return order.slice(0, n).sort((a, b) => a - b);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  estimateName: string;
  serviceType: ServiceType;
  clientName?: string | null;
  /** Janitorial: hours per visit and cleanings per week. */
  hoursPerVisit?: number;
  cleaningsPerWeek?: number;
  /** Specialty/project: total budgeted labor hours for the job. */
  projectHours?: number;
  onConverted?: (jobSiteId: string) => void;
}

export function ConvertToAccountDialog({
  open, onOpenChange, estimateId, estimateName, serviceType, clientName,
  hoursPerVisit = 0, cleaningsPerWeek = 0, projectHours = 0, onConverted,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const recurring = isRecurringService(serviceType);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [nightly, setNightly] = useState('0');
  const [budget, setBudget] = useState('0');
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(clientName ? `${clientName}` : estimateName);
    setAddress('');
    setCity('');
    setState('');
    setNightly(String(Math.round((hoursPerVisit || 0) * 100) / 100));
    setBudget(String(Math.round((projectHours || 0) * 100) / 100));
    setDays(defaultServiceDays(cleaningsPerWeek || 0));
  }, [open, clientName, estimateName, hoursPerVisit, projectHours, cleaningsPerWeek]);

  const toggleDay = (d: number) =>
    setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)));

  const monthlyPreview = useMemo(() => {
    const n = parseFloat(nightly) || 0;
    // Rough preview only — the database recomputes the exact monthly allowance.
    return Math.round(n * days.length * 4.33 * 100) / 100;
  }, [nightly, days]);

  const error = (() => {
    if (!name.trim()) return 'Add an account name.';
    if (recurring) {
      if (!(parseFloat(nightly) > 0)) return 'Nightly hours must be greater than zero.';
      if (days.length === 0) return 'Select at least one service day.';
    } else {
      if (!(parseFloat(budget) > 0)) return 'Budgeted hours must be greater than zero.';
      if (!city.trim() || !state.trim()) return 'City and state are required for project accounts (payroll).';
    }
    return null;
  })();

  const convert = async () => {
    if (error) return;
    setBusy(true);
    const payload: Record<string, any> = {
      name: name.trim(),
      client_name: clientName || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      active: true,
      is_recurring_monthly: recurring,
      budget_info: `Created from estimate: ${estimateName}`,
    };
    if (recurring) {
      payload.nightly_hours = parseFloat(nightly) || 0;
      payload.service_days = days;
    } else {
      payload.budgeted_hours = parseFloat(budget) || 0;
      payload.remaining_hours = parseFloat(budget) || 0;
    }

    const { data: site, error: err } = await (supabase as any)
      .from('job_sites').insert(payload).select().single();
    if (err || !site) {
      setBusy(false);
      toast({ title: 'Could not create account', description: err?.message, variant: 'destructive' });
      return;
    }
    await (supabase as any).from('estimates')
      .update({ converted_job_site_id: site.id, converted_at: new Date().toISOString() })
      .eq('id', estimateId);
    setBusy(false);
    onOpenChange(false);
    onConverted?.(site.id);
    toast({ title: 'Account created', description: `${site.name} is now in Account Management.` });
    navigate('/?tab=jobsites');
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Convert to account
          </DialogTitle>
          <DialogDescription>
            Creates a {recurring ? 'recurring' : 'project'} account from this {SERVICE_LABELS[serviceType]} estimate
            with the budgeted hours already filled in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cta-name" className="text-xs">Account name</Label>
            <Input id="cta-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta-address" className="text-xs">Address</Label>
            <Input id="cta-address" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cta-city" className="text-xs">City</Label>
              <Input id="cta-city" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cta-state" className="text-xs">State</Label>
              <Input id="cta-state" value={state} onChange={e => setState(e.target.value)} />
            </div>
          </div>

          {recurring ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cta-nightly" className="text-xs">Nightly hours (from estimate)</Label>
                <Input
                  id="cta-nightly" type="number" inputMode="decimal" step="any"
                  value={nightly} onChange={e => setNightly(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Service days</Label>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d, i) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={days.includes(i)} onCheckedChange={() => toggleDay(i)} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Approx. {monthlyPreview} budgeted hours per month.
              </p>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="cta-budget" className="text-xs">Budgeted project hours (from estimate)</Label>
              <Input
                id="cta-budget" type="number" inputMode="decimal" step="any"
                value={budget} onChange={e => setBudget(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={convert} disabled={busy || !!error}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConvertToAccountDialog;