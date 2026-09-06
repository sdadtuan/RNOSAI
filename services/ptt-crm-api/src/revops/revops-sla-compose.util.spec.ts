import {
  REVOPS_SLA_COMPLIANCE_TARGET_PCT,
  assignableLeadId,
  entityTypeLabel,
  incidentStatusFromDue,
} from './revops-sla-compose.util';

describe('revops-sla-compose.util', () => {
  it('derives warning before due', () => {
    const due = new Date('2026-09-06T11:00:00Z');
    const now = new Date('2026-09-06T10:30:00Z');
    expect(incidentStatusFromDue(due, 36, now)).toBe('warning');
  });

  it('derives breach at or after due', () => {
    const due = new Date('2026-09-06T11:00:00Z');
    expect(incidentStatusFromDue(due, 36, new Date('2026-09-06T11:00:00Z'))).toBe('breached');
    expect(incidentStatusFromDue(due, 36, new Date('2026-09-06T11:05:00Z'))).toBe('breached');
  });

  it('maps assignable lead id only for lead_first_response', () => {
    expect(assignableLeadId('lead_first_response', '42')).toBe(42);
    expect(assignableLeadId('handover_accept', '42')).toBeNull();
  });

  it('labels entity types', () => {
    expect(entityTypeLabel('renewal_prep')).toBe('Renewal prep');
  });

  it('exposes compliance target constant', () => {
    expect(REVOPS_SLA_COMPLIANCE_TARGET_PCT).toBe(95);
  });
});
