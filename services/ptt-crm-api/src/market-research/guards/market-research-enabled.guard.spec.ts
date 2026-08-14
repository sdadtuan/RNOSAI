import { NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { MarketResearchEnabledGuard } from './market-research-enabled.guard';

describe('MarketResearchEnabledGuard', () => {
  it('throws market_research_disabled when flag is off', () => {
    const guard = new MarketResearchEnabledGuard({
      marketResearchEnabled: false,
    } as unknown as AppConfigService);

    expect(() => guard.canActivate({} as never)).toThrow(NotFoundException);
    try {
      guard.canActivate({} as never);
    } catch (err) {
      expect((err as NotFoundException).getResponse()).toEqual({
        error: 'market_research_disabled',
      });
    }
  });

  it('allows the request when flag is on', () => {
    const guard = new MarketResearchEnabledGuard({
      marketResearchEnabled: true,
    } as unknown as AppConfigService);

    expect(guard.canActivate({} as never)).toBe(true);
  });
});

describe('Market Research config parse', () => {
  const saved: Record<string, string | undefined> = {};
  const keys = [
    'PTT_MARKET_RESEARCH_ENABLED',
    'MAX_TAVILY_CREDITS_PER_RESEARCH',
    'RESEARCH_DEEP_PROVIDER',
    'RESEARCH_DEEP_TIMEOUT_SEC',
  ];

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('defaults flag off, tavily cap 12, deep timeout 900, provider openai', () => {
    const config = new AppConfigService();
    expect(config.marketResearchEnabled).toBe(false);
    expect(config.maxTavilyCreditsPerResearch).toBe(12);
    expect(config.researchDeepProvider).toBe('openai');
    expect(config.researchDeepTimeoutSec).toBe(900);
  });

  it('parses enabled flag and numeric caps from env', () => {
    process.env.PTT_MARKET_RESEARCH_ENABLED = 'true';
    process.env.MAX_TAVILY_CREDITS_PER_RESEARCH = '8';
    process.env.RESEARCH_DEEP_PROVIDER = 'Anthropic';
    process.env.RESEARCH_DEEP_TIMEOUT_SEC = '120';
    const config = new AppConfigService();
    expect(config.marketResearchEnabled).toBe(true);
    expect(config.maxTavilyCreditsPerResearch).toBe(8);
    expect(config.researchDeepProvider).toBe('anthropic');
    expect(config.researchDeepTimeoutSec).toBe(120);
  });
});
