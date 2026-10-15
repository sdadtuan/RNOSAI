import { describe, expect, it } from 'vitest';
import {
  bucketLeadsByKanbanColumns,
  bucketLeadsByKanbanStage,
  B2B_KANBAN_COLUMNS,
  leadStatusLabel,
  leadListFilterOptions,
  leadStatusSearchCallResults,
  leadStatusSearchHandoffs,
  leadStatusSearchOptions,
  leadStatusSearchStatuses,
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

describe('leadStatusSearchOptions', () => {
  it('lists the board columns in Vietnamese and includes every code in Báo giá', () => {
    const options = leadStatusSearchOptions('b2b_prospect');
    expect(options.map((option) => option.label)).toEqual([
      'Mới',
      'Đã liên hệ',
      'Đang tư vấn',
      'Báo giá',
      'Chốt',
      'Thất bại',
      'Chăm sóc lại',
      'Chờ dọn',
    ]);
    expect(leadStatusSearchStatuses('bao_gia', 'b2b_prospect')).toEqual([
      'bao_gia',
      'proposal',
      'dam_phan',
      'negotiation',
    ]);
    expect(leadStatusLabel('proposal')).toBe('Báo giá');
    expect(leadStatusLabel('won')).toBe('Chốt');
  });

  it('adds the call and Solution labels beside the board columns', () => {
    const options = leadListFilterOptions('b2b_prospect');
    expect(options.map((option) => option.label)).toEqual([
      'Mới',
      'Đã liên hệ',
      'Đang tư vấn',
      'Báo giá',
      'Chốt',
      'Thất bại',
      'Chăm sóc lại',
      'Không nghe máy',
      'Máy bận',
      'Hẹn gọi lại',
      'Sai số',
      'Đã nói chuyện',
      'Đã chuyển Solution',
      'Chờ dọn',
    ]);
    expect(leadStatusSearchStatuses('hen_goi_lai', 'b2b_prospect')).toEqual([]);
    expect(leadStatusSearchCallResults('hen_goi_lai', 'b2b_prospect')).toEqual([
      'callback_requested',
      'callback',
      'khach_hen_goi_lai',
    ]);
    expect(leadStatusSearchHandoffs('da_chuyen_solution', 'b2b_prospect')).toEqual([
      'pending',
      'with_solution',
    ]);
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

describe('bucketLeadsByKanbanColumns', () => {
  it('places each stored status on its column', () => {
    const byColumn = bucketLeadsByKanbanColumns(
      [
        { id: 1, status: 'first_contact' },
        { id: 2, status: 'proposal' },
        { id: 3, status: 'chot' },
        { id: 4, status: 'nurture' },
      ],
      B2B_KANBAN_COLUMNS,
    );
    expect(byColumn.da_lien_he.map((row) => row.id)).toEqual([1]);
    expect(byColumn.bao_gia.map((row) => row.id)).toEqual([2]);
    expect(byColumn.won.map((row) => row.id)).toEqual([3]);
    expect(byColumn.nurture.map((row) => row.id)).toEqual([4]);
  });
});
