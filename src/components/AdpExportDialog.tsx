import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Download, Info, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AdpExportRow,
  AdpExportSettings,
  DEFAULT_SETTINGS,
  buildAdpCsv,
  buildAdpRows,
  downloadCsv,
  formatWorkDate,
  normalizeSettings,
  validateRows,
} from '@/lib/adpExport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

const AdpExportDialog = ({ open, onOpenChange, defaultStartDate = '', defaultEndDate = '' }: Props) => {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [settings, setSettings] = useState<AdpExportSettings>(DEFAULT_SETTINGS);
  const [rows, setRows] = useState<AdpExportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewed, setPreviewed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setRows([]);
    setPreviewed(false);
    (async () => {
      const { data } = await supabase
        .from('adp_export_settings')
        .select('columns, regular_code, overtime_code, date_format')
        .eq('singleton', true)
        .maybeSingle();
      setSettings(normalizeSettings(data as any));
    })();
  }, [open, defaultStartDate, defaultEndDate]);

  const issues = useMemo(() => validateRows(rows, settings), [rows, settings]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const totalHours = rows.reduce((s, r) => s + r.total_hours, 0);

  const loadPreview = async () => {
    if (!startDate || !endDate) {
      toast({ title: 'Select a date range', description: 'Choose the pay period start and end dates.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const [entriesRes, profilesRes, sitesRes] = await Promise.all([
        supabase
          .from('time_entries')
          .select('employee_id, job_site_id, clock_in, clock_out, break_minutes')
          .gte('clock_in', `${startDate}T00:00:00`)
          .lte('clock_in', `${endDate}T23:59:59`)
          .not('clock_out', 'is', null)
          .limit(10000),
        supabase
          .from('profiles')
          .select('id, first_name, last_name, employee_id, adp_file_number, adp_department_code, hourly_rate'),
        supabase
          .from('job_sites')
          .select('id, name, city, state, tax_jurisdiction, job_cost_code, location_code'),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (sitesRes.error) throw sitesRes.error;

      const built = buildAdpRows(
        (entriesRes.data || []) as any,
        (profilesRes.data || []) as any,
        (sitesRes.data || []) as any,
        settings
      );
      setRows(built);
      setPreviewed(true);
      if (built.length === 0) {
        toast({ title: 'No punches found', description: 'No completed time entries in that range.' });
      }
    } catch (e: any) {
      console.error('ADP preview failed', e);
      toast({ title: 'Preview failed', description: e.message || 'Could not load payroll data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (rows.length === 0 || errors.length > 0) return;
    setExporting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      // Snapshot the batch so later job-address edits never change this export.
      const { data: batch, error: batchError } = await supabase
        .from('payroll_export_batches')
        .insert({
          period_start: startDate,
          period_end: endDate,
          exported_by: userData.user?.id ?? null,
          row_count: rows.length,
          total_hours: Number(totalHours.toFixed(2)),
          notes: 'ADP Workforce Now CSV export',
        })
        .select('id')
        .single();
      if (batchError) throw batchError;

      const snapshot = rows.map((r) => ({
        batch_id: batch.id,
        employee_id: r.employee_id,
        crew_compass_employee_code: r.crew_compass_employee_code,
        adp_file_number: r.adp_file_number,
        employee_name: r.employee_name,
        work_date: r.work_date,
        earnings_code: r.earnings_code,
        regular_hours: r.regular_hours,
        overtime_hours: r.overtime_hours,
        total_hours: r.total_hours,
        hourly_rate: r.hourly_rate,
        job_site_id: r.job_site_id,
        job_name: r.job_name,
        job_cost_code: r.job_cost_code,
        city: r.city,
        state: r.state,
        tax_jurisdiction: r.tax_jurisdiction,
        location_code: r.location_code,
        department_code: r.department_code,
      }));

      for (let i = 0; i < snapshot.length; i += 500) {
        const { error } = await supabase.from('payroll_export_rows').insert(snapshot.slice(i, i + 500));
        if (error) throw error;
      }

      downloadCsv(`adp-payroll-${startDate}-to-${endDate}.csv`, buildAdpCsv(rows, settings));
      toast({ title: 'ADP CSV exported', description: `${rows.length} rows snapshotted and downloaded.` });
      onOpenChange(false);
    } catch (e: any) {
      console.error('ADP export failed', e);
      toast({ title: 'Export failed', description: e.message || 'Could not save the payroll snapshot.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export for ADP Workforce Now</DialogTitle>
          <DialogDescription>
            One row per employee, work date, job and earnings code so multiple jobs or municipalities in a day
            stay separate for local tax reporting.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Layout is adjustable</AlertTitle>
          <AlertDescription>
            ADP Workforce Now import layouts differ by account. This uses a sensible default layout — headers,
            optional columns and earnings codes can be matched to your ADP template under Settings → ADP Payroll
            once you share a sample CSV.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="adp-start">Pay period start</Label>
            <Input id="adp-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPreviewed(false); }} />
          </div>
          <div>
            <Label htmlFor="adp-end">Pay period end</Label>
            <Input id="adp-end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPreviewed(false); }} />
          </div>
          <div className="flex items-end">
            <Button onClick={loadPreview} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</> : 'Preview rows'}
            </Button>
          </div>
        </div>

        {previewed && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">{rows.length} rows</Badge>
              <Badge variant="secondary">{totalHours.toFixed(2)} hours</Badge>
              {errors.length > 0 ? (
                <Badge variant="destructive">{errors.length} blocking issue{errors.length === 1 ? '' : 's'}</Badge>
              ) : (
                <Badge className="gap-1"><ShieldCheck className="h-3 w-3" />Ready to export</Badge>
              )}
              {warnings.length > 0 && <Badge variant="outline">{warnings.length} warning{warnings.length === 1 ? '' : 's'}</Badge>}
            </div>

            {issues.length > 0 && (
              <Alert variant={errors.length > 0 ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation summary</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-40 mt-2">
                    <ul className="space-y-1 text-sm">
                      {issues.slice(0, 60).map((issue, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{issue.severity === 'error' ? 'Error' : 'Warning'}:</span>{' '}
                          {issue.employee_name} — {formatWorkDate(issue.work_date, settings.date_format)} — {issue.message}
                        </li>
                      ))}
                      {issues.length > 60 && <li className="text-muted-foreground">…and {issues.length - 60} more.</li>}
                    </ul>
                  </ScrollArea>
                  {errors.length === 0 && <p className="mt-2">Warnings do not block the export.</p>}
                </AlertDescription>
              </Alert>
            )}

            {rows.length > 0 && (
              <div className="border rounded-md max-h-72 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File #</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Reg</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((r, i) => (
                      <TableRow key={`${r.employee_id}-${r.work_date}-${r.job_site_id}-${r.earnings_code}-${i}`}>
                        <TableCell>{r.adp_file_number || <span className="text-destructive">missing</span>}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.employee_name}</TableCell>
                        <TableCell>{formatWorkDate(r.work_date, settings.date_format)}</TableCell>
                        <TableCell>{r.earnings_code}</TableCell>
                        <TableCell className="text-right">{r.regular_hours.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{r.overtime_hours.toFixed(2)}</TableCell>
                        <TableCell>{r.job_name || '—'}</TableCell>
                        <TableCell>{r.city || '—'}</TableCell>
                        <TableCell>{r.tax_jurisdiction || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 100 && (
                  <p className="p-2 text-sm text-muted-foreground">Showing first 100 of {rows.length} rows. The CSV contains all rows.</p>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Exporting saves an immutable snapshot of these rows (job, city, jurisdiction, cost code) so later job
              address edits never change this payroll period.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting || rows.length === 0 || errors.length > 0}>
            {exporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting…</> : <><Download className="h-4 w-4 mr-2" />Download ADP CSV</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdpExportDialog;