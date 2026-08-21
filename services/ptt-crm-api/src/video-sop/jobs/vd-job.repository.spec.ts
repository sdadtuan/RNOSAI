import { VdJobRepository } from './vd-job.repository';

function makeRepo(): VdJobRepository {
  const repo = new VdJobRepository({
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
  jest.spyOn(repo, 'ensurePgReady').mockResolvedValue(false);
  return repo;
}

describe('VdJobRepository provider ref (CT-04)', () => {
  it('saveProviderRef then findByProviderTask returns the job', async () => {
    const repo = makeRepo();
    const job = await repo.insert({
      project_id: 1,
      shot_id: null,
      queue: 'q.image',
      job_type: 'cine_keyframe',
      status: 'queued',
      idempotency_key: 'ref-a',
      input_json: {},
    });

    await repo.saveProviderRef(job.id, 'leonardo', 'task-111');
    const found = await repo.findByProviderTask('leonardo', 'task-111');
    expect(found?.id).toBe(job.id);
    expect(found?.idempotency_key).toBe('ref-a');
  });

  it('findByProviderTask returns null when unknown', async () => {
    const repo = makeRepo();
    expect(await repo.findByProviderTask('leonardo', 'missing')).toBeNull();
  });

  it('rememberRefIfAbsent skips submit when job already has a ref', async () => {
    const repo = makeRepo();
    const job = await repo.insert({
      project_id: 1,
      shot_id: null,
      queue: 'q.video.runway',
      job_type: 'cine_motion_draft',
      status: 'queued',
      idempotency_key: 'ref-b',
      input_json: {},
    });

    const submit = jest.fn().mockResolvedValue({ provider_task_id: 'task-new' });

    const first = await repo.rememberRefIfAbsent(job.id, 'runway', submit);
    expect(first.provider_task_id).toBe('task-new');
    expect(submit).toHaveBeenCalledTimes(1);

    const second = await repo.rememberRefIfAbsent(job.id, 'runway', submit);
    expect(second.provider_task_id).toBe('task-new');
    expect(submit).toHaveBeenCalledTimes(1);

    const found = await repo.findByProviderTask('runway', 'task-new');
    expect(found?.id).toBe(job.id);
  });
});
