import { VdJobRepository } from '../jobs/vd-job.repository';
import { VdDispatcherService } from './vd-dispatcher.service';

function makeRepo(): VdJobRepository {
  const repo = new VdJobRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

describe('VdDispatcherService', () => {
  let jobRepo: VdJobRepository;
  let dispatcher: VdDispatcherService;
  let handler: jest.Mock;

  beforeEach(() => {
    jobRepo = makeRepo();
    handler = jest.fn().mockResolvedValue({});
    dispatcher = new VdDispatcherService(jobRepo);
    dispatcher.registerHandler('cine_keyframe', handler);
  });

  it('returns existing row when idempotency_key repeats', async () => {
    const a = await dispatcher.enqueue({
      projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-aaa',
    });
    const b = await dispatcher.enqueue({
      projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-aaa',
    });
    expect(b.id).toBe(a.id);
  });

  it('retries transient up to 3 then failed', async () => {
    handler.mockRejectedValue(Object.assign(new Error('up'), { error_class: 'transient' }));
    const job = await dispatcher.enqueue({
      projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-bbb',
    });
    await dispatcher.drainForTest(job.id);
    expect(jobRepo.last.status).toBe('failed');
    expect(jobRepo.last.attempt).toBe(3);
  });
});
