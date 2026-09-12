import { CpWeaveIngestWorker } from './cp-weave-ingest.worker';

describe('CpWeaveIngestWorker', () => {
  const prev = process.env.PTT_WEAVE_INGEST;

  afterEach(() => {
    process.env.PTT_WEAVE_INGEST = prev;
  });

  it('does not start a folder watcher when PTT_WEAVE_INGEST is off', () => {
    process.env.PTT_WEAVE_INGEST = '0';
    const weave = { ingestKey: jest.fn() };
    const worker = new CpWeaveIngestWorker(weave as never);
    worker.onModuleInit();
    expect(worker.isWatching()).toBe(false);
    worker.onModuleDestroy();
  });

  it('starts a folder watcher interval when PTT_WEAVE_INGEST=1', () => {
    process.env.PTT_WEAVE_INGEST = '1';
    const weave = { ingestKey: jest.fn() };
    const worker = new CpWeaveIngestWorker(weave as never);
    worker.onModuleInit();
    expect(worker.isWatching()).toBe(true);
    worker.onModuleDestroy();
    expect(worker.isWatching()).toBe(false);
  });
});
