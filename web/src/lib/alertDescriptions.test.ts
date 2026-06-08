import { describe, expect, it } from 'vitest';
import { formatNonComplianceAlert } from './alertDescriptions';

describe('formatNonComplianceAlert', () => {
  it('describes missing customer movement', () => {
    expect(formatNonComplianceAlert('Customer movement', 'No', true)).toBe('No customer movement');
  });

  it('describes missing bills', () => {
    expect(
      formatNonComplianceAlert('Bills issued for all visible transactions', 'No', true),
    ).toBe('Bills not issued for all visible transactions');
  });

  it('describes staff uniform violation', () => {
    expect(formatNonComplianceAlert('Staff in uniform / ID card', 'No', true)).toBe(
      'Staff not in uniform / no ID card',
    );
  });

  it('describes late attendance when Yes triggers violation', () => {
    expect(formatNonComplianceAlert('Late attendance or absenteeism', 'Yes', false)).toBe(
      'Late attendance or absenteeism observed',
    );
  });
});
