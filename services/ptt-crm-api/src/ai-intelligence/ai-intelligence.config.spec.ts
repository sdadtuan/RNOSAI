import { AiIntelligenceConfigService } from './ai-intelligence.config';

describe('AiIntelligenceConfigService', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults copilot off and parses pilot ids', () => {
    delete process.env.PTT_AI_COPILOT_ENABLED;
    process.env.PTT_AI_PILOT_USER_IDS = ' u1 , u2 ';
    const cfg = new AiIntelligenceConfigService();
    expect(cfg.copilotEnabled).toBe(false);
    expect(cfg.pilotUserIds).toEqual(['u1', 'u2']);
    expect(cfg.isPilotUser('u1')).toBe(true);
    expect(cfg.isPilotUser('other')).toBe(false);
  });

  it('allows any staff when pilot list empty', () => {
    delete process.env.PTT_AI_PILOT_USER_IDS;
    const cfg = new AiIntelligenceConfigService();
    expect(cfg.isPilotUser('anyone')).toBe(true);
  });

  it('defaults the AI tools API off and parses its feature flag', () => {
    delete process.env.PTT_AI_TOOLS_API_ENABLED;
    expect(new AiIntelligenceConfigService().toolsApiEnabled).toBe(false);

    process.env.PTT_AI_TOOLS_API_ENABLED = '1';
    expect(new AiIntelligenceConfigService().toolsApiEnabled).toBe(true);
  });
});
