import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QT_NAV } from '@/lib/crm/qt-nav.util';
import { getQtApprovals, postQtApprovalAction } from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import {
  QT_APPROVAL_CHIPS,
  QtApprovalDetail,
  QtApprovalsInbox,
  actionNeedsComment,
  canSubmitStepAction,
  type QtApprovalInboxItem,
} from './QtApprovals';

const FORBIDDEN = ['sẽ có ở W2', 'mở ở Wave', 'NOVA', 'Nhảy màn', '265.647.600', '265647600', '22,4'];

const SAMPLE_ITEM: QtApprovalInboxItem = {
  step_id: 'step-1',
  approval_id: 'apr-1',
  version_id: 'vid-1',
  proposal_id: 9,
  quote_code: 'QT-PTT-2026-000089',
  version_n: 2,
  client_name: 'An Phát',
  trigger: 'MARGIN_FLOOR',
  step: 'Finance',
  sla: '+6h',
  sla_breached: true,
  owner: { staff_id: 7, name: 'Lan' },
  state: 'waiting',
  assignee_staff_id: 7,
  acted_at: null,
  comment: null,
  delegate_from: 3,
  until: '2026-09-15',
  policy_badges: [
    { code: 'MARGIN_FLOOR', tone: 'warn' },
    { code: 'COST_MISSING', tone: 'warn' },
    { code: 'PAYMENT_OK', tone: 'ok' },
    { code: 'VALUE_OK', tone: 'ok' },
  ],
  snapshot: {
    nsr_vnd: 95_000_000,
    direct_cost_vnd: 70_000_000,
    gp_vnd: 25_000_000,
    gm_bps: 2800,
  },
  steps: [
    { id: 'step-0', approval_id: 'apr-1', seq: 1, section: 'Sales Manager', state: 'done' },
    { id: 'step-1', approval_id: 'apr-1', seq: 2, section: 'Finance', state: 'waiting' },
    { id: 'step-2', approval_id: 'apr-1', seq: 3, section: 'GDKD', state: 'locked' },
    { id: 'step-3', approval_id: 'apr-1', seq: 4, section: 'Legal', state: 'skipped' },
  ],
};

function assertClean(html: string) {
  expect(html).not.toContain('<main');
  for (const banned of FORBIDDEN) {
    expect(html).not.toContain(banned);
  }
}

describe('QtApprovalsInbox', () => {
  it('renders APR-01 chips and an empty table of dashes', () => {
    expect(QT_APPROVAL_CHIPS.map((chip) => chip.label)).toEqual([
      'Chờ tôi',
      'Đã xử lý',
      'SLA vỡ',
    ]);
    expect(QT_NAV).toHaveLength(7);

    const html = renderToStaticMarkup(createElement(QtApprovalsInbox, { items: [] }));

    expect(html).toContain('Hộp thư phê duyệt');
    expect(html).toContain('Quote');
    expect(html).toContain('Trigger');
    expect(html).toContain('Bước');
    expect(html).toContain('SLA');
    expect(html).toContain('Owner');
    expect(html).toContain(dash(null));
    expect(html).toContain('qt-table');
    assertClean(html);
  });

  it('renders inbox rows and keeps Mở enabled', () => {
    const html = renderToStaticMarkup(
      createElement(QtApprovalsInbox, { items: [SAMPLE_ITEM], chip: 'mine' }),
    );

    expect(html).toContain('QT-PTT-2026-000089');
    expect(html).toContain('MARGIN_FLOOR');
    expect(html).toContain('Finance');
    expect(html).toContain('+6h');
    expect(html).toContain('Lan');
    expect(html).toMatch(/<button[^>]*>[\s\S]*Mở/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Mở/);
    assertClean(html);
  });
});

describe('QtApprovalDetail', () => {
  it('renders APR-02 timeline, policy badges, and SET-05 delegate', () => {
    const html = renderToStaticMarkup(
      createElement(QtApprovalDetail, {
        item: SAMPLE_ITEM,
        hasFinance: true,
        canApprove: true,
        comment: 'ok',
      }),
    );

    expect(html).toContain('Sales Manager');
    expect(html).toContain('Finance');
    expect(html).toContain('GDKD');
    expect(html).toContain('Legal');
    expect(html).toContain('xong');
    expect(html).toContain('chờ');
    expect(html).toContain('khóa');
    expect(html).toContain('bỏ qua');
    expect(html).toContain('qt-apr-item');
    expect(html).toContain('MARGIN_FLOOR');
    expect(html).toContain('COST_MISSING');
    expect(html).toContain('PAYMENT_OK');
    expect(html).toContain('VALUE_OK');
    expect(html).toContain('NSR');
    expect(html).toContain('95.000.000');
    expect(html).toContain('28%');
    expect(html).toContain('Ủy quyền');
    expect(html).toContain('SET-05');
    expect(html).toContain('/crm/proposals/settings?tab=set-05');
    assertClean(html);
  });

  it('shows NSR / cost / GM as dashes without finance and never mounts those numbers', () => {
    const html = renderToStaticMarkup(
      createElement(QtApprovalDetail, {
        item: SAMPLE_ITEM,
        hasFinance: false,
        canApprove: true,
        comment: '',
      }),
    );

    expect(html).toContain('NSR');
    expect(html).toContain('Direct cost');
    expect(html).toContain('GP');
    expect(html).toContain('GM');
    expect(html).toContain(dash(null));
    expect(html).not.toContain('95.000.000');
    expect(html).not.toContain('70.000.000');
    expect(html).not.toContain('25.000.000');
    expect(html).not.toContain('28%');
    assertClean(html);
  });

  it('requires comment for return/reject and disables actions without approve execute', () => {
    expect(actionNeedsComment('return')).toBe(true);
    expect(actionNeedsComment('reject')).toBe(true);
    expect(actionNeedsComment('approve')).toBe(false);
    expect(canSubmitStepAction({ action: 'return', comment: '', canApprove: true, stepState: 'waiting' })).toBe(
      false,
    );
    expect(
      canSubmitStepAction({ action: 'approve', comment: '', canApprove: true, stepState: 'waiting' }),
    ).toBe(true);
    expect(
      canSubmitStepAction({ action: 'approve', comment: '', canApprove: false, stepState: 'waiting' }),
    ).toBe(false);

    const noComment = renderToStaticMarkup(
      createElement(QtApprovalDetail, {
        item: SAMPLE_ITEM,
        hasFinance: true,
        canApprove: true,
        comment: '',
      }),
    );
    expect(noComment).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Trả lại/);
    expect(noComment).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Từ chối/);
    expect(noComment).toMatch(/<button[^>]*>[\s\S]*Phê duyệt/);

    const locked = renderToStaticMarkup(
      createElement(QtApprovalDetail, {
        item: { ...SAMPLE_ITEM, state: 'locked' },
        hasFinance: true,
        canApprove: false,
        comment: 'need a reason',
      }),
    );
    expect(locked).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Phê duyệt/);
    expect(locked).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Trả lại/);
    assertClean(noComment);
  });
});

describe('qt-api approval clients', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads inbox from /api/crm/proposals/approvals and posts step actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], has_finance: false, can_approve: false }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ step: { id: 'step-1' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await getQtApprovals('tok', { scope: 'team', chip: 'sla' });
    await postQtApprovalAction('tok', 'step-1', { action: 'return', comment: 'need cost' });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/crm/proposals/approvals');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('scope=team');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('chip=sla');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/crm/quote-approval-steps/step-1/actions');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ action: 'return', comment: 'need cost' }),
    });
  });
});
