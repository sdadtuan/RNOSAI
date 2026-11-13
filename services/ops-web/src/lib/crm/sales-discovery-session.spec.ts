import { describe, expect, it } from 'vitest';
import {
  normalizeIntakeSessionList,
  pickWorkingSession,
  shouldCreateIntakeDraft,
} from './sales-discovery-session';
import type { IntakeSessionRow } from '@/lib/api';

function row(id: number, status: string): IntakeSessionRow {
  return { id, lead_id: 1, lifecycle_id: null, service_slug: 'x', mode: 'phone', status, contact_name: '', company_name: '', bant_total: 0, decision: '', decision_reason: '', bant_json: {}, answers_json: {}, updated_at: '' } as IntakeSessionRow;
}

describe('normalizeIntakeSessionList', () => {
  it('accepts a raw array and common envelopes', () => {
    const a = [row(1, 'completed')];
    expect(normalizeIntakeSessionList(a)).toEqual(a);
    expect(normalizeIntakeSessionList({ sessions: a })).toEqual(a);
    expect(normalizeIntakeSessionList({ items: a })).toEqual(a);
    expect(normalizeIntakeSessionList({ data: a })).toEqual(a);
    expect(normalizeIntakeSessionList(null)).toEqual([]);
    expect(normalizeIntakeSessionList({})).toEqual([]);
  });
});

describe('pickWorkingSession', () => {
  it('prefers the latest completed session over any draft', () => {
    const list = [row(10, 'draft'), row(11, 'completed'), row(9, 'completed'), row(12, 'draft')];
    const picked = pickWorkingSession(list);
    expect(picked?.id).toBe(11);
    expect(picked?.status).toBe('completed');
  });

  it('falls back to the latest draft when nothing is completed', () => {
    expect(pickWorkingSession([row(3, 'draft'), row(5, 'draft')])?.id).toBe(5);
  });

  it('honours a preferred id when it exists', () => {
    expect(pickWorkingSession([row(11, 'completed'), row(8, 'draft')], 8)?.id).toBe(8);
  });

  it('returns null on an empty list', () => {
    expect(pickWorkingSession([])).toBeNull();
  });
});

describe('shouldCreateIntakeDraft', () => {
  it('is false when a completed session already exists', () => {
    expect(shouldCreateIntakeDraft([row(1, 'completed')])).toBe(false);
    expect(shouldCreateIntakeDraft([row(1, 'completed'), row(2, 'draft')])).toBe(false);
  });

  it('is false when a draft already exists (never duplicate drafts)', () => {
    expect(shouldCreateIntakeDraft([row(2, 'draft')])).toBe(false);
  });

  it('is true only when the lead has no session at all', () => {
    expect(shouldCreateIntakeDraft([])).toBe(true);
  });
});