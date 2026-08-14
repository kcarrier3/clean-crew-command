import { useCallback, useEffect, useState } from 'react';
import { FileText, Download, Plus, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { dueDateFromTerms } from '@/lib/billing/kpi';
import {
  convertProposalToInvoice, fetchProposals, updateProposalStatus,
  PROPOSAL_STATUS_LABEL, type Proposal, type ProposalStatus,
} from '@/lib/proposals/proposalApi';
import { saveProposalPdf } from '@/lib/proposals/proposalPdf';
import { money } from './calc';

const STATUS_CLASS: Record<ProposalStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-indigo-100 text-indigo-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  invoiced: 'bg-blue-100 text-blue-800',
};

interface Props {
  leadId?: string | null;
  estimateId?: string | null;
  onNew?: () => void;
  refreshKey?: number;
}

/** Customer proposals generated from estimates, with invoice conversion. */
export function ProposalsList({ leadId, estimateId, onNew, refreshKey }: Props) {
  const { toast } = useToast();
  const { isManager } = useAuth();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState(false);
  const [convert, setConvert] = useState<Proposal | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [terms, setTerms] = useState('Net 30');

  const load = useCallback(async () => {
    try {
      setRows(await fetchProposals({ leadId, estimateId }));
    } catch {
      setRows([]);
    }
  }, [leadId, estimateId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const setStatus = async (p: Proposal, status: ProposalStatus) => {
    setBusy(true);
    try {
      await updateProposalStatus(p.id, status);
      await load();
    } catch (e: any) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const doConvert = async () => {
    if (!convert) return;
    setBusy(true);
    try {
      const inv = await convertProposalToInvoice(convert, { invoiceDate, terms });
      toast({ title: `Invoice ${inv.invoice_number} created`, description: 'Find it under Billing → Invoices.' });
      setConvert(null);
      await load();
    } catch (e: any) {
      toast({ title: 'Could not create invoice', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0 && !onNew) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Customer proposals{rows.length ? ` (${rows.length})` : ''}
          </CardTitle>
          {onNew && (
            <Button variant="ghost" size="sm" onClick={onNew}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No customer-facing proposals yet. Create one from a completed estimate to share pricing without your cost detail.
            </p>
          ) : rows.map(p => (
            <div key={p.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{p.proposal_number}</span>
                <span className="text-sm text-muted-foreground truncate">{p.title}</span>
                <Badge className={`ml-auto text-[10px] ${STATUS_CLASS[p.status]}`}>{PROPOSAL_STATUS_LABEL[p.status]}</Badge>
                <span className="text-sm font-semibold tabular-nums">{money(p.total)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {p.lines.length} line{p.lines.length === 1 ? '' : 's'} · total {p.period_label}
                {p.valid_until ? ` · valid until ${p.valid_until}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => saveProposalPdf(p)}>
                  <Download className="h-3 w-3 mr-1" /> PDF
                </Button>
                {p.status === 'draft' && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(p, 'sent')}>
                    Mark sent
                  </Button>
                )}
                {(p.status === 'draft' || p.status === 'sent') && (
                  <>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(p, 'accepted')}>
                      Mark accepted
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(p, 'declined')}>
                      Declined
                    </Button>
                  </>
                )}
                {p.status === 'accepted' && isManager() && (
                  <Button size="sm" disabled={busy} onClick={() => { setConvert(p); setTerms('Net 30'); }}>
                    <Receipt className="h-3 w-3 mr-1" /> Convert to invoice
                  </Button>
                )}
                {p.status === 'invoiced' && (
                  <span className="text-[11px] text-muted-foreground self-center">Invoiced — see Billing → Invoices.</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!convert} onOpenChange={o => !o && setConvert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert {convert?.proposal_number} to invoice</DialogTitle>
            <DialogDescription>
              Creates a ready-to-send invoice with one line per proposed service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice date</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment terms</Label>
              <Select value={terms} onValueChange={setTerms}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Due {dueDateFromTerms(invoiceDate, terms)}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex justify-between"><span>Total</span><span className="font-semibold tabular-nums">{money(convert?.total || 0)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvert(null)} disabled={busy}>Cancel</Button>
            <Button onClick={doConvert} disabled={busy}>{busy ? 'Creating…' : 'Create invoice'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProposalsList;
