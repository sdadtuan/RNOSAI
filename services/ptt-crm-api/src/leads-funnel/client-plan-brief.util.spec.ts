import {
  clientBriefMissing,
  leadQualifyFacts,
  prefillClientBriefFromTasks,
  readClientBrief,
  writeClientBrief,
} from './client-plan-brief.util';

describe('clientBriefMissing', () => {
  it('flags an empty usp and ignores audience', () => {
    expect(
      clientBriefMissing(
        { usp: '', goal: '40 lịch', channels: 'Facebook' },
        { company_name: 'A', niche: 'Spa', need: 'ít lead' },
      ),
    ).toEqual(['Điểm khác biệt']);
  });

  it('rejects placeholder tokens', () => {
    expect(
      clientBriefMissing(
        { usp: '[cần xác nhận]', goal: '40 lịch', channels: 'Facebook' },
        { company_name: 'A', niche: 'Spa', need: 'ít lead' },
      ),
    ).toEqual(['Điểm khác biệt']);
  });

  it('lists lead facts before brief fields', () => {
    expect(clientBriefMissing({ usp: 'x', goal: 'y', channels: 'z' }, { company_name: '', niche: '', need: '' })).toEqual(
      ['Tên công ty trên hồ sơ lead', 'Ngành KH', 'Nhu cầu cụ thể'],
    );
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

describe('leadQualifyFacts', () => {
  it('reads niche and need from the lead task', () => {
    expect(leadQualifyFacts([{ form_data: { industry: 'Ảnh cưới', need: 'ít lịch' } }])).toEqual({
      niche: 'Ảnh cưới',
      need: 'ít lịch',
    });
  });
});
