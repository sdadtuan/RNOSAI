import { buildProposalAdvanceGate } from './presales-proposal-gate.util';

const readyLeave = {
  company_name: 'Quý Nguyễn Studio',
  niche: 'Ảnh cưới',
  need: 'Lịch chụp giảm',
  brief: {
    usp: 'Concept riêng',
    goal: '40 lịch mỗi tháng',
    channels: 'Facebook, gọi xác nhận',
    saved_after_ai: true,
  },
};

describe('buildProposalAdvanceGate', () => {
  it('blocks when consult task incomplete', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 0 },
      plan: {
        name: 'Plan',
        north_star: 'NS',
        objectives: '',
        strategy_framework_json: JSON.stringify({
          market_message: 'msg',
          media_reach: 'media',
          conversion_strategy: 'conv',
        }),
      },
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages[0]).toContain('Consult');
  });

  it('blocks when R5 incomplete', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 1 },
      plan: { name: '', north_star: '', objectives: '', strategy_framework_json: '{}' },
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages.some((m) => m.includes('kế hoạch') || m.includes('North Star'))).toBe(true);
  });

  it('passes when consult done and R5 JSONB is a parsed object', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 1 },
      plan: {
        name: 'KH sơ bộ',
        north_star: 'Tăng lead',
        objectives: '',
        strategy_framework_json: {
          market_message: 'msg',
          media_reach: 'media',
          conversion_strategy: 'conv',
        },
      },
      clientLeave: readyLeave,
    });
    expect(gate.ok).toBe(true);
  });

  it('passes when consult done and R5 valid', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 1 },
      plan: {
        name: 'KH sơ bộ',
        north_star: 'Tăng lead',
        objectives: '',
        strategy_framework_json: JSON.stringify({
          market_message: 'msg',
          media_reach: 'media',
          conversion_strategy: 'conv',
        }),
      },
      clientLeave: readyLeave,
    });
    expect(gate.ok).toBe(true);
    expect(gate.level).toBe('ok');
  });

  it('blocks when the brief is saved but the AI draft was not confirmed', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 1 },
      plan: {
        name: 'KH sơ bộ',
        north_star: 'Tăng lead',
        objectives: '',
        strategy_framework_json: {
          market_message: 'msg',
          media_reach: 'media',
          conversion_strategy: 'conv',
        },
      },
      clientLeave: { ...readyLeave, brief: { ...readyLeave.brief, saved_after_ai: false } },
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages).toContain('Solution chưa lưu sau bản AI.');
  });

  it('does not block on an empty website', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 1 },
      plan: {
        name: 'KH sơ bộ',
        north_star: 'Tăng lead',
        objectives: '',
        strategy_framework_json: {
          market_message: 'msg',
          media_reach: 'media',
          conversion_strategy: 'conv',
        },
      },
      clientLeave: {
        ...readyLeave,
        brief: { ...readyLeave.brief, website: '', fanpage: '', audience: '' },
      },
    });
    expect(gate.ok).toBe(true);
  });
});
