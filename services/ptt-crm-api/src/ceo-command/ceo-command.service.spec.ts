import { ForbiddenException } from '@nestjs/common';
import { CeoCommandService } from './ceo-command.service';
import { CeoCommandTurnsRepository } from './ceo-command-turns.repository';
import { CeoCommandRateService } from './ceo-command-rate.service';
import { CeoCommandBriefingService } from './ceo-command-briefing.service';
import { CeoCommandNlService } from './ceo-command-nl.service';
import { CeoCommandActionsService } from './ceo-command-actions.service';
import { CeoCommandLlmService } from './ceo-command-llm.service';
import { CeoCommandLibraryService } from './ceo-command-library.service';
import { CeoCommandLearnService } from './ceo-command-learn.service';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';

describe('CeoCommandService', () => {
  const turns = { insert: jest.fn(), findById: jest.fn(), rate: jest.fn() };
  const rate = { check: jest.fn() };
  const briefing = { compose: jest.fn() };
  const nl = { run: jest.fn() };
  const actions = { preview: jest.fn(), parseForbidden: jest.fn() };
  const llm = { polish: jest.fn(async (x) => ({ ...x, stub_mode: true, model_name: 'facts' })) };
  const library = { retrieve: jest.fn().mockResolvedValue([]) };
  const learn = { enqueueFromRating: jest.fn() };
  const aiConfig = { ceoCommandLlmEnabled: false, ceoCommandEnabled: true } as AiIntelligenceConfigService;

  const svc = new CeoCommandService(
    aiConfig,
    turns as unknown as CeoCommandTurnsRepository,
    rate as unknown as CeoCommandRateService,
    briefing as unknown as CeoCommandBriefingService,
    nl as unknown as CeoCommandNlService,
    actions as unknown as CeoCommandActionsService,
    llm as unknown as CeoCommandLlmService,
    library as unknown as CeoCommandLibraryService,
    learn as unknown as CeoCommandLearnService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('403 when staffId is 0', async () => {
    await expect(
      svc.turn({ intent: 'freeform', message: 'hi' }, { staffId: 0, caps: [], staffLabel: 'x' }),
    ).rejects.toMatchObject({ response: { error: 'ceo_unresolved_staff' } });
  });

  it('persists freeform out of scope', async () => {
    turns.insert.mockResolvedValue({ id: 't1' });
    actions.parseForbidden.mockReturnValue(null);
    const out = await svc.turn(
      { intent: 'freeform', message: 'xyz' },
      {
        staffId: 9,
        caps: [{ section: 'ceo_command', action: 'view' }],
        staffLabel: 'ceo',
      },
    );
    expect(out.reply_vi).toMatch(/ngoài phạm vi/i);
    expect(out.turn_id).toBe('t1');
    expect(turns.insert).toHaveBeenCalled();
  });
});
