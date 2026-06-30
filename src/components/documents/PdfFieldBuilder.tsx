import { useEffect, useMemo, useState } from 'react';
import { Rnd } from 'react-rnd';
import { pdfjs } from '@/lib/pdfWorker';
import { PdfPageCanvas } from './PdfPageCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PdfField, FieldType, AutofillSource } from './types';

interface Props {
  fileUrl: string;
  initialFields?: PdfField[];
  onChange: (fields: PdfField[]) => void;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'signature', label: 'Signature' },
  { value: 'initials', label: 'Initials' },
];

const AUTOFILL: { value: AutofillSource; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'full_name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'address', label: 'Home address' },
  { value: 'date_of_birth', label: 'Date of birth' },
  { value: 'today', label: "Today's date" },
];

export const PdfFieldBuilder = ({ fileUrl, initialFields = [], onChange }: Props) => {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [fields, setFields] = useState<PdfField[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { onChange(fields); }, [fields, onChange]);

  const pageFields = useMemo(() => fields.filter(f => f.page === page), [fields, page]);
  const selected = fields.find(f => f.id === selectedId) ?? null;

  const addField = (type: FieldType) => {
    const id = crypto.randomUUID();
    const f: PdfField = {
      id, page,
      x: 0.1, y: 0.1,
      width: type === 'checkbox' ? 0.04 : 0.3,
      height: type === 'checkbox' ? 0.03 : 0.04,
      type,
      label: type === 'signature' ? 'Signature' : type === 'initials' ? 'Initials' : 'Field',
      required: true,
      autofill: 'none',
    };
    setFields(prev => [...prev, f]);
    setSelectedId(id);
  };

  const updateField = (id: string, patch: Partial<PdfField>) => {
    setFields(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
  };

  const deleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4">
      {/* Canvas area */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page {page} of {numPages}</span>
          <Button variant="outline" size="sm" disabled={page >= numPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-auto flex flex-wrap gap-1">
            {FIELD_TYPES.map(t => (
              <Button key={t.value} variant="outline" size="sm" onClick={() => addField(t.value)}>
                <Plus className="h-3 w-3 mr-1" />{t.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="border rounded-md bg-muted/30 p-4 overflow-auto max-h-[70vh]">
          <div className="relative inline-block">
            <PdfPageCanvas
              fileUrl={fileUrl}
              pageNumber={page}
              onRendered={({ width, height, numPages: n }) => {
                setPageSize({ width, height });
                setNumPages(n);
              }}
            />
            {pageSize && pageFields.map(field => (
              <Rnd
                key={field.id}
                bounds="parent"
                size={{
                  width: field.width * pageSize.width,
                  height: field.height * pageSize.height,
                }}
                position={{
                  x: field.x * pageSize.width,
                  y: field.y * pageSize.height,
                }}
                onDragStop={(_, d) => updateField(field.id, {
                  x: d.x / pageSize.width,
                  y: d.y / pageSize.height,
                })}
                onResizeStop={(_, __, ref, ___, pos) => updateField(field.id, {
                  width: ref.offsetWidth / pageSize.width,
                  height: ref.offsetHeight / pageSize.height,
                  x: pos.x / pageSize.width,
                  y: pos.y / pageSize.height,
                })}
                onClick={() => setSelectedId(field.id)}
                className={`absolute border-2 ${
                  selectedId === field.id ? 'border-primary bg-primary/20' : 'border-blue-500 bg-blue-500/15'
                } cursor-move flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide select-none`}
              >
                {field.label || field.type}
              </Rnd>
            ))}
          </div>
        </div>
      </div>

      {/* Inspector */}
      <Card className="p-3 space-y-3 h-fit sticky top-2">
        <div className="text-sm font-semibold">Field properties</div>
        {!selected && <div className="text-xs text-muted-foreground">Click a field to edit it, or add one from the buttons above.</div>}
        {selected && (
          <div className="space-y-3">
            <div>
              <Label>Label</Label>
              <Input value={selected.label} onChange={(e) => updateField(selected.id, { label: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={selected.type} onValueChange={(v: FieldType) => updateField(selected.id, { type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auto-fill from profile</Label>
              <Select value={selected.autofill ?? 'none'} onValueChange={(v: AutofillSource) => updateField(selected.id, { autofill: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUTOFILL.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="req">Required</Label>
              <Switch id="req" checked={selected.required} onCheckedChange={(v) => updateField(selected.id, { required: v })} />
            </div>
            <Button variant="destructive" size="sm" className="w-full" onClick={() => deleteField(selected.id)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete field
            </Button>
          </div>
        )}
        <div className="pt-3 border-t text-xs text-muted-foreground">
          {fields.length} field{fields.length === 1 ? '' : 's'} total across {numPages} page{numPages === 1 ? '' : 's'}.
        </div>
      </Card>
    </div>
  );
};