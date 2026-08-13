import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Mail, Search } from 'lucide-react';
import { format } from 'date-fns';
import { db } from './billingApi';
import { EMAIL_STATUS_CLASS, EMAIL_STATUS_LABEL } from '@/lib/billing/types';

interface Row {
  id: string;
  subject: string;
  status: string;
  to_recipients: string[];
  cc_recipients: string[];
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  created_by: string | null;
  invoice: { invoice_number: string; customer_name: string | null } | null;
}

/** Read-only audit view of every invoice email attempt. */
export const EmailActivityTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [senders, setSenders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [since, setSince] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await db.from('billing_email_messages')
        .select('*, invoice:billing_invoices(invoice_number, customer_name)')
        .order('created_at', { ascending: false })
        .limit(500);
      const list = (data ?? []) as Row[];
      setRows(list);

      const ids = Array.from(new Set(list.map(r => r.created_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profiles } = await db.from('profiles')
          .select('id, first_name, last_name').in('id', ids);
        setSenders(Object.fromEntries((profiles ?? []).map((p: any) =>
          [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'])));
      }
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter(r => status === 'all' || r.status === status)
      .filter(r => !since || (r.created_at ?? '') >= since)
      .filter(r => !needle
        || (r.invoice?.invoice_number ?? '').toLowerCase().includes(needle)
        || (r.invoice?.customer_name ?? '').toLowerCase().includes(needle)
        || r.to_recipients.join(',').toLowerCase().includes(needle)
        || r.subject.toLowerCase().includes(needle));
  }, [rows, q, status, since]);

  const stamp = (v: string | null) => (v ? format(new Date(v), 'MMM d, yyyy h:mm a') : '—');

  return (
    <Card>
      <CardHeader className="pb-3 gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Email activity</CardTitle>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} className="pl-8 w-full sm:w-60"
                   placeholder="Search invoice, customer, recipient" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(EMAIL_STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={since} onChange={e => setSince(e.target.value)}
                 aria-label="Sent on or after" className="w-40" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading email activity…</p>
        ) : !visible.length ? (
          <p className="text-sm text-muted-foreground">No invoice emails match these filters yet.</p>
        ) : visible.map(r => (
          <div key={r.id} className="rounded-md border p-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{r.invoice?.invoice_number ?? 'Invoice'}</span>
              <span className="text-sm text-muted-foreground truncate">{r.invoice?.customer_name ?? '—'}</span>
              <Badge className={`ml-auto ${EMAIL_STATUS_CLASS[r.status] ?? ''}`}>
                {EMAIL_STATUS_LABEL[r.status] ?? r.status}
              </Badge>
            </div>
            <p className="text-sm truncate">{r.subject}</p>
            <p className="text-xs text-muted-foreground break-words">
              To {r.to_recipients.join(', ') || '—'}
              {r.cc_recipients?.length ? ` · CC ${r.cc_recipients.join(', ')}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Sent {stamp(r.sent_at)} · Delivered {stamp(r.delivered_at)}
              {r.opened_at ? ` · Opened ${stamp(r.opened_at)}` : ''}
              {r.created_by ? ` · By ${senders[r.created_by] ?? '—'}` : ''}
            </p>
            {r.failure_reason && (
              <p className="text-xs text-destructive flex items-start gap-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Failed {stamp(r.failed_at)} — {r.failure_reason}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default EmailActivityTab;