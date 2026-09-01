import {
  classifyCorpus,
  type CorpusLifecycleInput,
} from './mkt-ai-playbook-corpus.util';

const SLUG = 'meta-lead-gen';

function baseRow(overrides: Partial<CorpusLifecycleInput> = {}): CorpusLifecycleInput {
  return {
    lifecycleId: 1,
    serviceSlug: SLUG,
    applied: true,
    qualityScore: 75,
    humanEditedAfterGenerate: true,
    isUatSeed: false,
    stage: 'closed',
    closedLoopWin: false,
    hasTier3Artifact: false,
    ...overrides,
  };
}

describe('classifyCorpus', () => {
  it('4 HĐ → canLearn=false, remaining=1', () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      baseRow({ lifecycleId: i + 1, closedLoopWin: true }),
    );
    const r = classifyCorpus(SLUG, rows);
    expect(r.canLearn).toBe(false);
    expect(r.remaining).toBe(1);
    expect(r.candidates).toHaveLength(4);
  });

  it('5 candidates + 2 winners → shallow + canLearn', () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) =>
        baseRow({ lifecycleId: i + 1, closedLoopWin: true }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        baseRow({ lifecycleId: i + 3, closedLoopWin: false }),
      ),
    ];
    const r = classifyCorpus(SLUG, rows);
    expect(r.canLearn).toBe(true);
    expect(r.depth).toBe('shallow');
    expect(r.candidates).toHaveLength(5);
    expect(r.winners).toHaveLength(2);
    expect(r.remaining).toBe(0);
  });

  it('5 candidates + 3 winners without tier-3 artifacts → shallow', () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      baseRow({
        lifecycleId: i + 1,
        closedLoopWin: true,
        hasTier3Artifact: false,
      }),
    ).concat(
      Array.from({ length: 2 }, (_, i) =>
        baseRow({ lifecycleId: i + 4, closedLoopWin: false }),
      ),
    );
    const r = classifyCorpus(SLUG, rows);
    expect(r.canLearn).toBe(true);
    expect(r.depth).toBe('shallow');
    expect(r.winners).toHaveLength(3);
    expect(r.winners.every((w) => !w.hasTier3Artifact)).toBe(true);
  });

  it('5 candidates + 3 winners + 3 tier-3 artifacts → deep', () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      baseRow({
        lifecycleId: i + 1,
        closedLoopWin: true,
        hasTier3Artifact: true,
      }),
    ).concat(
      Array.from({ length: 2 }, (_, i) =>
        baseRow({ lifecycleId: i + 4, closedLoopWin: false }),
      ),
    );
    const r = classifyCorpus(SLUG, rows);
    expect(r.canLearn).toBe(true);
    expect(r.depth).toBe('deep');
    expect(r.winners).toHaveLength(3);
    expect(r.winners.every((w) => w.hasTier3Artifact)).toBe(true);
  });

  it('excludes UAT seed and sqliteLeadId >= 900000901', () => {
    const rows = [
      baseRow({ lifecycleId: 1, isUatSeed: true }),
      baseRow({ lifecycleId: 2, sqliteLeadId: 900000901 }),
      baseRow({ lifecycleId: 3, sqliteLeadId: 900000902 }),
      ...Array.from({ length: 5 }, (_, i) =>
        baseRow({ lifecycleId: i + 10, closedLoopWin: true }),
      ),
    ];
    const r = classifyCorpus(SLUG, rows);
    expect(r.candidates).toHaveLength(5);
    expect(r.candidates.every((c) => !c.isUatSeed)).toBe(true);
    expect(r.candidates.every((c) => c.sqliteLeadId == null || c.sqliteLeadId < 900000901)).toBe(
      true,
    );
  });

  it('filters wrong slug, not applied, low quality, not human-edited', () => {
    const rows = [
      baseRow({ lifecycleId: 1, serviceSlug: 'other-slug' }),
      baseRow({ lifecycleId: 2, applied: false }),
      baseRow({ lifecycleId: 3, qualityScore: 69 }),
      baseRow({ lifecycleId: 4, humanEditedAfterGenerate: false }),
      baseRow({ lifecycleId: 5 }),
    ];
    const r = classifyCorpus(SLUG, rows);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].lifecycleId).toBe(5);
  });
});
