import { createHash } from 'crypto';
import { VdAssetRepository } from '../assets/vd-asset.repository';
import { VdJobRepository } from '../jobs/vd-job.repository';
import { VdDispatcherService } from './vd-dispatcher.service';
import * as router from './vd-model-router';

function makeJobRepo(): VdJobRepository {
  const repo = new VdJobRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

function makeAssetRepo(): VdAssetRepository {
  const repo = new VdAssetRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

describe('VdDispatcherService', () => {
  let jobRepo: VdJobRepository;
  let assetRepo: VdAssetRepository;
  let dispatcher: VdDispatcherService;
  let handler: jest.Mock;

  beforeEach(() => {
    jobRepo = makeJobRepo();
    assetRepo = makeAssetRepo();
    handler = jest.fn().mockResolvedValue({});
    dispatcher = new VdDispatcherService(jobRepo, assetRepo);
    dispatcher.registerHandler('cine_keyframe', handler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('marks job failed auth when handler throws Error(auth)', async () => {
    handler.mockRejectedValue(new Error('auth'));
    const job = await dispatcher.enqueue({
      projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-auth',
    });
    await dispatcher.drainForTest(job.id);
    expect(jobRepo.last.status).toBe('failed');
    expect(jobRepo.last.error_class).toBe('auth');
  });

  it('fails default cine_keyframe with error_class auth when both keys missing', async () => {
    jest.spyOn(router, 'selectImageGen').mockImplementation(() => {
      throw new Error('auth');
    });
    const fresh = new VdDispatcherService(jobRepo, assetRepo);
    const job = await fresh.enqueue({
      projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: { prompt: 'x' }, idempotencyKey: 'job-no-key',
    });
    await fresh.drainForTest(job.id);
    expect(jobRepo.last.status).toBe('failed');
    expect(jobRepo.last.error_class).toBe('auth');
    expect(assetRepo.last).toBeUndefined();
  });

  it('does not surface unhandledRejection when run() hits a PG blip', async () => {
    jest.spyOn(jobRepo, 'getById').mockRejectedValue(new Error('pg_blip'));
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      await dispatcher.enqueue({
        projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-pg',
      });
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('clamps unknown error_class to unknown', async () => {
    handler.mockRejectedValue(Object.assign(new Error('weird'), { error_class: 'SQLSTATE' }));
    const job = await dispatcher.enqueue({
      projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-clamp',
    });
    await dispatcher.drainForTest(job.id);
    expect(jobRepo.last.status).toBe('failed');
    expect(jobRepo.last.error_class).toBe('unknown');
  });

  it('rejects idempotency_key reused on a different project', async () => {
    await dispatcher.enqueue({
      projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-shared',
    });
    await expect(
      dispatcher.enqueue({
        projectId: 2, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-shared',
      }),
    ).rejects.toThrow('idempotency_key_conflict');
  });

  it('fails cine_keyframe with provider when generate returns empty buffer', async () => {
    jest.spyOn(router, 'selectImageGen').mockReturnValue({
      providerName: 'flux',
      generate: async () => ({
        buffer: Buffer.alloc(0),
        provider: 'flux',
        providerId: 'pred-empty',
        seed: 1,
      }),
    });
    const fresh = new VdDispatcherService(jobRepo, assetRepo);
    const job = await fresh.enqueue({
      projectId: 1,
      queue: 'q.image',
      jobType: 'cine_keyframe',
      payload: { prompt: 'empty' },
      idempotencyKey: 'job-empty',
    });
    await fresh.drainForTest(job.id);
    expect(jobRepo.last.status).toBe('failed');
    expect(jobRepo.last.error_class).toBe('provider');
    expect(assetRepo.last).toBeUndefined();
  });

  it('inserts keyframe asset and output_json when generate returns a buffer', async () => {
    const buffer = Buffer.from('vd-keyframe');
    jest.spyOn(router, 'selectImageGen').mockReturnValue({
      providerName: 'flux',
      generate: async () => ({
        buffer,
        provider: 'flux',
        providerId: 'pred-1',
        seed: 9,
      }),
    });
    const fresh = new VdDispatcherService(jobRepo, assetRepo);
    const job = await fresh.enqueue({
      projectId: 1,
      queue: 'q.image',
      jobType: 'cine_keyframe',
      payload: { prompt: 'S2 keyframe', width: 1024, height: 768 },
      idempotencyKey: 'job-ok',
    });
    await fresh.drainForTest(job.id);
    expect(jobRepo.last.status).toBe('succeeded');
    expect(assetRepo.last.kind).toBe('keyframe');
    expect(assetRepo.last.url).toBe('');
    expect(assetRepo.last.sha256).toBe(createHash('sha256').update(buffer).digest('hex'));
    expect(jobRepo.last.output_json).toEqual({
      provider: 'flux',
      providerId: 'pred-1',
      seed: 9,
      asset_id: assetRepo.last.id,
    });
  });
});
