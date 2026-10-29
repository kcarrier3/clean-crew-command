import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db } from './billingApi';

/** Exempt customers missing a certificate or past the expiration date. */
export const TaxExemptionGapsCard = () => {
  const [rows, setRows] = useState<{ id: string; name: string; gap: string; tax_exempt_certificate_expires: string | null }[]>([]);

  useEffect(() => {
    db.from('billing_tax_exemption_gaps').select('id, name, gap, tax_exempt_certificate_expires').order('name')
      .then(({ data }: { data: typeof rows | null }) => setRows(data ?? []));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tax exemptions to review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!rows.length && <p className="text-sm text-muted-foreground">No exempt customers are missing a certificate or past expiration.</p>}
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{r.name}</span>
            <Badge variant="secondary">{r.gap}{r.tax_exempt_certificate_expires ? ` · ${r.tax_exempt_certificate_expires}` : ''}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
