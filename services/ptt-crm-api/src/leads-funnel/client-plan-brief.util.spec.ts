import {
  clientBriefMissing,
  fillClientBriefFromDiscovery,
  clientBriefPayload,
  emptyClientBrief,
  leadQualifyFacts,
  prefillClientBriefFromTasks,
  resolveLeadNiche,
  readClientBrief,
  writeClientBrief,
} from './client-plan-brief.util';

describe('clientBriefMissing', () => {
  it('does not require USP because Sales Brief has no Điểm khác biệt field', () => {
    expect(
      clientBriefMissing(
        { usp: '', goal: '40 lịch', channels: 'Facebook' },
        { company_name: 'A', niche: 'Spa', need: 'ít lead' },
      ),
    ).toEqual([]);
  });

  it('still rejects placeholder tokens on required goal/channel fields, not USP', () => {
    expect(
      clientBriefMissing(
        { usp: '[cần xác nhận]', goal: '[cần xác nhận]', channels: 'Facebook' },
        { company_name: 'A', niche: 'Spa', need: 'ít lead' },
      ),
    ).toEqual(['Mục tiêu đo được']);
  });

  it('passes lead 32 / plan 40 when USP is empty but Sales Brief fields are filled', () => {
    expect(
      clientBriefMissing(
        { usp: '', goal: '123132', channels: 'Google' },
        { company_name: '32213123', niche: 'spa', need: '12312312' },
      ),
    ).toEqual([]);
  });

  it('still flags missing goal or channels that Sales can enter', () => {
    expect(
      clientBriefMissing(
        { usp: '', goal: '', channels: '' },
        { company_name: 'A', niche: 'Spa', need: 'ít lead' },
      ),
    ).toEqual(['Mục tiêu đo được', 'Kênh muốn chạy và cách chốt đơn']);
  });

  it('lists lead facts before brief fields', () => {
    expect(clientBriefMissing({ usp: 'x', goal: 'y', channels: 'z' }, { company_name: '', niche: '', need: '' })).toEqual(
      ['Tên công ty trên hồ sơ lead', 'Ngành KH', 'Nhu cầu cụ thể'],
    );
  });
});

describe('fillClientBriefFromDiscovery', () => {
  it('maps Sales Brief goal and channels when the client brief uses other names', () => {
    const filled = fillClientBriefFromDiscovery(emptyClientBrief(), {
      marketing_goal: '30 lead/tháng',
      channels: ['facebook', 'google'],
      target_customers: 'Học sinh',
    });
    expect(filled.goal).toBe('30 lead/tháng');
    expect(filled.channels).toBe('facebook, google');
    expect(filled.audience).toBe('Học sinh');
  });

  it('keeps a brief value that is already filled', () => {
    const filled = fillClientBriefFromDiscovery(
      { ...emptyClientBrief(), goal: 'Đã có', channels: 'TikTok' },
      { marketing_goal: 'khác', channels_text: 'Facebook' },
    );
    expect(filled.goal).toBe('Đã có');
    expect(filled.channels).toBe('TikTok');
  });
});

describe('client brief json', () => {
  it('round-trips inside target_market_prof_json', () => {
    const stored = writeClientBrief(
      { segment: 'spa' },
      {
        audience: 'cô dâu',
        usp: 'concept riêng',
        goal: '40 lịch',
        channels: 'Facebook, gọi',
        retain: '',
        competitors: '',
        metrics: '',
        website: 'https://studio.example',
        fanpage: '',
        saved_after_ai: false,
        human_edited_keys: ['market_message'],
      },
    );
    expect(stored.segment).toBe('spa');
    expect(readClientBrief(stored).usp).toBe('concept riêng');
    expect(readClientBrief(stored).human_edited_keys).toEqual(['market_message']);
    expect(readClientBrief(stored).saved_after_ai).toBe(false);
  });

  it('prefills usp and competitors without overwriting', () => {
    const next = prefillClientBriefFromTasks(
      { ...readClientBrief({}), usp: 'đã gõ' },
      [
        {
          form_data: {
            product_usp: 'từ facebook',
            usp: 'từ landing',
            top_competitors: 'Studio B',
            domain: 'studio.example',
          },
        },
      ],
    );
    expect(next.usp).toBe('đã gõ');
    expect(next.competitors).toBe('Studio B');
    expect(next.website).toBe('studio.example');
  });
});

describe('resolveLeadNiche', () => {
  it('keeps the task niche when it is filled', () => {
    expect(resolveLeadNiche('Ảnh cưới', 'Spa & Beauty')).toBe('Ảnh cưới');
  });

  it('uses the industry saved on the lead when the task is empty', () => {
    expect(resolveLeadNiche('', 'Spa & Beauty')).toBe('Spa & Beauty');
    expect(resolveLeadNiche('  ', null)).toBe('');
  });
});

describe('leadQualifyFacts', () => {
  it('reads niche and need from the lead task', () => {
    expect(leadQualifyFacts([{ form_data: { industry: 'Ảnh cưới', need: 'ít lịch' } }])).toEqual({
      niche: 'Ảnh cưới',
      need: 'ít lịch',
    });
  });
});

describe('clientBriefPayload', () => {
  it('returns facts next to the missing list', () => {
    const out = clientBriefPayload(
      { ...emptyClientBrief(), usp: 'Concept', goal: 'Tăng lịch', channels: 'Facebook' },
      { company_name: 'Quý Nguyễn Studio', niche: '', need: 'ít lịch' },
      'consult',
      4,
    );
    expect(out.facts).toEqual({ company_name: 'Quý Nguyễn Studio', niche: '', need: 'ít lịch' });
    expect(out.missing).toEqual(['Ngành KH']);
    expect(out.presales_stage).toBe('consult');
    expect(out.plan_id).toBe(4);
  });
});
