import { isSaleKanbanStatusMove, saleOwnerMayMoveKanban } from './kanban-sale-action.util';

describe('kanban sale actions', () => {
  it('treats return, proposal advance, and signed as Sale moves', () => {
    expect(isSaleKanbanStatusMove('bao_gia', 'dang_tu_van')).toBe(true);
    expect(isSaleKanbanStatusMove('bao_gia', 'proposal')).toBe(true);
    expect(isSaleKanbanStatusMove('proposal', 'bao_gia')).toBe(true);
    expect(isSaleKanbanStatusMove('dam_phan', 'bao_gia')).toBe(true);
    expect(isSaleKanbanStatusMove('won', 'proposal')).toBe(true);
    expect(isSaleKanbanStatusMove('won', 'chot')).toBe(true);
    expect(isSaleKanbanStatusMove('dang_tu_van', 'bao_gia')).toBe(false);
    expect(isSaleKanbanStatusMove('bao_gia', 'bao_gia')).toBe(false);
  });

  it('allows only the AE who owns the lead', () => {
    expect(saleOwnerMayMoveKanban({ staffId: 107, ownerId: 107, positionCode: 'AE' })).toBe(true);
    expect(saleOwnerMayMoveKanban({ staffId: 2, ownerId: 107, positionCode: 'AE' })).toBe(false);
    expect(saleOwnerMayMoveKanban({ staffId: 108, ownerId: 108, positionCode: 'ACM' })).toBe(false);
    expect(saleOwnerMayMoveKanban({ staffId: 5, ownerId: 5, positionCode: 'MKL' })).toBe(false);
    expect(saleOwnerMayMoveKanban({ staffId: 1, ownerId: 1, positionCode: 'SUPER-ADMIN' })).toBe(false);
  });
});
