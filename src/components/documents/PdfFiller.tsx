import { useEffect, useMemo, useRef, useState } from 'react';
import { PdfPageCanvas } from './PdfPageCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SignaturePad } from '@/components/SignaturePad';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { PdfField, FieldValues } from './types';

interface Props {
  fileUrl: string;
  fields: PdfField[];
  values: FieldValues;
  onChange: (next: FieldValues) => void;
  readOnly?: boolean;
}

export const PdfFiller = ({ fileUrl, fields, values, onChange, readOnly }: Props) => {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [sigField, setSigField] = useState<PdfField | null>(null);

  const pageFields = useMemo(() => fields.filter(f => f.page === page), [fields, page]);

  const setVal = (id: string, v: string | boolean) => onChange({ ...values, [id]: v });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm">Page {page} of {numPages}</span>
        <Button variant="outline" size="sm" disabled={page >= numPages} onClick={() => setPage(p => p + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="border rounded-md bg-muted/30 p-2 overflow-auto max-h-[70vh]">
        <div className="relative inline-block">
          <PdfPageCanvas
            fileUrl={fileUrl}
            pageNumber={page}
            onRendered={({ width, height, numPages: n }) => {
              setPageSize({ width, height });
              setNumPages(n);
            }}
          />
          {pageSize && pageFields.map(f => {
            const style: React.CSSProperties = {
              position: 'absolute',
              left: f.x * pageSize.width,
              top: f.y * pageSize.height,
              width: f.width * pageSize.width,
              height: f.height * pageSize.height,
            };
            const v = values[f.id];
            if (f.type === 'checkbox') {
              return (
                <div key={f.id} style={style} className="flex items-center justify-center bg-yellow-200/40 border border-yellow-500/60 rounded">
                  <Checkbox
                    checked={!!v}
                    onCheckedChange={(c) => !readOnly && setVal(f.id, !!c)}
                    disabled={readOnly}
                  />
                </div>
              );
            }
            if (f.type === 'signature' || f.type === 'initials') {
              return (
                <button
                  key={f.id}
                  type="button"
                  style={style}
                  disabled={readOnly}
                  onClick={() => !readOnly && setSigField(f)}
                  className="bg-yellow-200/40 border border-yellow-500/60 rounded flex items-center justify-center overflow-hidden p-0.5"
                >
                  {typeof v === 'string' && v.startsWith('data:image') ? (
                    <img src={v} alt={f.label} className="max-h-full max-w-full object-contain" />
                  ) : typeof v === 'string' && v ? (
                    <span className="italic font-signature text-sm truncate px-1" style={{ fontFamily: '"Brush Script MT", cursive' }}>{v}</span>
                  ) : (
                    <span className="text-[10px] text-yellow-900 font-semibold uppercase">
                      Tap to {f.type === 'signature' ? 'sign' : 'initial'}
                    </span>
                  )}
                </button>
              );
            }
            return (
              <Input
                key={f.id}
                style={{ ...style, fontSize: Math.max(10, f.height * pageSize.height * 0.5) }}
                type={f.type === 'date' ? 'date' : 'text'}
                value={typeof v === 'string' ? v : ''}
                onChange={(e) => setVal(f.id, e.target.value)}
                placeholder={f.label}
                disabled={readOnly}
                className="bg-yellow-100/70 border border-yellow-500/60 rounded px-1 py-0 h-auto"
              />
            );
          })}
        </div>
      </div>

      <Dialog open={!!sigField} onOpenChange={(o) => !o && setSigField(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{sigField?.label || 'Signature'}</DialogTitle>
          </DialogHeader>
          {sigField && (
            <SignaturePad
              onSignature={(dataUrl) => {
                setVal(sigField.id, dataUrl);
                setSigField(null);
              }}
              existingSignature={typeof values[sigField.id] === 'string' ? (values[sigField.id] as string) : undefined}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigField(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};