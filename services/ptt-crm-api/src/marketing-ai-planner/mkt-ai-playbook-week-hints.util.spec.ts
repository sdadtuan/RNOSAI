import {
  buildPlaybookWeekHints,
  normalizeOpsTaskName,
  type DoneOpsTaskInput,
} from './mkt-ai-playbook-week-hints.util';

function doneTask(
  lifecycleId: number,
  weekNo: number,
  taskName: string,
  overrides: Partial<DoneOpsTaskInput> = {},
): DoneOpsTaskInput {
  return {
    lifecycleId,
    weekNo,
    taskName,
    status: 'Done',
    ...overrides,
  };
}

describe('normalizeOpsTaskName', () => {
  it('lowercases, trims, and strips punctuation', () => {
    expect(normalizeOpsTaskName('  Launch QA — Pixel  ')).toBe('launch qa pixel');
  });
});

describe('buildPlaybookWeekHints', () => {
  it('returns empty when fewer than 3 lifecycles share Done task', () => {
    const tasks = [
      doneTask(1, 1, 'Launch QA pixel'),
      doneTask(2, 1, 'Launch QA pixel'),
      doneTask(3, 2, 'Launch QA pixel'),
    ];
    expect(buildPlaybookWeekHints(tasks)).toEqual([]);
  });

  it('returns empty when tasks are not Done', () => {
    const tasks = [
      doneTask(1, 1, 'Launch QA pixel', { status: 'Pending' }),
      doneTask(2, 1, 'Launch QA pixel', { status: 'Skipped' }),
      doneTask(3, 1, 'Launch QA pixel', { status: 'Pending' }),
    ];
    expect(buildPlaybookWeekHints(tasks)).toEqual([]);
  });

  it('3 Done week 1 same normalized name → one hint', () => {
    const tasks = [
      doneTask(1, 1, 'Launch QA — Pixel'),
      doneTask(2, 1, 'launch qa pixel'),
      doneTask(3, 1, '  Launch QA Pixel  '),
    ];
    expect(buildPlaybookWeekHints(tasks)).toEqual(['Tuần 1: Launch QA — Pixel']);
  });

  it('separate hints per week when both meet threshold', () => {
    const tasks = [
      doneTask(1, 1, 'Form ngắn'),
      doneTask(2, 1, 'Form ngắn'),
      doneTask(3, 1, 'Form ngắn'),
      doneTask(4, 2, 'Tối ưu creative'),
      doneTask(5, 2, 'Tối ưu creative'),
      doneTask(6, 2, 'Tối ưu creative'),
    ];
    expect(buildPlaybookWeekHints(tasks)).toEqual([
      'Tuần 1: Form ngắn',
      'Tuần 2: Tối ưu creative',
    ]);
  });
});
