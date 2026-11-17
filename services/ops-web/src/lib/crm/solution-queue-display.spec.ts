import { describe, expect, it } from 'vitest';
import {
  solutionQueueHandedAt,
  solutionQueueOwners,
  solutionQueueServiceName,
  solutionQueueShowStage,
  solutionQueueSlaTone,
  solutionQueueStageLabel,
  solutionQueueStatus,
} from './solution-queue-display';

describe('solution queue display', () => {
  it('uses the Vietnamese service name', () => {
    expect(solutionQueueServiceName('dich-vu-seo-tong-the')).toBe('SEO tổng thể');
    expect(solutionQueueServiceName('nhan-dien-thuong-hieu')).toBe('Nhận diện thương hiệu');
    expect(solutionQueueServiceName('')).toBe('—');
  });

  it('hides the step column when every row is consult', () => {
    expect(solutionQueueShowStage([{ presales_stage: 'consult' }, { presales_stage: 'consult' }])).toBe(false);
    expect(solutionQueueShowStage([{ presales_stage: 'consult' }, { presales_stage: 'proposal' }])).toBe(true);
    expect(solutionQueueStageLabel('consult')).toBe('');
    expect(solutionQueueStageLabel('proposal')).toBe('Đề xuất');
  });

  it('merges sales and AM, and badges the status', () => {
    expect(solutionQueueOwners({ owner_name: 'Lan', solution_owner_name: '' })).toEqual(['Sales: Lan']);
    expect(solutionQueueOwners({ owner_name: '', solution_owner_name: '' })).toEqual([]);
    expect(solutionQueueStatus({ handoff_status: 'pending', solution_owner_name: '' }).label).toBe('Chờ nhận');
    expect(
      solutionQueueStatus({ handoff_status: 'with_solution', solution_owner_name: 'Marketing Leader Local' }),
    ).toEqual({ label: 'Đã nhận', tone: 'green', detail: 'Marketing Leader Local' });
    expect(solutionQueueStatus({ handoff_status: 'released', solution_owner_name: 'An' }).label).toBe('Đã nộp');
    expect(solutionQueueStatus({ queue_kind: 'am_rework', handoff_status: '', solution_owner_name: '' }).label).toBe(
      'Trả lại',
    );
  });

  it('formats the handoff clock and marks SLA', () => {
    const now = new Date('2026-11-17T06:00:00.000Z');
    expect(solutionQueueHandedAt('2026-11-17T05:27:00.000Z', now)).toBe('17/11 12:27');
    expect(solutionQueueHandedAt('2025-11-17T05:27:00.000Z', now)).toBe('17/11/2025 12:27');
    expect(
      solutionQueueSlaTone(
        { handoff_status: 'pending', solution_accept_due_at: '2026-11-17T05:00:00.000Z', solution_due_at: '' },
        now,
      ),
    ).toBe('overdue');
    expect(
      solutionQueueSlaTone(
        { handoff_status: 'pending', solution_accept_due_at: '2026-11-17T06:02:00.000Z', solution_due_at: '' },
        now,
      ),
    ).toBe('near');
    expect(
      solutionQueueSlaTone({ handoff_status: 'with_solution', solution_accept_due_at: '', solution_due_at: '' }, now),
    ).toBeNull();
  });
});