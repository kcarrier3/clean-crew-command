import { describe, it, expect } from 'vitest';
import { canViewEmployeeDocuments } from '../employeeDocumentAccess';

describe('employee document access', () => {
  it('allows Owner, Office Manager, Operations Manager', () => {
    expect(['Owner', 'Office Manager', 'Operations Manager'].every(canViewEmployeeDocuments)).toBe(true);
  });
  it('denies other managers and sales reps', () => {
    expect(canViewEmployeeDocuments('Sales Rep')).toBe(false);
    expect(canViewEmployeeDocuments('Project Crew Lead')).toBe(false);
    expect(canViewEmployeeDocuments('Account Manager')).toBe(false);
    expect(canViewEmployeeDocuments(null)).toBe(false);
  });
});
