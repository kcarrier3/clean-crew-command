import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { downloadCsv } from '@/lib/adpExport';
import {
  buildBooksGptRows, booksGptCsv, booksGptIssues, EXPORTABLE_STATUSES,
  type ExportInvoice, type ExportLine, type BooksGptRow,
} from '@/lib/billing/booksgptExport';
import { money } from '@/lib/billing/types';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };
const today = () => iso(new Date());

/** Pages past the 1,000-row response cap. */
async function pageAll<T>(build: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await build().range(start, start + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

interface Props { open: boolean; onOpenChange: (o: boolean) => void }

export const BooksGptExportDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BooksGptRow[]>([]);

  useEffect(() => {
    if (!open || !from || !to) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const invoices = await pageAll<ExportInvoice>(() => db.from('billing_invoices')
          .select('id, invoice_number, status, invoice_date, due_date, payment_terms, customer_name, billing_email, po_number, subtotal, tax_rate, tax, total, notes')
          .gte('invoice_date', from).lte('invoice_date', to)
          .in('status', EXPORTABLE_STATUSES).order('id'));
        const ids = invoices.map(i => i.id);
        let lines: ExportLine[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const part = await pageAll<ExportLine>(() => db.from('billing_invoice_items')
            .select('invoice_id, description, quantity, unit_price, line_total, sort_order, billing_item_id')
            .in('invoice_id', chunk).order('id'));
          lines = lines.concat(part);
        }
        const { data: items } = await db.from('billing_items').select('id, name');
        const names: Record<string, string> = {};
        (items ?? []).forEach((it: any) => { names[it.id] = it.name; });
        if (!cancelled) setRows(buildBooksGptRows(invoices, lines, names, { from, to }));
      } catch (e: any) {
        if (!cancelled) toast({ title: 'Could not load invoices', description: e.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, from, to]);

  const issues = useMemo(() => booksGptIssues(rows), [rows]);
  const total = rows.reduce((s, r) => s + r.total, 0);

  const download = () => {
    downloadCsv(`booksgpt-invoices-${from}-to-${to}.csv`, booksGptCsv(rows));
    toast({ title: 'File downloaded', description: `${rows.length} invoice${rows.length === 1 ? '' : 's'} ready to upload to BooksGPT.` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export invoices for BooksGPT</DialogTitle>
          <DialogDescription>
            Makes a spreadsheet with one row per invoice. In BooksGPT, go to Sales → Invoices → More invoice actions → Upload invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="bg-from">Invoice date from</Label>
            <Input id="bg-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bg-to">to</Label>
            <Input id="bg-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md border p-3 text-sm">
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <p><span className="font-medium">{rows.length}</span> invoice{rows.length === 1 ? '' : 's'} · {money(total)} total</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Drafts and voided invoices are left out. Exporting the same invoice twice is safe — BooksGPT skips invoice numbers it already has.
          </p>
        </div>

        {issues.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1">
            <p className="font-medium text-destructive">BooksGPT will skip these until they're fixed:</p>
            <ul className="list-disc pl-5 text-xs">{issues.map(i => <li key={i}>{i}</li>)}</ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Every customer must already exist in BooksGPT with the same name — BooksGPT won't create customers from a spreadsheet.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={download} disabled={loading || !rows.length}>
            <Download className="h-4 w-4 mr-1" /> Download file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BooksGptExportDialog;
