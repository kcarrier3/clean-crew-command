import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { money } from '@/lib/billing/types';
import { IssueCreditDialog } from './IssueCreditDialog';
import { CREDIT_STATUS_LABEL, fetchCredits, type CustomerCredit } from './creditsApi';

export const CompanyCreditsPanel = ({ companyId, companyName }: { companyId: string; companyName?: string }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CustomerCredit[]>([]);
  const [open, setOpen] = useState(false);

  const load = () => fetchCredits({ companyId }).then(setRows).catch(e =>
    toast({ title: 'Could not load credits', description: e.message, variant: 'destructive' })
  );
  useEffect(() => { load(); }, [companyId]);

  const remaining = rows.filter(r => r.status === 'available').reduce((s, r) => s + Number(r.remaining_amount || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Credits</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Issue credit</Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">Available balance {money(remaining)}</p>
        {!rows.length && <p className="text-muted-foreground text-sm">No credits for {companyName || 'this customer'} yet.</p>}
        {rows.map(c => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
            <div>
              <span className="font-medium">{c.reason}</span>
              <Badge variant="outline" className="ml-2">{CREDIT_STATUS_LABEL[c.status] ?? c.status}</Badge>
              {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
            </div>
            <div className="text-right tabular-nums">
              <p>{money(c.amount)}</p>
              <p className="text-xs text-muted-foreground">Left {money(c.remaining_amount)}</p>
            </div>
          </div>
        ))}
      </CardContent>
      <IssueCreditDialog open={open} onOpenChange={setOpen} onIssued={load} defaultCompanyId={companyId} />
    </Card>
  );
};
