import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

interface DirectDepositData {
  bank_name: string;
  account_type: 'checking' | 'savings' | '';
  routing_number: string;
  account_number: string;
  account_number_confirm: string;
  account_holder_name: string;
  deposit_type: 'full' | 'partial' | '';
  deposit_amount: string;
}

interface DirectDepositFormProps {
  data: DirectDepositData;
  onChange: (data: DirectDepositData) => void;
  readOnly?: boolean;
}

const F = (
  label: string,
  key: keyof DirectDepositData,
  data: DirectDepositData,
  onChange: (d: DirectDepositData) => void,
  opts?: { placeholder?: string; type?: string; required?: boolean }
) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium">
      {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    <Input
      value={(data[key] as string) || ''}
      onChange={e => onChange({ ...data, [key]: e.target.value })}
      placeholder={opts?.placeholder}
      type={opts?.type || 'text'}
      className="text-sm"
    />
  </div>
);

export const DirectDepositForm = ({ data, onChange, readOnly = false }: DirectDepositFormProps) => {
  const routingValid = data.routing_number.length === 9 && /^\d{9}$/.test(data.routing_number);
  const accountsMatch = data.account_number && data.account_number === data.account_number_confirm;

  return (
    <div className="space-y-5 text-sm">
      <div className="bg-green-50 border border-green-200 rounded-md p-3">
        <p className="text-xs text-green-800 font-medium">Direct Deposit Authorization</p>
        <p className="text-xs text-green-700 mt-1">
          By completing this form, you authorize your employer to deposit your paycheck directly into the account below.
          Your banking information is stored securely and used only for payroll purposes.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Account Holder Information</h4>
        {F('Account Holder Full Name', 'account_holder_name', data, onChange, {
          placeholder: 'Full legal name as it appears on your bank account',
          required: true
        })}
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Bank Information</h4>
        {F('Bank Name', 'bank_name', data, onChange, { placeholder: 'e.g. Chase, Wells Fargo, Bank of America', required: true })}

        <div className="space-y-2">
          <Label className="text-xs font-medium">Account Type <span className="text-red-500">*</span></Label>
          <RadioGroup
            value={data.account_type}
            onValueChange={v => onChange({ ...data, account_type: v as DirectDepositData['account_type'] })}
            disabled={readOnly}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="checking" id="checking" />
              <Label htmlFor="checking" className="text-xs font-normal cursor-pointer">Checking</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="savings" id="savings" />
              <Label htmlFor="savings" className="text-xs font-normal cursor-pointer">Savings</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Routing Number (9 digits) <span className="text-red-500">*</span></Label>
          <Input
            value={data.routing_number}
            onChange={e => onChange({ ...data, routing_number: e.target.value.replace(/\D/g, '').slice(0, 9) })}
            placeholder="9-digit routing number"
            maxLength={9}
            className={`text-sm font-mono ${data.routing_number && !routingValid ? 'border-red-400' : ''}`}
            readOnly={readOnly}
          />
          {data.routing_number && !routingValid && (
            <p className="text-xs text-red-500">Routing number must be exactly 9 digits</p>
          )}
          {routingValid && (
            <p className="text-xs text-green-600">✓ Valid routing number format</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Account Number <span className="text-red-500">*</span></Label>
          <Input
            value={data.account_number}
            onChange={e => onChange({ ...data, account_number: e.target.value.replace(/\D/g, '') })}
            placeholder="Account number"
            type="password"
            className="text-sm font-mono"
            readOnly={readOnly}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Confirm Account Number <span className="text-red-500">*</span></Label>
          <Input
            value={data.account_number_confirm}
            onChange={e => onChange({ ...data, account_number_confirm: e.target.value.replace(/\D/g, '') })}
            placeholder="Re-enter account number"
            type="password"
            className={`text-sm font-mono ${data.account_number_confirm && !accountsMatch ? 'border-red-400' : ''}`}
            readOnly={readOnly}
          />
          {data.account_number_confirm && !accountsMatch && (
            <p className="text-xs text-red-500">Account numbers do not match</p>
          )}
          {accountsMatch && (
            <p className="text-xs text-green-600">✓ Account numbers match</p>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="font-semibold text-sm border-b pb-1">Deposit Amount</h4>
        <RadioGroup
          value={data.deposit_type}
          onValueChange={v => onChange({ ...data, deposit_type: v as DirectDepositData['deposit_type'] })}
          disabled={readOnly}
          className="space-y-1.5"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="full" id="full" />
            <Label htmlFor="full" className="text-xs font-normal cursor-pointer">
              Full paycheck deposit to this account
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="partial" id="partial" />
            <Label htmlFor="partial" className="text-xs font-normal cursor-pointer">
              Partial deposit (specify amount below)
            </Label>
          </div>
        </RadioGroup>

        {data.deposit_type === 'partial' && (
          F('Amount to deposit ($)', 'deposit_amount', data, onChange, {
            placeholder: '0.00',
            type: 'number'
          })
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> Changes to direct deposit information typically take 1–2 pay periods to take effect.
          A voided check or bank letter may be required for verification.
        </p>
      </div>
    </div>
  );
};
