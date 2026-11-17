import { normalizeSolutionAiSections } from './solution-ai-draft.util';
import { buildChannelPlan, buildLocalAgencySolution, chosenChannels, clientVoiceIssues } from './solution-ai-strategist.util';
import { renderSolutionProposalPdf } from './solution-proposal-file';

describe('channel plan', () => {
  const facts = {
    companyName: 'Sen Spa & Wellness',
    industry: 'Spa',
    need: 'Quảng cáo ra tin nhắn nhưng ít người đặt lịch, lễ tân trả lời chậm sau 18h.',
    goal: '120 lịch đặt mới mỗi tháng',
    channels: 'Facebook, TikTok, Google, YouTube, Website',
    audience: 'Nữ 25–40 tại Quận 3',
    budget: '50–100 triệu/tháng',
    timeline: '1–3 tháng',
    usp: 'Liệu trình đá nóng 75 phút, kỹ thuật viên cố định',
  };

  it('covers every chosen channel with a PTT proposal table', () => {
    const plan = buildChannelPlan(facts);
    expect(chosenChannels(facts.channels)).toEqual(['Facebook', 'TikTok', 'Google', 'YouTube', 'Website']);
    for (const channel of ['Facebook', 'TikTok', 'Google', 'YouTube', 'Website']) {
      expect(plan).toContain(`## ${channel}`);
    }
    expect(plan).toContain('Đề xuất của PTT');
    expect(plan).toContain('lookalike');
    expect(plan).toContain('spa đá nóng quận 3');
    expect(plan).toContain('Chuyển tin nhắn thành lịch');
    expect(plan).toContain('17,5 triệu');
    expect(plan).not.toContain('Xem khối');
    expect(plan).not.toContain('Phục vụ mục tiêu');
    expect(plan).not.toMatch(/không bịa|không phải số tiền mới|Sales gửi/i);
    const facebook = plan.split('## TikTok')[0];
    const tiktok = plan.split('## TikTok')[1]?.split('## Google')[0] ?? '';
    expect(facebook.toLowerCase()).toContain('bán kính');
    expect(tiktok).toContain('Interest');
    expect(facebook).not.toContain('Interest và hành vi');
    expect(clientVoiceIssues(buildLocalAgencySolution(facts).sections, facts)).toEqual([]);
  });

  it('does not invent a client revenue figure', () => {
    const doc = buildLocalAgencySolution(facts);
    const blob = Object.values(doc.sections).join('\n');
    expect(blob).toContain('120 lịch đặt mới mỗi tháng');
    expect(blob).toContain('50–100 triệu/tháng');
    expect(blob).not.toMatch(/doanh thu\s+\d/);
  });
});

describe('section keys', () => {
  it('reads Vietnamese labels and a section array', () => {
    const fromLabels = normalizeSolutionAiSections({
      'Tóm tắt điều hành': 'Sen Spa cần biến tin nhắn sau 18h thành lịch đã xác nhận, với Facebook và Google dẫn việc chốt.',
      'Kế hoạch kênh': 'Facebook lookalike và bán kính. Google từ khóa spa đá nóng quận 3.',
    });
    expect(fromLabels.executive_summary).toContain('Sen Spa');
    expect(fromLabels.channel_plan).toContain('lookalike');
    const fromArray = normalizeSolutionAiSections([
      { label: 'Chiến lược', body: 'Đề xuất của PTT: chốt giờ trên Messenger, không tăng nhận diện chung.' },
    ]);
    expect(fromArray.strategy).toContain('Đề xuất của PTT');
  });
});

describe('solution proposal pdf', () => {
  it('writes a pdf', async () => {
    const doc = buildLocalAgencySolution({
      companyName: 'Sen Spa & Wellness',
      industry: 'Spa',
      channels: 'Facebook, Zalo',
      goal: '80 lịch',
      budget: '40 triệu/tháng',
    });
    const buf = await renderSolutionProposalPdf({
      title: doc.title,
      clientName: 'Sen Spa & Wellness',
      amName: 'Admin Local',
      dateLabel: '17/11/2026',
      sections: Object.entries(doc.sections).map(([key, body]) => ({ key, label: key, body })),
    });
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
  });
});
