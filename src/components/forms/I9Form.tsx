import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface I9IdDocument {
  path: string;
  name: string;
  size: number;
  content_type: string;
  uploaded_at: string;
}

interface I9Data {
  // Section 1 — Employee
  last_name: string;
  first_name: string;
  middle_initial: string;
  other_last_names: string;
  address: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
  dob: string;
  ssn: string;
  email: string;
  phone: string;
  citizenship_status: 'citizen' | 'noncitizen_national' | 'lawful_permanent_resident' | 'authorized_alien' | '';
  alien_registration: string;
  i94_number: string;
  foreign_passport: string;
  country_of_issuance: string;
  work_auth_expiration: string;
  // Section 2 — Employer (filled by manager)
  doc_title_a: string;
  doc_issuing_authority_a: string;
  doc_number_a: string;
  doc_expiration_a: string;
  doc_title_b: string;
  doc_issuing_authority_b: string;
  doc_number_b: string;
  doc_expiration_b: string;
  doc_title_c: string;
  doc_issuing_authority_c: string;
  doc_number_c: string;
  doc_expiration_c: string;
  employment_start_date: string;
  id_documents?: I9IdDocument[];
}

interface I9FormProps {
  data: I9Data;
  onChange: (data: I9Data) => void;
  readOnly?: boolean;
  isManager?: boolean;
  employeeId?: string;
}

const F = (
  label: string,
  key: keyof I9Data,
  data: I9Data,
  onChange: (d: I9Data) => void,
  opts?: { placeholder?: string; type?: string; readOnly?: boolean; required?: boolean }
) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium">{label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
    <Input
      value={(data[key] as string) || ''}
      onChange={e => onChange({ ...data, [key]: e.target.value })}
      placeholder={opts?.placeholder}
      type={opts?.type || 'text'}
      readOnly={opts?.readOnly}
      className="text-sm"
    />
  </div>
);

export const I9Form = ({ data, onChange, readOnly = false, isManager = false, employeeId }: I9FormProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const idDocs: I9IdDocument[] = Array.isArray(data.id_documents) ? data.id_documents : [];
  const maxDocs = 2;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!employeeId) { toast({ title: 'Not ready', description: 'Please save your profile first.', variant: 'destructive' }); return; }
    if (idDocs.length + files.length > maxDocs) {
      toast({ title: `Maximum ${maxDocs} IDs`, description: 'Remove one before uploading another.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const uploaded: I9IdDocument[] = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: `${file.name} exceeds 10MB.`, variant: 'destructive' });
        continue;
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const path = `id-documents/${employeeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('onboarding-files').upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) {
        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        continue;
      }
      uploaded.push({
        path,
        name: file.name,
        size: file.size,
        content_type: file.type || 'application/octet-stream',
        uploaded_at: new Date().toISOString(),
      });
    }
    if (uploaded.length) {
      onChange({ ...data, id_documents: [...idDocs, ...uploaded] });
      toast({ title: `${uploaded.length} file(s) uploaded` });
    }
    setUploading(false);
  };

  const removeDoc = async (doc: I9IdDocument) => {
    if (!confirm(`Remove ${doc.name}?`)) return;
    await supabase.storage.from('onboarding-files').remove([doc.path]);
    onChange({ ...data, id_documents: idDocs.filter(d => d.path !== doc.path) });
  };

  const previewDoc = async (doc: I9IdDocument) => {
    const { data: signed } = await supabase.storage
      .from('onboarding-files')
      .createSignedUrl(doc.path, 300);
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank');
  };

  return (
    <div className="space-y-5 text-sm">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-xs text-blue-800 font-medium">I-9 Employment Eligibility Verification</p>
        <p className="text-xs text-blue-700 mt-1">
          Federal law requires employers to verify the identity and employment authorization of all new employees.
          Original documents must be physically inspected by the employer. This digital form supplements but does not replace the paper I-9.
        </p>
      </div>

      {/* Section 1 — Employee */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Section 1 — Employee Information and Attestation</h4>
        <p className="text-xs text-muted-foreground">Complete and sign Section 1 on or before your first day of employment.</p>

        <div className="grid grid-cols-2 gap-3">
          {F('Last Name (Family Name)', 'last_name', data, onChange, { placeholder: 'Last name', required: true })}
          {F('First Name (Given Name)', 'first_name', data, onChange, { placeholder: 'First name', required: true })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {F('Middle Initial', 'middle_initial', data, onChange, { placeholder: 'M.I.' })}
          {F('Other Last Names Used (if any)', 'other_last_names', data, onChange, { placeholder: 'N/A if none' })}
        </div>
        {F('Address (Street Number and Name)', 'address', data, onChange, { placeholder: '123 Main St', required: true })}
        <div className="grid grid-cols-3 gap-3">
          {F('Apt. Number', 'apt', data, onChange, { placeholder: 'Apt #' })}
          {F('City or Town', 'city', data, onChange, { placeholder: 'City', required: true })}
          {F('State', 'state', data, onChange, { placeholder: 'FL', required: true })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {F('ZIP Code', 'zip', data, onChange, { placeholder: '12345', required: true })}
          {F('Date of Birth (mm/dd/yyyy)', 'dob', data, onChange, { type: 'date', required: true })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {F('U.S. Social Security Number', 'ssn', data, onChange, { placeholder: 'XXX-XX-XXXX', type: 'password' })}
          {F('Employee Email Address', 'email', data, onChange, { placeholder: 'email@example.com', type: 'email' })}
        </div>
        {F('Employee Telephone Number', 'phone', data, onChange, { placeholder: '(555) 555-5555', type: 'tel' })}

        <div className="space-y-2">
          <Label className="text-xs font-medium">Citizenship/Immigration Status <span className="text-red-500">*</span></Label>
          <RadioGroup
            value={data.citizenship_status}
            onValueChange={v => onChange({ ...data, citizenship_status: v as I9Data['citizenship_status'] })}
            disabled={readOnly}
            className="space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="citizen" id="citizen" className="mt-0.5" />
              <Label htmlFor="citizen" className="text-xs font-normal cursor-pointer">
                A citizen of the United States
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="noncitizen_national" id="noncitizen_national" className="mt-0.5" />
              <Label htmlFor="noncitizen_national" className="text-xs font-normal cursor-pointer">
                A noncitizen national of the United States
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="lawful_permanent_resident" id="lawful_permanent_resident" className="mt-0.5" />
              <Label htmlFor="lawful_permanent_resident" className="text-xs font-normal cursor-pointer">
                A lawful permanent resident (Alien Registration Number/USCIS Number)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="authorized_alien" id="authorized_alien" className="mt-0.5" />
              <Label htmlFor="authorized_alien" className="text-xs font-normal cursor-pointer">
                An alien authorized to work until (expiration date, if applicable)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {(data.citizenship_status === 'lawful_permanent_resident' || data.citizenship_status === 'authorized_alien') && (
          <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-blue-200">
            {F('Alien Registration / USCIS Number', 'alien_registration', data, onChange, { placeholder: 'A-Number' })}
            {F('Form I-94 Admission Number', 'i94_number', data, onChange, { placeholder: 'I-94 number' })}
            {F('Foreign Passport Number', 'foreign_passport', data, onChange, { placeholder: 'Passport number' })}
            {F('Country of Issuance', 'country_of_issuance', data, onChange, { placeholder: 'Country' })}
            {F('Work Authorization Expiration Date', 'work_auth_expiration', data, onChange, { type: 'date' })}
          </div>
        )}
      </div>

      <Separator />

      {/* ID Document Uploads */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Identification Documents</h4>
        <p className="text-xs text-muted-foreground">
          Upload up to {maxDocs} forms of identification (e.g. Driver's License, Passport, Social Security card, Birth Certificate).
          Accepted formats: PDF, JPG, PNG. Max 10MB each. These images are stored securely for your employer to verify.
        </p>

        {idDocs.length > 0 && (
          <div className="space-y-2">
            {idDocs.map((doc) => (
              <div key={doc.path} className="flex items-center gap-2 p-2 border rounded-md bg-muted/40">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(doc.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => previewDoc(doc)}>View</Button>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeDoc(doc)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {!readOnly && idDocs.length < maxDocs && (
          <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/40 transition">
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs">Uploading…</span></>
            ) : (
              <><Upload className="h-4 w-4" /> <span className="text-xs">Upload ID ({idDocs.length}/{maxDocs})</span></>
            )}
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      <Separator />

      {/* Section 2 — Employer (manager fills this) */}
      {isManager && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm border-b pb-1">Section 2 — Employer Review and Verification</h4>
          <p className="text-xs text-muted-foreground">
            Complete within 3 business days of the employee's first day. Examine original documents and record document information below.
          </p>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">List A — Identity and Employment Authorization</p>
            <div className="grid grid-cols-2 gap-3">
              {F('Document Title', 'doc_title_a', data, onChange, { placeholder: 'e.g. U.S. Passport' })}
              {F('Issuing Authority', 'doc_issuing_authority_a', data, onChange, { placeholder: 'e.g. U.S. Dept of State' })}
              {F('Document Number', 'doc_number_a', data, onChange, { placeholder: 'Document number' })}
              {F('Expiration Date', 'doc_expiration_a', data, onChange, { type: 'date' })}
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground font-medium">— OR —</div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">List B — Identity</p>
            <div className="grid grid-cols-2 gap-3">
              {F('Document Title', 'doc_title_b', data, onChange, { placeholder: "e.g. Driver's License" })}
              {F('Issuing Authority', 'doc_issuing_authority_b', data, onChange, { placeholder: 'e.g. State of Florida' })}
              {F('Document Number', 'doc_number_b', data, onChange, { placeholder: 'Document number' })}
              {F('Expiration Date', 'doc_expiration_b', data, onChange, { type: 'date' })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">List C — Employment Authorization</p>
            <div className="grid grid-cols-2 gap-3">
              {F('Document Title', 'doc_title_c', data, onChange, { placeholder: 'e.g. Social Security Card' })}
              {F('Issuing Authority', 'doc_issuing_authority_c', data, onChange, { placeholder: 'e.g. SSA' })}
              {F('Document Number', 'doc_number_c', data, onChange, { placeholder: 'Document number' })}
              {F('Expiration Date', 'doc_expiration_c', data, onChange, { type: 'date' })}
            </div>
          </div>

          {F('Employee First Day of Employment', 'employment_start_date', data, onChange, { type: 'date' })}
        </div>
      )}
    </div>
  );
};
