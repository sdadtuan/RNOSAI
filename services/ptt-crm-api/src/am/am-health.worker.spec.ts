import { AmHealthWorker } from './am-health.worker';

it('delegates to health.recompute', async () => {
  const health = { recompute: jest.fn(async () => ({ as_of: '2026-09-05', computed: 2, skipped: 0, dist: {} })) };
  const worker = new AmHealthWorker(health as never);
  const out = await worker.run({ asOf: '2026-09-05' });
  expect(health.recompute).toHaveBeenCalledWith({ asOf: '2026-09-05' });
  expect(out.computed).toBe(2);
});
