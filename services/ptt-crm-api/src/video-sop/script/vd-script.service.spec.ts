import { STUB_IDEAS } from '../adapters/i-text-gen';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdIdeaRepository } from './vd-idea.repository';
import { VdShotRepository } from './vd-shot.repository';
import { VdScriptService } from './vd-script.service';

function makeScriptService() {
  const config = {
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: false,
  };
  const projects = new VdProjectRepository(config as never);
  jest.spyOn(projects, 'ensurePgReady').mockResolvedValue(false);
  const ideas = new VdIdeaRepository(config as never);
  jest.spyOn(ideas, 'ensurePgReady').mockResolvedValue(false);
  const shots = new VdShotRepository(config as never);
  jest.spyOn(shots, 'ensurePgReady').mockResolvedValue(false);
  const dispatcher = { enqueue: jest.fn() };
  return new VdScriptService(config as never, projects, ideas, shots, dispatcher as never);
}

describe('VdScriptService', () => {
  it('writes three stub ideas ordinal 1..3', async () => {
    const scriptService = makeScriptService();
    const rows = await scriptService.materializeStubIdeas(1);
    expect(rows.map((r) => r.ordinal)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.summary)).toEqual([...STUB_IDEAS]);
  });
});
