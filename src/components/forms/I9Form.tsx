import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
}

interface I9FormProps {
  data: I9Data;
  onChange: (data: I9Data) => void;
  readOnly?: boolean;
  isManager?: boolean;
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

export const I9Form = ({ data, onChange, readOnly = false, isManager = false }: I9FormProps) => {
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
