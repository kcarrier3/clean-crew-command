export type FieldType = 'text' | 'date' | 'checkbox' | 'signature' | 'initials';

export type AutofillSource =
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'address'
  | 'date_of_birth'
  | 'today'
  | 'none';

export interface PdfField {
  id: string;
  page: number;        // 1-indexed
  x: number;           // normalized 0-1 of page width
  y: number;           // normalized 0-1 of page height (from top)
  width: number;       // normalized
  height: number;      // normalized
  type: FieldType;
  label: string;
  required: boolean;
  autofill?: AutofillSource;
}

export interface FieldValues {
  [fieldId: string]: string | boolean;
}