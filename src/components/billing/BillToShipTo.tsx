import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, MapPin, Percent } from 'lucide-react';
import type { AddressLike, ResolvedTax } from '@/lib/billing/taxRates';

export type EditableAddress = {
  name: string; address: string; city: string; state: string; zip: string;
};

export const toEditable = (a?: AddressLike | null): EditableAddress => ({
  name: a?.name ?? '', address: a?.address ?? '', city: a?.city ?? '', state: a?.state ?? '', zip: a?.zip ?? '',
});

const Fields = ({ value, onChange, idPrefix }: {
  value: EditableAddress; onChange: (v: EditableAddress) => void; idPrefix: string;
}) => (
  <div className="grid gap-2">
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}_name`} className="text-xs">Name</Label>
      <Input id={`${idPrefix}_name`} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} />
    </div>
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}_addr`} className="text-xs">Street</Label>
      <Input id={`${idPrefix}_addr`} value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} />
    </div>
    <div className="grid grid-cols-4 gap-2">
      <div className="col-span-2 space-y-1">
        <Label htmlFor={`${idPrefix}_city`} className="text-xs">City</Label>
        <Input id={`${idPrefix}_city`} value={value.city} onChange={e => onChange({ ...value, city: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}_state`} className="text-xs">State</Label>
        <Input id={`${idPrefix}_state`} value={value.state} onChange={e => onChange({ ...value, state: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}_zip`} className="text-xs">ZIP</Label>
        <Input id={`${idPrefix}_zip`} value={value.zip} onChange={e => onChange({ ...value, zip: e.target.value })} />
      </div>
    </div>
  </div>
);

interface Props {
  billTo: EditableAddress;
  shipTo: EditableAddress;
  onBillTo: (v: EditableAddress) => void;
  onShipTo: (v: EditableAddress) => void;
  resolved?: ResolvedTax | null;
  taxOverridden?: boolean;
  onResetTax?: () => void;
}

/** Bill to / Ship to addresses. Tax is driven by the Ship to city (where the work is performed). */
export const BillToShipTo = ({ billTo, shipTo, onBillTo, onShipTo, resolved, taxOverridden, onResetTax }: Props) => (
  <div className="space-y-3">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Bill to</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => onShipTo({ ...billTo })}>
            <Copy className="h-3 w-3 mr-1" /> Copy to ship to
          </Button>
        </div>
        <Fields value={billTo} onChange={onBillTo} idPrefix="bill" />
      </div>
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Ship to / service address</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => onBillTo({ ...shipTo })}>
            <Copy className="h-3 w-3 mr-1" /> Copy to bill to
          </Button>
        </div>
        <Fields value={shipTo} onChange={onShipTo} idPrefix="ship" />
      </div>
    </div>
    {resolved && (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Percent className="h-3.5 w-3.5" />
        <span>
          Tax auto-calculated from the ship-to city:{' '}
          <Badge variant="secondary" className="font-normal">
            {resolved.jurisdiction ?? 'No jurisdiction match'} — {resolved.rate.toFixed(2)}%
          </Badge>
        </span>
        {taxOverridden && (
          <>
            <span className="text-amber-600">Rate manually overridden.</span>
            {onResetTax && (
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onResetTax}>
                Use {resolved.rate.toFixed(2)}%
              </Button>
            )}
          </>
        )}
      </div>
    )}
  </div>
);

export default BillToShipTo;
