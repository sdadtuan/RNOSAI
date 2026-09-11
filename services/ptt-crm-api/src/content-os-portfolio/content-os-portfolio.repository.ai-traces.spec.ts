import { ContentOsPortfolioRepository } from './content-os-portfolio.repository';

function makeRepo(query: jest.Mock) {
  const repo = new ContentOsPortfolioRepository({ databaseUrl: 'postgres://test' } as never);
  Object.assign(repo, { pool: { query }, pgReady: true });
  return repo;
}

describe('ContentOsPortfolioRepository.listAiTraceJobs', () => {
  it('returns empty when the item has no jobs', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = makeRepo(query);
    await expect(repo.listAiTraceJobs(21)).resolves.toEqual([]);
  });

  it('joins ai_agent_runs when present', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 55,
          job_type: 'draft_generate',
          status: 'succeeded',
          created_at: '2026-09-10T08:00:00.000Z',
          finished_at: '2026-09-10T08:01:00.000Z',
          ai_run_id: 'run-1',
          input_json: { copilotSources: [{ id: 11, pattern: 'hook' }] },
          run_id: 'run-1',
          run_input_json: { profile: 'blog' },
        },
      ],
    });
    const repo = makeRepo(query);
    const rows = await repo.listAiTraceJobs(21);
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/LEFT JOIN ai_agent_runs/), [21]);
    expect(rows[0]).toMatchObject({
      id: 55,
      ai_run_id: 'run-1',
      run: { id: 'run-1', input_json: { profile: 'blog' } },
    });
  });

  it('falls back to job-only rows when the run join is missing', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('relation "ai_agent_runs" does not exist'), { code: '42P01' }))
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            job_type: 'regenerate',
            status: 'queued',
            created_at: '2026-09-11T01:00:00.000Z',
            finished_at: null,
            ai_run_id: null,
            input_json: {},
          },
        ],
      });
    const repo = makeRepo(query);
    const rows = await repo.listAiTraceJobs(21);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).not.toMatch(/ai_agent_runs/);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(9);
    expect(rows[0].run).toBeUndefined();
  });
});
