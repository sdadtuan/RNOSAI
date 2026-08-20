import { STUB_IDEAS } from '../adapters/i-text-gen';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdIdeaRepository } from './vd-idea.repository';
import { VdShotRepository } from './vd-shot.repository';
import { VdScriptService } from './vd-script.service';

function makeScriptService(opts?: { cinematic?: boolean }) {
  const config = {
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: opts?.cinematic ?? false,
  };
  const projects = new VdProjectRepository(config as never);
  jest.spyOn(projects, 'ensurePgReady').mockResolvedValue(false);
  const ideas = new VdIdeaRepository(config as never);
  jest.spyOn(ideas, 'ensurePgReady').mockResolvedValue(false);
  const shots = new VdShotRepository(config as never);
  jest.spyOn(shots, 'ensurePgReady').mockResolvedValue(false);
  const dispatcher = { enqueue: jest.fn() };
  return {
    service: new VdScriptService(config as never, projects, ideas, shots, dispatcher as never),
    projects,
    shots,
  };
}

const validShotBody = {
  duration_ms: 3000,
  text_in_frame: false,
  contains_human: false,
  aspect: '9:16',
  camera: 'push in',
  action: 'walk',
  logo_in_ai_frame: false,
  seed: 1,
};

describe('VdScriptService', () => {
  it('writes three stub ideas ordinal 1..3', async () => {
    const { service } = makeScriptService();
    const rows = await service.materializeStubIdeas(1);
    expect(rows.map((r) => r.ordinal)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.summary)).toEqual([...STUB_IDEAS]);
  });

  it('addShot throws feasibility_blocked when duration_ms is 16000', async () => {
    const { service, projects, shots } = makeScriptService({ cinematic: true });
    jest.spyOn(projects, 'getScriptById').mockResolvedValue({
      id: 1,
      project_id: 1,
      version: 1,
      markdown: '',
    });
    const insert = jest.spyOn(shots, 'insert');
    await expect(
      service.addShot(1, { ...validShotBody, duration_ms: 16000 }),
    ).rejects.toThrow(/feasibility_blocked/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('addShot batch throws feasibility_blocked when shot count is 1', async () => {
    const { service, projects, shots } = makeScriptService({ cinematic: true });
    jest.spyOn(projects, 'getScriptById').mockResolvedValue({
      id: 1,
      project_id: 1,
      version: 1,
      markdown: '',
    });
    jest.spyOn(projects, 'getBrief').mockResolvedValue({});
    const insert = jest.spyOn(shots, 'insert');
    await expect(service.addShot(1, { shots: [{ ...validShotBody }] })).rejects.toThrow(
      /feasibility_blocked/,
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
