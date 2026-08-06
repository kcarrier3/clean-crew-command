import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileArchive, CheckCircle2, AlertCircle, ShieldCheck, Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { runSalesforceImport, type ImportReport } from './salesforce/importer';
import { reconcileStorage, type ReconcileReport } from './salesforce/reconcile';
import { backfillOpportunityAccounts, type BackfillReport } from './salesforce/backfillAccounts';
import { toCsv } from './salesforce/sfUtils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}

export function SalesforceImportDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [recon, setRecon] = useState<ReconcileReport | null>(null);
  const [reconRunning, setReconRunning] = useState(false);
  const [backfill, setBackfill] = useState<BackfillReport | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);

  const reset = () => {
    setFiles([]); setProgress(0); setStatus(''); setReport(null); setRecon(null); setBackfill(null); setConfirmed(false);
  };

  const handleImport = async () => {
    if (!files.length) return;
    setRunning(true); setReport(null); setProgress(2);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error('You must be signed in.');
      const result = await runSalesforceImport(files, uid, (pct, s) => { setProgress(pct); setStatus(s); });
      setStatus('Reconciling account relationships…');
      setBackfill(await backfillOpportunityAccounts(uid));
      setReport(result);
      onImported();
      const totals = Object.values(result.stats).reduce(
        (acc, s) => ({ i: acc.i + s.inserted, u: acc.u + s.updated }), { i: 0, u: 0 },
      );
      toast({ title: 'Import complete', description: `${totals.i} created, ${totals.u} updated` });
    } catch (err: any) {
      setReport({ preflight: [], stats: {}, relationshipExceptions: [], bodiesMissing: [], fatalError: err?.message || String(err) });
      toast({ title: 'Import failed', description: err?.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const handleBackfill = async () => {
    setBackfillRunning(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error('You must be signed in.');
      const r = await backfillOpportunityAccounts(uid);
      setBackfill(r);
      onImported();
      toast({
        title: 'Account reconciliation complete',
        description: `${r.linkedBySalesforceId + r.linkedByName} opportunities linked · ${r.accountsCreated} accounts created`,
      });
    } catch (e: any) {
      toast({ title: 'Reconciliation failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBackfillRunning(false);
    }
  };

  const handleReconcile = async (autoReconnect: boolean) => {
    setReconRunning(true);
    try {
      const r = await reconcileStorage({ autoReconnect });
      setRecon(r);
      toast({ title: 'Storage scan complete', description: `${r.linked} linked · ${r.storageOnly} storage-only · ${r.dbOnly} database-only` });
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e?.message, variant: 'destructive' });
    } finally {
      setReconRunning(false);
    }
  };

  const downloadExceptions = () => {
    if (!report) return;
    const rows: Record<string, string | number>[] = [];
    Object.values(report.stats).forEach((s) => {
      s.skipped.forEach((o) => rows.push({ object: s.object, outcome: 'skipped', salesforce_id: o.sfId, record: o.label, reason: o.reason }));
      s.failed.forEach((o) => rows.push({ object: s.object, outcome: 'failed', salesforce_id: o.sfId, record: o.label, reason: o.reason }));
    });
    report.relationshipExceptions.forEach((o) => rows.push({ object: 'relationship', outcome: 'unresolved', salesforce_id: o.sfId, record: o.label, reason: o.reason }));
    report.bodiesMissing.forEach((o) => rows.push({ object: 'binary', outcome: 'body_missing', salesforce_id: o.sfId, record: o.label, reason: o.reason }));
    if (!rows.length) { toast({ title: 'Nothing to export', description: 'No exceptions were recorded.' }); return; }
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `salesforce-import-exceptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = report ? Object.values(report.stats).filter((s) => s.sourceRows > 0 || s.inserted || s.updated || s.failed.length) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" /> Import from Salesforce Export</DialogTitle>
          <DialogDescription>
            Upload <strong>every part</strong> of your <em>Setup → Data Export</em> (WE_…_1.ZIP, _2.ZIP, …) at once, or
            individual CSVs. Accounts, Contacts, Opportunities, Tasks, Notes, Classic Attachments, Salesforce Files and
            Enhanced Notes are all imported and linked to their true parent record.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {!report && (
            <div className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>This is a repair / upsert — nothing is deleted</AlertTitle>
                <AlertDescription className="text-sm">
                  Existing CRM records are matched by their Salesforce ID and updated in place. No accounts, contacts,
                  opportunities, notes, files or stored documents are cleared, and running this twice will not create
                  duplicates.
                </AlertDescription>
              </Alert>

              <Input
                type="file"
                accept=".zip,.csv,application/zip,application/x-zip-compressed,text/csv"
                multiple
                disabled={running}
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              {files.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  {files.map((f, i) => <li key={i}>{f.name} — {(f.size / 1024 / 1024).toFixed(2)} MB</li>)}
                </ul>
              )}

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  disabled={running}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>I understand this updates and adds records and will not clear existing CRM data.</span>
              </label>

              {running && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground">{status}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium">Storage recovery scan</p>
                <p className="text-xs text-muted-foreground">
                  Read-only comparison of stored documents against file records. Nothing is deleted; an object is only
                  re-linked when its Salesforce identity and parent are unambiguous.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={reconRunning || running} onClick={() => handleReconcile(false)}>
                    <RefreshCw className="h-4 w-4 mr-2" />{reconRunning ? 'Scanning…' : 'Scan only'}
                  </Button>
                  <Button variant="outline" size="sm" disabled={reconRunning || running} onClick={() => handleReconcile(true)}>
                    Scan &amp; reconnect unambiguous
                  </Button>
                </div>
                {recon && (
                  <div className="text-sm space-y-1 pt-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{recon.storageObjects} stored objects</Badge>
                      <Badge variant="secondary">{recon.dbRows} file records</Badge>
                      <Badge variant="outline">{recon.linked} linked</Badge>
                      <Badge variant="outline">{recon.storageOnly} storage-only</Badge>
                      <Badge variant="outline">{recon.dbOnly} database-only</Badge>
                      {recon.reconnected > 0 && <Badge>{recon.reconnected} reconnected</Badge>}
                    </div>
                    {recon.needsReview.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {recon.needsReview.length} object(s) kept for manual review — none were deleted.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {report && (
            <div className="space-y-4">
              {report.fatalError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import failed</AlertTitle>
                  <AlertDescription>{report.fatalError}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" /> Import finished
                </div>
              )}

              {report.preflight.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Source parts</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {report.preflight.map((p, i) => (
                      <div key={i}>
                        <span className="font-mono">{p.fileName}</span> — {p.binaryEntries} binaries;{' '}
                        {Object.entries(p.objects).map(([o, n]) => `${o}: ${n}`).join(', ') || 'no recognised CSVs'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-1 pr-2">Object</th>
                        <th className="py-1 pr-2 text-right">Source</th>
                        <th className="py-1 pr-2 text-right">Created</th>
                        <th className="py-1 pr-2 text-right">Updated</th>
                        <th className="py-1 pr-2 text-right">Skipped</th>
                        <th className="py-1 text-right">Failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s) => (
                        <tr key={s.object} className="border-b last:border-0">
                          <td className="py-1 pr-2">{s.object}</td>
                          <td className="py-1 pr-2 text-right">{s.sourceRows}</td>
                          <td className="py-1 pr-2 text-right">{s.inserted}</td>
                          <td className="py-1 pr-2 text-right">{s.updated}</td>
                          <td className="py-1 pr-2 text-right">{s.skipped.length}</td>
                          <td className={`py-1 text-right ${s.failed.length ? 'text-destructive font-medium' : ''}`}>{s.failed.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {report.bodiesMissing.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{report.bodiesMissing.length} record(s) had no binary in the export</AlertTitle>
                  <AlertDescription className="text-xs">
                    These exist in the CSVs but their file body was not in the ZIP part(s) you uploaded. Include the
                    remaining export parts and re-run to attach them.
                  </AlertDescription>
                </Alert>
              )}

              {report.relationshipExceptions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Relationship exceptions ({report.relationshipExceptions.length})</p>
                  <div className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto">
                    {report.relationshipExceptions.slice(0, 50).map((o, i) => (
                      <div key={i}>• {o.label || o.sfId}: {o.reason}</div>
                    ))}
                    {report.relationshipExceptions.length > 50 && <div>…download the CSV for the full list.</div>}
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={downloadExceptions}>
                <Download className="h-4 w-4 mr-2" /> Download exception report (CSV)
              </Button>
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {!report ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cancel</Button>
              <Button onClick={handleImport} disabled={!files.length || running || !confirmed}>
                <Upload className="h-4 w-4 mr-2" />{running ? 'Importing…' : 'Import / repair'}
              </Button>
            </>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}