import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Camera, Upload, Loader2, AlertTriangle, Check, Trash2, Plus, Search, ShieldAlert, Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { money } from '@/lib/billing/types';
import {
  applyIntake, evaluateAutoPost, fetchAutoApplyEnabled, fetchOpenInvoices, findDuplicateChecks,
  imageToDataUrl, matchStubInvoices, saveIntake, uploadCheckImage,
  type AutoPostDecision, type IntakeDraft, type MatchLine, type OpenInvoice,
} from '@/lib/billing/checkIntake';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Optional existing "Review needed" intake to finish. */
  intake?: any | null;
  onSaved?: () => void;
}

type Step = 'check' | 'stub' | 'processing' | 'review' | 'match' | 'confirm' | 'done';
const STEPS: { key: Step; label: string }[] = [
  { key: 'check', label: 'Check photo' },
  { key: 'stub', label: 'Stub photo' },
  { key: 'review', label: 'Review details' },
  { key: 'match', label: 'Match invoices' },
  { key: 'confirm', label: 'Confirm & apply' },
];

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Small capture control that supports both mobile camera and desktop upload. */
const CaptureCard = ({ label, hint, image, onPick, busy }: {
  label: string; hint: string; image: string | null; busy: boolean;
  onPick: (file: File) => void;
}) => {
  const cam = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onPick(f);
  };
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={pick} />
      {image ? (
        <img src={image} alt={label} className="w-full rounded-lg border object-contain max-h-64" />
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No image yet
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => cam.current?.click()}>
          <Camera className="h-4 w-4 mr-1" /> Take photo
        </Button>
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => file.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Upload image
        </Button>
      </div>
    </div>
  );
};

export const ReceiveCheckDialog = ({ open, onOpenChange, intake, onSaved }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('check');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [checkImage, setCheckImage] = useState<string | null>(null);
  const [stubImage, setStubImage] = useState<string | null>(null);

  const [payer, setPayer] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkDate, setCheckDate] = useState('');
  const [receivedDate, setReceivedDate] = useState(today());
  const [depositDate, setDepositDate] = useState(today());
  const [depositAccount, setDepositAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [warnings, setWarnings] = useState<string[]>([]);
  const [extraction, setExtraction] = useState<Record<string, unknown>>({});
  const [lines, setLines] = useState<MatchLine[]>([]);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [search, setSearch] = useState('');
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [dupAcknowledged, setDupAcknowledged] = useState(false);
  const [exceptionAcknowledged, setExceptionAcknowledged] = useState(false);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [decision, setDecision] = useState<AutoPostDecision | null>(null);
  const [result, setResult] = useState<{ amount: number; count: number; checkNumber: string } | null>(null);

  const reset = () => {
    setStep('check'); setCheckImage(null); setStubImage(null);
    setPayer(''); setCheckNumber(''); setCheckDate(''); setReceivedDate(today());
    setDepositDate(today()); setDepositAccount(''); setAmount(''); setNotes('');
    setWarnings([]); setExtraction({}); setLines([]); setSearch('');
    setDuplicates([]); setDupAcknowledged(false); setExceptionAcknowledged(false);
    setIntakeId(null); setDecision(null); setResult(null);
  };

  useEffect(() => {
    if (!open) return;
    reset();
    fetchOpenInvoices().then(setInvoices).catch(() => setInvoices([]));
    fetchAutoApplyEnabled().then(setAutoEnabled).catch(() => setAutoEnabled(true));
    if (intake) {
      setIntakeId(intake.id);
      setPayer(intake.payer_name ?? '');
      setCheckNumber(intake.check_number ?? '');
      setCheckDate(intake.check_date ?? '');
      setReceivedDate(intake.received_date ?? today());
      setDepositDate(intake.deposit_date ?? '');
      setDepositAccount(intake.deposit_account_label ?? '');
      setAmount(intake.amount ? String(Number(intake.amount).toFixed(2)) : '');
      setNotes(intake.notes ?? '');
      setWarnings(Array.isArray(intake.warnings) ? intake.warnings : []);
      setExtraction(intake.extraction ?? {});
      if (Array.isArray(intake.blocked_reasons) && intake.blocked_reasons.length) {
        setDecision({ eligible: false, reasons: intake.blocked_reasons, confidence: (intake.confidence ?? {}) as any });
      }
      setStep('review');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intake]);

  /** Rehydrate saved proposals once the open invoice list is available. */
  useEffect(() => {
    if (!open || !intake || !invoices.length || lines.length) return;
    const saved = Array.isArray(intake.proposed_allocations) ? intake.proposed_allocations : [];
    setLines(saved.map((a: any) => ({
      raw: a.invoice_number ?? '',
      invoice: invoices.find(i => i.id === a.invoice_id) ?? null,
      amount: a.amount ? String(Number(a.amount).toFixed(2)) : '',
      source: 'stub' as const,
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intake, invoices]);

  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  /** Runs extraction and returns the parsed values so the auto-post gate can use them immediately. */
  const extract = async (nextCheck: string | null, nextStub: string | null) => {
    if (!nextCheck && !nextStub) return null;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-check-intake', {
        body: { checkImage: nextCheck, stubImage: nextStub },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = data as any;

      setExtraction(res);
      const nextWarnings: string[] = Array.isArray(res.warnings) ? res.warnings : [];
      setWarnings(nextWarnings);
      const nextPayer = res.check?.payer_name || res.stub?.payer_name || '';
      if (nextPayer) setPayer(nextPayer);
      if (res.check?.check_number) setCheckNumber(res.check.check_number);
      if (res.check?.check_date) setCheckDate(res.check.check_date);
      if (res.check?.amount) setAmount(res.check.amount);

      const open = invoices.length ? invoices : await fetchOpenInvoices();
      if (!invoices.length) setInvoices(open);
      const nextLines = res.stub?.invoices?.length ? matchStubInvoices(res.stub.invoices, open) : [];
      if (nextLines.length) setLines(nextLines);
      return {
        extraction: res,
        warnings: nextWarnings,
        payer: nextPayer,
        checkNumber: String(res.check?.check_number ?? ''),
        amount: round2(Number(res.check?.amount ?? 0)),
        lines: nextLines,
      };
    } catch (e: any) {
      const msg = e.message || 'Automatic extraction failed — enter the details manually.';
      setWarnings(w => [...w, msg]);
      toast({ title: 'Automatic extraction unavailable', description: e.message, variant: 'destructive' });
      return null;
    } finally {
      setExtracting(false);
    }
  };

  const pickCheck = async (file: File) => {
    setBusy(true);
    try { setCheckImage(await imageToDataUrl(file)); } finally { setBusy(false); }
  };
  const pickStub = async (file: File) => {
    setBusy(true);
    try { setStubImage(await imageToDataUrl(file)); } finally { setBusy(false); }
  };

  const total = round2(Number(amount || 0));
  const applied = round2(lines.reduce((s, l) => s + (l.invoice ? Number(l.amount || 0) : 0), 0));
  const difference = round2(total - applied);
  const unresolved = lines.filter(l => !l.invoice);
  const overApplied = lines.some(l => l.invoice && Number(l.amount || 0) - l.invoice.balance_due > 0.005);

  const setLineAmount = (idx: number, v: string) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, amount: v } : l)));
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const resolveLine = (idx: number, inv: OpenInvoice) =>
    setLines(prev => prev.map((l, i) => (i === idx
      ? { ...l, invoice: inv, amount: l.amount || inv.balance_due.toFixed(2) } : l)));
  const addInvoice = (inv: OpenInvoice) => {
    if (lines.some(l => l.invoice?.id === inv.id)) return;
    const remaining = Math.max(0, round2(total - applied));
    const proposed = remaining > 0 ? Math.min(remaining, inv.balance_due) : inv.balance_due;
    setLines(prev => [...prev, {
      raw: inv.invoice_number, invoice: inv, amount: proposed.toFixed(2), source: 'manual',
    }]);
    setSearch('');
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return invoices
      .filter(i => !lines.some(l => l.invoice?.id === i.id))
      .filter(i => (i.invoice_number ?? '').toLowerCase().includes(q)
        || (i.customer_name ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, invoices, lines]);

  const checkDuplicates = async () => {
    const dupes = await findDuplicateChecks(checkNumber, total);
    setDuplicates(dupes);
    setDupAcknowledged(false);
    return dupes;
  };

  const buildDraft = async (override?: Partial<{
    payer: string; checkNumber: string; amount: number; lines: MatchLine[];
    extraction: Record<string, unknown>; warnings: string[];
    confidence: Record<string, unknown>; autoEligible: boolean; blockedReasons: string[];
  }>): Promise<IntakeDraft> => {
    const d = {
      payer: override?.payer ?? payer,
      checkNumber: override?.checkNumber ?? checkNumber,
      amount: override?.amount ?? total,
      lines: override?.lines ?? lines,
      extraction: override?.extraction ?? extraction,
      warnings: override?.warnings ?? warnings,
    };
    const id = intakeId ?? crypto.randomUUID();
    if (!intakeId) setIntakeId(id);
    let checkPath = intake?.check_image_path ?? null;
    let stubPath = intake?.stub_image_path ?? null;
    if (checkImage) checkPath = await uploadCheckImage(id, 'check', checkImage);
    if (stubImage) stubPath = await uploadCheckImage(id, 'stub', stubImage);
    return {
      id,
      payer_name: d.payer.trim(),
      crm_company_id: d.lines.find(l => l.invoice?.crm_company_id)?.invoice?.crm_company_id ?? null,
      check_number: d.checkNumber.trim(),
      check_date: checkDate || null,
      received_date: receivedDate || today(),
      deposit_date: depositDate || null,
      deposit_account_label: depositAccount.trim() || null,
      amount: d.amount,
      check_image_path: checkPath,
      stub_image_path: stubPath,
      extraction: d.extraction,
      warnings: d.warnings,
      proposed_allocations: d.lines.map(l => ({
        invoice_id: l.invoice?.id ?? null,
        invoice_number: l.invoice?.invoice_number ?? l.raw,
        amount: Number(l.amount || 0),
      })),
      notes: notes.trim() || null,
      confidence: override?.confidence,
      auto_eligible: override?.autoEligible,
      blocked_reasons: override?.blockedReasons,
    };
  };

  /** Parks the check without touching invoice balances. */
  const saveForLater = async () => {
    setSaving(true);
    try {
      const draft = await buildDraft();
      const row = await saveIntake(draft, 'review_needed');
      setIntakeId(row.id);
      toast({ title: 'Saved for review', description: 'Finish matching it later from Payments.' });
      close(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Could not save the check', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    if (!total || total <= 0) {
      toast({ title: 'Enter the check amount', variant: 'destructive' });
      return;
    }
    if (overApplied) {
      toast({ title: 'An applied amount exceeds the invoice balance', variant: 'destructive' });
      return;
    }
    if (applied - total > 0.005) {
      toast({ title: 'Applied amount exceeds the check', variant: 'destructive' });
      return;
    }
    if (Math.abs(difference) > 0.005 && !exceptionAcknowledged) {
      toast({
        title: 'Amounts do not balance',
        description: 'Match the difference to $0.00 or confirm the exception below.',
        variant: 'destructive',
      });
      return;
    }
    if (duplicates.length && !dupAcknowledged) {
      toast({ title: 'Confirm the duplicate check first', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const draft = await buildDraft();
      await applyIntake({
        ...draft,
        confidence: decision?.confidence ?? draft.confidence,
        auto_eligible: false,
        blocked_reasons: decision?.reasons ?? [],
      }, 'manually_applied');
      toast({
        title: 'Check applied',
        description: `${money(total)} posted to ${draft.proposed_allocations.filter(a => a.invoice_id && a.amount > 0).length} invoice(s).`,
      });
      close(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Could not apply the check', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Happy path: extract, evaluate the confidence gate and post automatically when every
   * condition passes. Anything uncertain drops into the review UI instead.
   */
  const runAutoFlow = async () => {
    setStep('processing');
    const parsed = await extract(checkImage, stubImage);
    if (!parsed) {
      setDecision({
        eligible: false,
        reasons: ['Automatic extraction is unavailable — enter and match the check manually.'],
        confidence: {} as any,
      });
      setStep('review');
      return;
    }

    const dupes = await findDuplicateChecks(parsed.checkNumber, parsed.amount);
    setDuplicates(dupes);
    const verdict = evaluateAutoPost({
      amount: parsed.amount,
      checkNumber: parsed.checkNumber,
      payer: parsed.payer,
      lines: parsed.lines,
      extraction: parsed.extraction,
      warnings: parsed.warnings,
      duplicates: dupes,
    });
    setDecision(verdict);

    if (!autoEnabled || !verdict.eligible) {
      if (!autoEnabled) {
        setDecision({ ...verdict, eligible: false, reasons: ['Automatic posting is turned off in Billing settings.', ...verdict.reasons] });
      }
      setStep('review');
      return;
    }

    setSaving(true);
    try {
      const draft = await buildDraft({
        ...parsed,
        confidence: verdict.confidence,
        autoEligible: true,
        blockedReasons: [],
      });
      await applyIntake(draft, 'auto_applied');
      setResult({
        amount: parsed.amount,
        count: draft.proposed_allocations.filter(a => a.invoice_id && a.amount > 0).length,
        checkNumber: parsed.checkNumber,
      });
      setStep('done');
      onSaved?.();
    } catch (e: any) {
      setDecision({ ...verdict, eligible: false, reasons: [`Automatic posting failed: ${e.message}`] });
      setStep('review');
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    if (step === 'check') { setStep('stub'); return; }
    if (step === 'stub') {
      if ((checkImage || stubImage) && !Object.keys(extraction).length) { await runAutoFlow(); return; }
      setStep('review'); return;
    }
    if (step === 'review') { await checkDuplicates(); setStep('match'); return; }
    if (step === 'match') { setStep('confirm'); return; }
  };
  const goBack = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive a check</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <Badge
              key={s.key}
              variant={i === stepIndex ? 'default' : 'secondary'}
              className={i < stepIndex ? 'opacity-70' : ''}
            >
              {i + 1}. {s.label}
            </Badge>
          ))}
        </div>

        {extracting && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the images…
          </p>
        )}

        {step === 'check' && (
          <CaptureCard
            label="Front of the check"
            hint="Bank routing and account numbers are never stored — only payer, check number, date and amount."
            image={checkImage} busy={busy} onPick={pickCheck}
          />
        )}

        {step === 'stub' && (
          <CaptureCard
            label="Remittance stub"
            hint="Optional, but it lets Crew Compass match invoice numbers automatically."
            image={stubImage} busy={busy} onPick={pickStub}
          />
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {!!warnings.length && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-0.5 text-sm">
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ri_payer">Payer</Label>
                <Input id="ri_payer" value={payer} onChange={e => setPayer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ri_num">Check #</Label>
                <Input id="ri_num" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ri_amt">Check amount</Label>
                <Input id="ri_amt" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ri_cdate">Check date</Label>
                <Input id="ri_cdate" type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ri_recv">Date received</Label>
                <Input
                  id="ri_recv" type="date" value={receivedDate}
                  onChange={e => {
                    if (depositDate === receivedDate) setDepositDate(e.target.value);
                    setReceivedDate(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ri_dep">Deposit date</Label>
                <Input id="ri_dep" type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">Defaults to the day of receipt — change it if deposited later.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ri_acct">Deposit account</Label>
                <Input id="ri_acct" value={depositAccount} onChange={e => setDepositAccount(e.target.value)} placeholder="Operating" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ri_notes">Notes</Label>
                <Textarea id="ri_notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 'match' && (
          <div className="space-y-3">
            {!!duplicates.length && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="text-sm">
                    A payment with check #{checkNumber} for {money(total)} already exists
                    {duplicates[0]?.payment_date ? ` (recorded ${duplicates[0].payment_date})` : ''}.
                  </p>
                  <Button size="sm" variant={dupAcknowledged ? 'secondary' : 'outline'}
                    onClick={() => setDupAcknowledged(v => !v)}>
                    {dupAcknowledged ? 'Duplicate confirmed as intentional' : 'This is a different, legitimate check'}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {lines.map((l, idx) => (
              <div key={`${l.raw}-${idx}`} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{l.invoice?.invoice_number ?? l.raw}</span>
                      {l.invoice ? (
                        <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Matched</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-900 gap-1"><AlertTriangle className="h-3 w-3" /> Unresolved</Badge>
                      )}
                      {l.source === 'manual' && <Badge variant="outline">Added manually</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {l.invoice
                        ? `${l.invoice.customer_name ?? 'Customer'} · total ${money(l.invoice.total)} · balance ${money(l.invoice.balance_due)}`
                        : 'No open invoice with this number — pick one below or leave it unresolved.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-32" type="number" step="0.01" value={l.amount}
                      disabled={!l.invoice}
                      onChange={e => setLineAmount(idx, e.target.value)}
                      aria-label={`Amount applied to ${l.invoice?.invoice_number ?? l.raw}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} aria-label="Remove line">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {l.invoice && Number(l.amount || 0) - l.invoice.balance_due > 0.005 && (
                  <p className="text-xs text-destructive">Applied amount is more than the remaining balance.</p>
                )}
                {!l.invoice && (
                  <div className="flex flex-wrap gap-1.5">
                    {invoices
                      .filter(i => (i.invoice_number ?? '').toLowerCase().includes(l.raw.slice(-4).toLowerCase()))
                      .slice(0, 4)
                      .map(i => (
                        <Button key={i.id} size="sm" variant="outline" onClick={() => resolveLine(idx, i)}>
                          Use {i.invoice_number}
                        </Button>
                      ))}
                  </div>
                )}
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="ri_search">Add an open invoice</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input id="ri_search" className="pl-8" placeholder="Search by invoice number or customer"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {searchResults.map(i => (
                <button key={i.id} type="button" onClick={() => addInvoice(i)}
                  className="w-full text-left rounded-md border p-2 hover:bg-accent">
                  <span className="font-medium text-sm">{i.invoice_number}</span>
                  <span className="text-xs text-muted-foreground"> · {i.customer_name ?? 'Customer'} · balance {money(i.balance_due)}</span>
                  <Plus className="h-3.5 w-3.5 inline ml-1" />
                </button>
              ))}
            </div>

            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Check amount</span><span className="tabular-nums">{money(total)}</span></div>
              <div className="flex justify-between"><span>Total proposed applications</span><span className="tabular-nums">{money(applied)}</span></div>
              <div className={`flex justify-between font-medium ${Math.abs(difference) > 0.005 ? 'text-destructive' : ''}`}>
                <span>Difference</span><span className="tabular-nums">{money(difference)}</span>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Payer:</span> {payer || '—'}</p>
              <p><span className="text-muted-foreground">Check #:</span> {checkNumber || '—'} · <span className="text-muted-foreground">Dated</span> {checkDate || '—'}</p>
              <p><span className="text-muted-foreground">Received:</span> {receivedDate} · <span className="text-muted-foreground">Deposit:</span> {depositDate || '—'}</p>
              <p className="font-medium">{money(total)} across {lines.filter(l => l.invoice && Number(l.amount || 0) > 0).length} invoice(s)</p>
            </div>

            {lines.filter(l => l.invoice && Number(l.amount || 0) > 0).map((l, i) => (
              <div key={i} className="flex justify-between text-sm rounded-md border p-2">
                <span>{l.invoice!.invoice_number} · {l.invoice!.customer_name ?? 'Customer'}</span>
                <span className="tabular-nums">{money(Number(l.amount))}</span>
              </div>
            ))}

            {!!unresolved.length && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {unresolved.length} stub invoice number(s) are still unresolved. They will be kept on the record but not applied.
                </AlertDescription>
              </Alert>
            )}

            {Math.abs(difference) > 0.005 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="text-sm">
                    {difference > 0
                      ? `${money(difference)} of this check is unapplied cash.`
                      : `Applications exceed the check by ${money(Math.abs(difference))}.`}
                  </p>
                  {difference > 0 && (
                    <Button size="sm" variant={exceptionAcknowledged ? 'secondary' : 'outline'}
                      onClick={() => setExceptionAcknowledged(v => !v)}>
                      {exceptionAcknowledged ? 'Exception confirmed — post as unapplied cash' : 'Post the difference as unapplied cash'}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => close(false)} disabled={saving}>Cancel</Button>
          <Button variant="outline" onClick={saveForLater} disabled={saving || extracting}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save for review
          </Button>
          {stepIndex > 0 && <Button variant="outline" onClick={goBack} disabled={saving}>Back</Button>}
          {step !== 'confirm' ? (
            <Button onClick={goNext} disabled={busy || extracting || saving}>Next</Button>
          ) : (
            <Button onClick={apply} disabled={saving || !total}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Apply check payment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiveCheckDialog;
