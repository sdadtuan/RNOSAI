import { describe, expect, it } from 'vitest';
import {
  bucketLeadsByKanbanStage,
  leadStatusLabel,
  normalizeLeadStatus,
} from './lead-status';

describe('normalizeLeadStatus', () => {
  it('maps funnel first_contact to moi for kanban columns', () => {
    expect(normalizeLeadStatus('first_contact')).toBe('moi');
    expect(normalizeLeadStatus('new')).toBe('moi');
    expect(normalizeLeadStatus('qualify')).toBe('da_lien_he');
  });

  it('passes through known CRM statuses', () => {
    expect(normalizeLeadStatus('da_lien_he')).toBe('da_lien_he');
    expect(normalizeLeadStatus('proposal')).toBe('proposal');
  });
});

describe('bucketLeadsByKanbanStage', () => {
  const stages = ['moi', 'da_lien_he', 'bao_gia', 'lost'] as const;

  it('places first_contact leads into moi so kanban is not empty', () => {
    const { byStage, stageKeys } = bucketLeadsByKanbanStage(
      [
        { id: 1, status: 'first_contact' },
        { id: 2, status: 'first_contact' },
        { id: 3, status: 'bao_gia' },
      ],
      stages,
    );
    expect(byStage.moi.map((r) => r.id)).toEqual([1, 2]);
    expect(byStage.bao_gia.map((r) => r.id)).toEqual([3]);
    expect(byStage.__other__).toEqual([]);
    expect(stageKeys).not.toContain('__other__');
  });

  it('keeps unknown statuses in __other__ column', () => {
    const { byStage, stageKeys } = bucketLeadsByKanbanStage(
      [{ id: 9, status: 'weird_custom' }],
      stages,
    );
    expect(byStage.__other__.map((r) => r.id)).toEqual([9]);
    expect(stageKeys.at(-1)).toBe('__other__');
    expect(leadStatusLabel('__other__')).toBe('Khác');
  });
});
