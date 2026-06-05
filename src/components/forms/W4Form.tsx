import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface W4Data {
  first_name: string;
  last_name: string;
  ssn_last4: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  filing_status: 'single' | 'married_jointly' | 'head_of_household' | '';
  multiple_jobs: boolean;
  claim_dependents: boolean;
  dependent_amount: string;
  other_income: string;
  deductions: string;
  extra_withholding: string;
  exempt: boolean;
}

interface W4FormProps {
  data: W4Data;
  onChange: (data: W4Data) => void;
  readOnly?: boolean;
}

const field = (
  label: string,
  key: keyof W4Data,
  data: W4Data,
  onChange: (data: W4Data) => void,
  options?: { placeholder?: string; type?: string; readOnly?: boolean }
) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium">{label}</Label>
    <Input
      value={(data[key] as string) || ''}
      onChange={e => onChange({ ...data, [key]: e.target.value })}
      placeholder={options?.placeholder}
      type={options?.type || 'text'}
      readOnly={options?.readOnly}
      className="text-sm"
    />
  </div>
);

export const W4Form = ({ data, onChange, readOnly = false }: W4FormProps) => {
  return (
    <div className="space-y-5 text-sm">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-xs text-blue-800 font-medium">W-4 Employee's Withholding Certificate</p>
        <p className="text-xs text-blue-700 mt-1">
          Complete this form so your employer can withhold the correct federal income tax from your pay.
          For IRS compliance, a physical W-4 must also be retained on file.
        </p>
      </div>

      {/* Step 1: Personal Information */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Step 1 — Personal Information</h4>
        <div className="grid grid-cols-2 gap-3">
          {field('First Name & Middle Initial', 'first_name', data, onChange, { placeholder: 'First name' })}
          {field('Last Name', 'last_name', data, onChange, { placeholder: 'Last name' })}
        </div>
        {field('Home Address (number and street)', 'address', data, onChange, { placeholder: '123 Main St' })}
        <div className="grid grid-cols-3 gap-3">
          {field('City or Town', 'city', data, onChange, { placeholder: 'City' })}
          {field('State', 'state', data, onChange, { placeholder: 'FL' })}
          {field('ZIP Code', 'zip', data, onChange, { placeholder: '12345' })}
        </div>
        {field('Last 4 digits of SSN', 'ssn_last4', data, onChange, {
          placeholder: 'XXXX',
          type: 'password'
        })}

        <div className="space-y-2">
          <Label className="text-xs font-medium">Filing Status</Label>
          <RadioGroup
            value={data.filing_status}
            onValueChange={v => onChange({ ...data, filing_status: v as W4Data['filing_status'] })}
            disabled={readOnly}
            className="space-y-1"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="single" />
              <Label htmlFor="single" className="text-xs font-normal cursor-pointer">
                Single or Married filing separately
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="married_jointly" id="married_jointly" />
              <Label htmlFor="married_jointly" className="text-xs font-normal cursor-pointer">
                Married filing jointly or Qualifying surviving spouse
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="head_of_household" id="head_of_household" />
              <Label htmlFor="head_of_household" className="text-xs font-normal cursor-pointer">
                Head of household (unmarried and pay more than half the cost of keeping up a home)
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <Separator />

      {/* Step 2: Multiple Jobs */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Step 2 — Multiple Jobs or Spouse Works</h4>
        <p className="text-xs text-muted-foreground">
          Complete this step if you (1) hold more than one job at a time, or (2) are married filing jointly and your spouse also works.
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="multiple_jobs"
            checked={data.multiple_jobs}
            onCheckedChange={v => onChange({ ...data, multiple_jobs: !!v })}
            disabled={readOnly}
          />
          <Label htmlFor="multiple_jobs" className="text-xs font-normal cursor-pointer">
            I have multiple jobs or my spouse works (check if applicable)
          </Label>
        </div>
      </div>

      <Separator />

      {/* Step 3: Dependents */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Step 3 — Claim Dependents</h4>
        <p className="text-xs text-muted-foreground">
          If your total income will be $200,000 or less ($400,000 or less if married filing jointly), you may claim dependents.
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="claim_dependents"
            checked={data.claim_dependents}
            onCheckedChange={v => onChange({ ...data, claim_dependents: !!v })}
            disabled={readOnly}
          />
          <Label htmlFor="claim_dependents" className="text-xs font-normal cursor-pointer">
            I am claiming dependents
          </Label>
        </div>
        {data.claim_dependents && (
          field('Total dependent credit amount ($)', 'dependent_amount', data, onChange, {
            placeholder: '0.00',
            type: 'number'
          })
        )}
      </div>

      <Separator />

      {/* Step 4: Other Adjustments */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Step 4 — Other Adjustments (Optional)</h4>
        {field('Other income not from jobs (interest, dividends, retirement, etc.) ($)', 'other_income', data, onChange, {
          placeholder: '0.00',
          type: 'number'
        })}
        {field('Deductions (if you expect to claim deductions other than standard deduction) ($)', 'deductions', data, onChange, {
          placeholder: '0.00',
          type: 'number'
        })}
        {field('Extra withholding per pay period ($)', 'extra_withholding', data, onChange, {
          placeholder: '0.00',
          type: 'number'
        })}
      </div>

      <Separator />

      {/* Exempt */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="exempt"
            checked={data.exempt}
            onCheckedChange={v => onChange({ ...data, exempt: !!v })}
            disabled={readOnly}
          />
          <Label htmlFor="exempt" className="text-xs font-normal cursor-pointer">
            I claim exemption from withholding (I had no tax liability last year and expect none this year)
          </Label>
        </div>
      </div>
    </div>
  );
};
