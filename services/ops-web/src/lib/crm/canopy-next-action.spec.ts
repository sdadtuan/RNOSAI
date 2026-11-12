import { describe, expect, it } from 'vitest';
import { nextActionFor, nextActionForLeadDetail } from './canopy-next-action';

describe('nextActionFor', () => {
  it('guides B2B lead list', () => {
    expect(nextActionFor('/crm/b2b/leads')).toMatch(/lead Nóng/i);
  });

  it('guides intake wizard', () => {
    expect(nextActionFor('/crm/intake?lead_id=1')).toMatch(/BANT/);
  });

  it('skips login', () => {
    expect(nextActionFor('/login')).toBeNull();
  });

  it('hides the Sale prompt above Solution for Marketing Leader', () => {
    expect(nextActionFor('/crm/b2b/leads', { hideSaleEarly: true })).toBeNull();
    expect(nextActionFor('/crm/leads/920003', { hideSaleEarly: true })).toBeNull();
    expect(nextActionFor('/crm/solution/queue', { hideSaleEarly: true })).toMatch(/báo giá/i);
  });

  it('uses the lead stage so the banner is not stuck on BANT at quote', () => {
    const path = '/crm/leads/900000115';
    expect(nextActionFor(path, { leadHint: { quotePhase: 'hop_dong', viewer: 'sales' } })).toMatch(/tải báo giá đã duyệt/);
    expect(nextActionFor(path, { leadHint: { quotePhase: 'ceo_review', viewer: 'sales' } })).toMatch(/chờ CEO duyệt/);
    expect(nextActionFor(path, { leadHint: { quotePhase: 'ceo_review', viewer: 'ceo' } })).toMatch(/duyệt hoặc từ chối/);
    expect(nextActionFor(path, { leadHint: { quotePhase: 'bao_gia', viewer: 'am' } })).toMatch(/gửi CEO duyệt/);
    expect(nextActionFor(path, { leadHint: { quotePhase: 'bao_gia', quoteRejected: true, viewer: 'am' } })).toMatch(/CEO từ chối/);
    expect(nextActionFor(path, { leadHint: { handoffStatus: 'with_solution', viewer: 'sales' } })).toMatch(/chỉ xem/);
    expect(nextActionFor(path, { leadHint: { handoffStatus: 'pending', viewer: 'sales' } })).toMatch(/SUBMIT FOR SOLUTION/);
    expect(nextActionFor(path, { leadHint: { claimed: false, viewer: 'sales' } })).toMatch(/nhận lead trong 15 phút/);
    expect(nextActionForLeadDetail({ b2Complete: true, presalesStage: 'lead', viewer: 'sales' })).toMatch(/khảo sát BANT/);
    expect(nextActionFor(path, { leadHint: { quotePhase: 'hop_dong', viewer: 'sales' } })).not.toMatch(/BANT/);
    expect(nextActionFor(path, { hideSaleEarly: true, leadHint: { quotePhase: 'bao_gia', viewer: 'am' } })).toMatch(/gửi CEO duyệt/);
    expect(
      nextActionFor(path, {
        leadHint: {
          handoffStatus: 'returned',
          revisionNote: 'Thiếu ngân sách và người quyết định',
          viewer: 'sales',
        },
      }),
    ).toMatch(/đã trả lại/);
    expect(
      nextActionFor(path, {
        leadHint: {
          handoffStatus: 'returned',
          revisionNote: 'Thiếu ngân sách và người quyết định',
          viewer: 'sales',
        },
      }),
    ).toMatch(/Thiếu ngân sách và người quyết định/);
    expect(
      nextActionFor(path, {
        leadHint: { handoffStatus: 'returned', revisionNote: 'Thiếu ngân sách', viewer: 'sales' },
      }),
    ).not.toMatch(/đang xử lý/);
    expect(
      nextActionFor(path, {
        leadHint: { handoffStatus: 'with_solution', viewer: 'sales' },
      }),
    ).toMatch(/chỉ xem/);
  });
});
