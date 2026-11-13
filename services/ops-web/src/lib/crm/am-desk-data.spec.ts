import { describe, expect, it } from 'vitest';
import {
  buildAmDeskBrief,
  checklistSourceFromMerged,
  firstFilled,
  hrefForUrl,
  humanizeSource,
  isFilled,
} from './am-desk-data';

describe('am-desk-data', () => {
  it('treats dashes and blank strings as empty', () => {
    expect(isFilled('')).toBe(false);
    expect(isFilled('—')).toBe(false);
    expect(isFilled('  ')).toBe(false);
    expect(isFilled('Dịch vụ')).toBe(true);
    expect(firstFilled('', '—', '  Chăm sóc fanpage  ')).toBe('Chăm sóc fanpage');
  });

  it('builds a usable brief from a legacy lead with no Discovery session', () => {
    const view = buildAmDeskBrief({
      lead: {
        company_name: 'Công ty Seed 915',
        full_name: 'Phạm Hà 920915',
        phone: '0900000915',
        email: 'seed920915@local.test',
        source: 'tiktok',
        channel: 'tiktok',
      },
      session: {
        company_name: 'Công ty Seed 915',
        contact_name: 'Phạm Hà 920915',
        source: 'tiktok',
        service_slug: 'ads',
        lead_temperature: 'warm',
        decision: 'go',
        decision_reason: 'local-seed',
        bant_score: 24,
        answers_json: { need: 'Chăm sóc fanpage', bant_checklist: { budget: 4, authority: 4, need: 4, timeline: 4 } },
        status: 'completed',
      },
      clientBrief: {
        facts: { company_name: 'Công ty Seed 915', niche: 'Dịch vụ', need: 'Chăm sóc fanpage' },
      },
      consult: {
        latest_intake_summary: 'Decision: go · BANT: 24/30 · local-seed',
        recommended_actions: 'hẹn gặp',
      },
      presalesNotes: 'local-seed',
      serviceSlug: 'ads',
    });

    expect(view.isLegacy).toBe(true);
    expect(view.company_name).toBe('Công ty Seed 915');
    expect(view.contact_name).toBe('Phạm Hà 920915');
    expect(view.phone).toBe('0900000915');
    expect(view.email).toBe('seed920915@local.test');
    expect(view.industry).toBe('Dịch vụ');
    expect(view.biggest_problem).toBe('Chăm sóc fanpage');
    expect(view.services).toEqual(['ads']);
    expect(view.temperature).toBe('warm');
    expect(view.channels_text).toBe('TikTok');
    expect(view.region).toBe('');
    expect(view.fanpage).toBe('');
    expect(view.tiktok).toBe('');
    expect(view.call_notes).toMatch(/BANT|local-seed|hẹn gặp|Decision/i);
    expect(view.scale).toBe('');
    expect(view.model).toBe('');

    const src = checklistSourceFromMerged(view);
    expect(src.company_name).toBe('Công ty Seed 915');
    expect(src.industry).toBe('Dịch vụ');
    expect(src.biggest_problem).toBe('Chăm sóc fanpage');
    expect(src.services).toEqual(['ads']);
    expect(src.contact_name).toBe('Phạm Hà 920915');
    expect(src.phone).toBe('0900000915');
  });

  it('prefers Discovery brief fields over legacy fallbacks', () => {
    const view = buildAmDeskBrief({
      discovery: {
        company_name: 'QA Panda Tea',
        industry: 'fnb',
        region: 'Q.1, TP.HCM',
        websites: 'https://pandatea.vn facebook.com/pandatea tiktok.com/@pandatea',
        contact_name: 'Thảo',
        phone: '0909111222',
        email: 'thao@panda.test',
        job_title: 'owner',
        biggest_problem: 'CPA cao',
        services: ['he-thong-nhan-dien'],
        marketing_goal: '30 lead/tháng',
        target_customers: 'Văn phòng',
        budget_band: '10_30',
        timeline_band: 'this_month',
        flagship_product: 'Trà sữa',
        call_notes: 'Gọi 15 phút',
        temperature: 'hot',
      },
      lead: { company_name: 'Ignored Co', full_name: 'Ignored', source: 'google' },
      clientBrief: { facts: { company_name: 'Ignored', niche: 'Dịch vụ', need: 'Cũ' } },
    });
    expect(view.isLegacy).toBe(false);
    expect(view.company_name).toBe('QA Panda Tea');
    expect(view.industry).toBe('fnb');
    expect(view.biggest_problem).toBe('CPA cao');
    expect(view.fanpage).toContain('facebook.com');
    expect(view.tiktok).toContain('tiktok.com');
    expect(view.website).toContain('pandatea.vn');
    expect(view.marketing_goal).toBe('30 lead/tháng');
    expect(hrefForUrl(view.fanpage)).toMatch(/^https?:\/\//);
  });

  it('humanizes known lead sources', () => {
    expect(humanizeSource('tiktok')).toBe('TikTok');
    expect(humanizeSource('manual')).toBe('Nhập tay');
  });
});
