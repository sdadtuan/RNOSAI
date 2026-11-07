import { describe, expect, it } from 'vitest';
import {
  bucketLeadsByKanbanColumns,
  bucketLeadsByKanbanStage,
  bucketLeadsFromSolution,
  B2B_KANBAN_COLUMNS,
  isBaoGiaKanbanColumn,
  kanbanColumnIdForLead,
  kanbanColumnsFromSolution,
  leadStatusAtOrAfterConsult,
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

describe('leadStatusAtOrAfterConsult', () => {
  it('keeps the receive SLA on a new or just-contacted lead', () => {
    expect(leadStatusAtOrAfterConsult('moi')).toBe(false);
    expect(leadStatusAtOrAfterConsult('new')).toBe(false);
    expect(leadStatusAtOrAfterConsult('da_lien_he')).toBe(false);
    expect(leadStatusAtOrAfterConsult('qualified')).toBe(false);
    expect(leadStatusAtOrAfterConsult(null)).toBe(false);
  });

  it('closes the receive SLA at Tư vấn and every later stage', () => {
    expect(leadStatusAtOrAfterConsult('dang_tu_van')).toBe(true);
    expect(leadStatusAtOrAfterConsult('nurturing')).toBe(true);
    expect(leadStatusAtOrAfterConsult('consult')).toBe(true);
    expect(leadStatusAtOrAfterConsult('hen_gap')).toBe(true);
    expect(leadStatusAtOrAfterConsult('bao_gia')).toBe(true);
    expect(leadStatusAtOrAfterConsult('proposal')).toBe(true);
    expect(leadStatusAtOrAfterConsult('negotiation')).toBe(true);
    expect(leadStatusAtOrAfterConsult('trien_khai')).toBe(true);
    expect(leadStatusAtOrAfterConsult('won')).toBe(true);
    expect(leadStatusAtOrAfterConsult('post_sale')).toBe(true);
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
      'Triển Khai',
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
      'Triển Khai',
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

  it('keeps Đàm phán on the Báo giá column and Đang tư vấn off it', () => {
    expect(isBaoGiaKanbanColumn('dam_phan')).toBe(true);
    expect(isBaoGiaKanbanColumn('negotiation')).toBe(true);
    expect(isBaoGiaKanbanColumn('proposal')).toBe(true);
    expect(isBaoGiaKanbanColumn('bao_gia')).toBe(true);
    expect(isBaoGiaKanbanColumn('dang_tu_van')).toBe(false);
    expect(isBaoGiaKanbanColumn('trien_khai')).toBe(false);
  });
});

describe('kanbanColumnsFromSolution', () => {
  it('drops Sale columns before Solution and keeps quote plus Triển Khai', () => {
    const ids = kanbanColumnsFromSolution().map((column) => column.id);
    expect(ids.slice(0, 4)).toEqual(['solution', 'bao_gia', 'trien_khai', 'won']);
    expect(ids).not.toContain('moi');
    expect(ids).not.toContain('da_lien_he');
    expect(ids).not.toContain('dang_tu_van');
  });

  it('parks a handed-off consult lead on Đợi Solution and keeps Đàm phán on Báo giá', () => {
    const byColumn = bucketLeadsFromSolution([
      { id: 920003, status: 'dang_tu_van' },
      { id: 900000001, status: 'dang_tu_van' },
      { id: 920865, status: 'dam_phan' },
      { id: 7, status: 'trien_khai' },
    ]);
    expect(byColumn.solution.map((row) => row.id)).toEqual([920003, 900000001]);
    expect(byColumn.bao_gia.map((row) => row.id)).toEqual([920865]);
    expect(byColumn.trien_khai.map((row) => row.id)).toEqual([7]);
    expect(byColumn.moi).toBeUndefined();
    expect(byColumn.dang_tu_van).toBeUndefined();
  });

  it('keeps Báo giá only when Solution was submitted, and parks the rest on the previous step', () => {
    const bySale = bucketLeadsByKanbanColumns(
      [
        { id: 920685, status: 'dam_phan', solution_handoff: 'with_solution', has_quote: false },
        { id: 920505, status: 'proposal', solution_handoff: 'pending' },
        { id: 11, status: 'bao_gia', solution_handoff: 'released', quote_sheet_saved: false },
        { id: 12, status: 'trien_khai', solution_handoff: 'released', quote_approved: false },
        { id: 13, status: 'trien_khai', solution_handoff: 'released', quote_approved: true },
        { id: 14, status: 'won', quote_approved: false, has_contract: false, solution_handoff: '' },
        { id: 15, status: 'won', quote_approved: true, has_contract: true },
      ],
      B2B_KANBAN_COLUMNS,
    );
    expect(bySale.dang_tu_van.map((row) => row.id)).toEqual([920685, 920505, 14]);
    expect(bySale.bao_gia.map((row) => row.id)).toEqual([11, 12]);
    expect(bySale.trien_khai.map((row) => row.id)).toEqual([13]);
    expect(bySale.won.map((row) => row.id)).toEqual([15]);

    const bySolution = bucketLeadsFromSolution([
      { id: 920685, status: 'dam_phan', solution_handoff: 'with_solution' },
      { id: 11, status: 'bao_gia', solution_handoff: 'released' },
    ]);
    expect(bySolution.solution.map((row) => row.id)).toEqual([920685]);
    expect(bySolution.bao_gia.map((row) => row.id)).toEqual([11]);
    expect(kanbanColumnIdForLead({ status: 'negotiation', solution_handoff: 'pending' })).toBe('dang_tu_van');
  });
});
