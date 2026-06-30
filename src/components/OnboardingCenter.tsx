import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  CheckCircle2, Clock, AlertCircle, FileText, PenLine, ChevronRight, ArrowLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SignaturePad } from './SignaturePad';
import { W4Form } from './forms/W4Form';
import { I9Form } from './forms/I9Form';
import { DirectDepositForm } from './forms/DirectDepositForm';
import { format } from 'date-fns';
import { PdfFiller } from './documents/PdfFiller';
import { flattenPdf } from './documents/flattenPdf';
import { buildAutofillValues } from './documents/autofill';
import type { PdfField, FieldValues } from './documents/types';

interface OnboardingDocument {
  id: string;
  title: string;
  document_type: string;
  description: string | null;
  content: string | null;
  is_required: boolean;
  display_order: number;
  source_pdf_path?: string | null;
  field_schema?: PdfField[];
}

interface DocumentSubmission {
  id: string;
  document_id: string;
  status: 'pending' | 'completed' | 'rejected';
  form_data: any;
  signature_data: string | null;
  signature_typed: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  field_values?: any;
  filled_pdf_path?: string | null;
}

const defaultW4 = {
  first_name: '', last_name: '', ssn_last4: '', address: '', city: '',
  state: '', zip: '', filing_status: '' as const, multiple_jobs: false,
  claim_dependents: false, dependent_amount: '', other_income: '',
  deductions: '', extra_withholding: '', exempt: false,
};

const defaultI9 = {
  last_name: '', first_name: '', middle_initial: '', other_last_names: '',
  address: '', apt: '', city: '', state: '', zip: '', dob: '', ssn: '',
  email: '', phone: '', citizenship_status: '' as const, alien_registration: '',
  i94_number: '', foreign_passport: '', country_of_issuance: '',
  work_auth_expiration: '', doc_title_a: '', doc_issuing_authority_a: '',
  doc_number_a: '', doc_expiration_a: '', doc_title_b: '', doc_issuing_authority_b: '',
  doc_number_b: '', doc_expiration_b: '', doc_title_c: '', doc_issuing_authority_c: '',
  doc_number_c: '', doc_expiration_c: '', employment_start_date: '',
};

const defaultDirectDeposit = {
  bank_name: '', account_type: '' as const, routing_number: '', account_number: '',
  account_number_confirm: '', account_holder_name: '', deposit_type: '' as const,
  deposit_amount: '',
};

export const OnboardingCenter = () => {
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState<OnboardingDocument | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [signature, setSignature] = useState<{ data: string; type: 'drawn' | 'typed' } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfValues, setPdfValues] = useState<FieldValues>({});
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const [docsResult, subsResult] = await Promise.all([
      supabase.from('onboarding_documents').select('*').eq('active', true).order('display_order'),
      supabase.from('employee_document_submissions').select('*').eq('employee_id', profile?.id || '')
    ]);
    setDocuments(((docsResult.data as any[]) || []).map((d: any) => ({
      ...d,
      field_schema: Array.isArray(d.field_schema) ? d.field_schema : [],
    })) as OnboardingDocument[]);
    setSubmissions((subsResult.data || []) as DocumentSubmission[]);
    setLoading(false);
  };

  const getSubmission = (docId: string) => submissions.find(s => s.document_id === docId);

  const completedCount = documents.filter(d => getSubmission(d.id)?.status === 'completed').length;
  const requiredCount = documents.filter(d => d.is_required).length;
  const completedRequired = documents.filter(d => d.is_required && getSubmission(d.id)?.status === 'completed').length;
  const progressPct = requiredCount > 0 ? Math.round((completedRequired / requiredCount) * 100) : 0;

  const openDocument = async (doc: OnboardingDocument) => {
    const existing = getSubmission(doc.id);
    setActiveDoc(doc);
    setSignature(null);
    setAcknowledged(false);
    setPdfUrl(null);
    setPdfValues({});

    if (existing?.form_data) {
      setFormData(existing.form_data);
    } else {
      if (doc.document_type === 'w4') setFormData({ ...defaultW4 });
      else if (doc.document_type === 'i9') setFormData({ ...defaultI9 });
      else if (doc.document_type === 'direct_deposit') setFormData({ ...defaultDirectDeposit });
      else setFormData({});
    }

    if (doc.document_type === 'custom_form' && doc.source_pdf_path) {
      const { data } = await supabase.storage
        .from('onboarding-files')
        .createSignedUrl(doc.source_pdf_path, 3600);
      setPdfUrl(data?.signedUrl ?? null);
      const existingVals = (existing as any)?.field_values || {};
      setPdfValues(buildAutofillValues(doc.field_schema || [], profile as any, existingVals));
    }
  };

  const handleSubmit = async () => {
    if (!activeDoc || !profile) return;

    const isCustom = activeDoc.document_type === 'custom_form';
    const needsSignature = activeDoc.document_type !== 'acknowledgment' && !isCustom;
    if (needsSignature && !signature?.data) {
      toast({ title: 'Signature required', description: 'Please sign the document before submitting.', variant: 'destructive' });
      return;
    }
    if (activeDoc.document_type === 'acknowledgment' && !acknowledged) {
      toast({ title: 'Acknowledgment required', description: 'Please check the acknowledgment box.', variant: 'destructive' });
      return;
    }
    if (isCustom) {
      const required = (activeDoc.field_schema || []).filter(f => f.required);
      for (const f of required) {
        const v = pdfValues[f.id];
        if (v === undefined || v === '' || v === false) {
          toast({ title: 'Missing field', description: `Please complete: ${f.label}`, variant: 'destructive' });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const existing = getSubmission(activeDoc.id);

      // For custom PDF docs, flatten + upload
      let filledPath: string | null = null;
      if (isCustom && activeDoc.source_pdf_path && pdfUrl) {
        const res = await fetch(pdfUrl);
        const srcBytes = await res.arrayBuffer();
        const flat = await flattenPdf(srcBytes, activeDoc.field_schema || [], pdfValues);
        const subId = existing?.id ?? crypto.randomUUID();
        filledPath = `submissions/${profile.id}/${subId}.pdf`;
        const { error: upErr } = await supabase.storage
          .from('onboarding-files')
          .upload(filledPath, new Blob([flat as BlobPart], { type: 'application/pdf' }), { upsert: true, contentType: 'application/pdf' });
        if (upErr) throw upErr;
      }

      const payload: any = {
        employee_id: profile.id,
        document_id: activeDoc.id,
        status: 'completed' as const,
        form_data: !isCustom && Object.keys(formData).length > 0 ? formData : null,
        field_values: isCustom ? pdfValues : null,
        filled_pdf_path: filledPath,
        signature_data: signature?.type === 'drawn' ? signature.data : null,
        signature_typed: signature?.type === 'typed' ? signature.data : null,
        acknowledged_at: activeDoc.document_type === 'acknowledgment' ? new Date().toISOString() : null,
        signed_at: (needsSignature || isCustom) ? new Date().toISOString() : null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('employee_document_submissions')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employee_document_submissions')
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Document submitted!', description: `${activeDoc.title} has been completed.` });
      setActiveDoc(null);
      fetchDocuments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to submit document', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const statusIcon = (doc: OnboardingDocument) => {
    const sub = getSubmission(doc.id);
    if (sub?.status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (sub?.status === 'rejected') return <AlertCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-yellow-500" />;
  };

  const statusBadge = (doc: OnboardingDocument) => {
    const sub = getSubmission(doc.id);
    if (sub?.status === 'completed') return <Badge className="bg-green-100 text-green-800 text-xs">Completed</Badge>;
    if (sub?.status === 'rejected') return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
    if (doc.is_required) return <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700">Required</Badge>;
    return <Badge variant="outline" className="text-xs">Optional</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Onboarding Documents</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Complete all required documents to finish your onboarding.
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Required Documents</span>
            <span className="text-sm font-bold">{completedRequired} / {requiredCount} completed</span>
          </div>
          <Progress value={progressPct} className="h-2" />
          {progressPct === 100 && (
            <p className="text-xs text-green-600 mt-2 font-medium">
              ✓ All required documents completed!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Document List */}
      <div className="space-y-2">
        {documents.map(doc => {
          const sub = getSubmission(doc.id);
          const isCompleted = sub?.status === 'completed';
          return (
            <Card
              key={doc.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${isCompleted ? 'border-green-200 bg-green-50/30' : ''}`}
              onClick={() => openDocument(doc)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {statusIcon(doc)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{doc.title}</p>
                      {statusBadge(doc)}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
                    )}
                    {isCompleted && sub?.submitted_at && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Submitted {format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                    {sub?.status === 'rejected' && sub.rejection_reason && (
                      <p className="text-xs text-red-600 mt-0.5">Rejected: {sub.rejection_reason}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Document Form Dialog */}
      <Dialog open={!!activeDoc} onOpenChange={(open) => !open && setActiveDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {activeDoc?.title}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 pb-4">
              {/* Acknowledgment type */}
              {activeDoc?.document_type === 'acknowledgment' && (
                <div className="space-y-4">
                  {activeDoc.content && (
                    <div className="bg-gray-50 rounded-md p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto border">
                      {activeDoc.content}
                    </div>
                  )}
                  {activeDoc.description && !activeDoc.content && (
                    <p className="text-sm text-muted-foreground">{activeDoc.description}</p>
                  )}
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <Checkbox
                      id="acknowledge"
                      checked={acknowledged}
                      onCheckedChange={v => setAcknowledged(!!v)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="acknowledge" className="text-sm cursor-pointer">
                      I acknowledge that I have read, understand, and agree to the above policy.
                    </Label>
                  </div>
                </div>
              )}

              {/* W-4 */}
              {activeDoc?.document_type === 'w4' && (
                <W4Form data={formData} onChange={setFormData} />
              )}

              {/* I-9 */}
              {activeDoc?.document_type === 'i9' && (
                <I9Form data={formData} onChange={setFormData} />
              )}

              {/* Direct Deposit */}
              {activeDoc?.document_type === 'direct_deposit' && (
                <DirectDepositForm data={formData} onChange={setFormData} />
              )}

              {/* Custom PDF */}
              {activeDoc?.document_type === 'custom_form' && pdfUrl && (
                <PdfFiller
                  fileUrl={pdfUrl}
                  fields={activeDoc.field_schema || []}
                  values={pdfValues}
                  onChange={setPdfValues}
                />
              )}
              {activeDoc?.document_type === 'custom_form' && !pdfUrl && (
                <p className="text-sm text-muted-foreground">This document is not ready yet — please check back later.</p>
              )}

              {/* Signature for non-acknowledgment docs */}
              {activeDoc?.document_type !== 'acknowledgment' && activeDoc?.document_type !== 'custom_form' && (
                <>
                  <Separator />
                  <SignaturePad
                    onSignature={(data, type) => setSignature({ data, type })}
                    existingSignature={getSubmission(activeDoc?.id || '')?.signature_data || undefined}
                    existingTyped={getSubmission(activeDoc?.id || '')?.signature_typed || undefined}
                  />
                  <p className="text-xs text-muted-foreground">
                    By signing, I certify that the information provided is true and accurate to the best of my knowledge.
                  </p>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setActiveDoc(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
