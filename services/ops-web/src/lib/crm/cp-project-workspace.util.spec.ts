import { describe, expect, it } from 'vitest';
import {
  approvalSteps,
  briefSections,
  budgetBanner,
  budgetLines,
  daysRemaining,
  deliverableCta,
  formatAiOpsChipLabel,
  formatAiOpsCount,
  formatCreditLine,
  formatMemberLine,
  overviewAlert,
  projectAssets,
  rightsBadge,
  taskSource,
  videoFinalCount,
} from './cp-project-workspace.util';

describe('PRJ-03 workspace helpers', () => {
  it('counts calendar days left and returns null without a due date', () => {
    expect(daysRemaining('2026-09-10', new Date('2026-09-08T00:00:00+07:00'))).toBe(2);
    expect(daysRemaining(null, new Date('2026-09-08'))).toBeNull();
  });

  it('renders AI Ops chip counts as an em dash when there are 0 rows', () => {
    expect(formatAiOpsCount(null)).toBe('—');
    expect(formatAiOpsCount(0)).toBe('—');
    expect(formatAiOpsCount(3)).toBe('3');
  });

  it('labels Weave as open WO and Magnific/Comfy as job counts', () => {
    expect(formatAiOpsChipLabel(3, 'weave')).toBe('3 WO mở');
    expect(formatAiOpsChipLabel(2, 'magnific')).toBe('2 job Magnific');
    expect(formatAiOpsChipLabel(1, 'comfy')).toBe('1 job Comfy');
    expect(formatAiOpsChipLabel(null, 'weave')).toBe('—');
    expect(formatAiOpsChipLabel(0, 'magnific')).toBe('—');
    expect(formatAiOpsChipLabel(0, 'comfy')).toBe('—');
  });

  it('formats credit used / budget and never invents a ratio', () => {
    expect(formatCreditLine(1280, 1600)).toBe('1.280 / 1.600');
    expect(formatCreditLine(0, null)).toBe('—');
    expect(formatCreditLine(null, 1600)).toBe('0 / 1.600');
  });

  it('reads brief sections from structured JSON or a legacy content blob', () => {
    expect(
      briefSections({
        context: 'Tháp B',
        objective: '12 video',
        message_cta: 'Đăng ký tour',
        constraints: 'Không claim ROI',
      }),
    ).toEqual({
      context: 'Tháp B',
      objective: '12 video',
      message_cta: 'Đăng ký tour',
      constraints: 'Không claim ROI',
    });
    expect(briefSections({ content: 'Ghi chú cũ' })).toEqual({
      context: 'Ghi chú cũ',
      objective: '',
      message_cta: '',
      constraints: '',
    });
    expect(briefSections(null)).toEqual({
      context: '',
      objective: '',
      message_cta: '',
      constraints: '',
    });
  });

  it('builds an overview alert only from real risk signals', () => {
    expect(
      overviewAlert({ creditPct: 80, overdueDeliverables: 2, clientReviewOverSla: true }),
    ).toBe('Credit 80% · Client review quá SLA · 2 deliverable quá hạn');
    expect(overviewAlert({ creditPct: null, overdueDeliverables: 0, clientReviewOverSla: false })).toBeNull();
  });

  it('labels task source without cloning CSD tickets', () => {
    expect(taskSource({ am_task_id: null, csd_ticket_id: null, video_version_id: null })).toEqual({
      label: 'crm_cp_tasks',
      href: null,
    });
    expect(taskSource({ am_task_id: 'am-1', csd_ticket_id: null, video_version_id: null })).toEqual({
      label: 'link AM task',
      href: '/crm/account-management?task=am-1',
    });
    expect(taskSource({ am_task_id: null, csd_ticket_id: 't-9', video_version_id: null })).toEqual({
      label: 'link CSD',
      href: '/crm/csd/tickets/t-9',
    });
    expect(taskSource({ am_task_id: null, csd_ticket_id: null, video_version_id: 'ver-1' })).toEqual({
      label: 'link Hub',
      href: '/crm/creative-os/video/versions/ver-1',
    });
  });

  it('routes deliverable CTAs to Studio, Review, or Video SOP', () => {
    expect(
      deliverableCta({
        type: 'human_video',
        vd_project_id: 'vd-1',
        video_version_id: null,
        video_draft_id: null,
        project_id: 'p1',
      }),
    ).toEqual({ label: 'Mở Video SOP', href: '/crm/video/vd-1' });
    expect(
      deliverableCta({
        type: 'ai_video',
        vd_project_id: null,
        video_version_id: 'ver-2',
        video_draft_id: 'd-2',
        project_id: 'p1',
      }),
    ).toEqual({ label: 'Mở review', href: '/crm/creative-os/video/versions/ver-2' });
    expect(
      deliverableCta({
        type: 'ai_video',
        vd_project_id: null,
        video_version_id: null,
        video_draft_id: 'd-3',
        project_id: 'p1',
      }),
    ).toEqual({ label: 'Studio', href: '/crm/creative-os/video/d-3' });
  });

  it('shows the 50/80/100 budget banner only when a real percent exists', () => {
    expect(budgetBanner(null)).toBeNull();
    expect(budgetBanner(50)?.text).toContain('50%');
    expect(budgetBanner(80)?.text).toContain('80%');
    expect(budgetBanner(100)?.text).toContain('100%');
  });

  it('keeps Brand / Client / Legal rows with live status or —', () => {
    const rows = approvalSteps({
      briefStatus: 'brand_approved',
      clientStatus: 'client_review',
      legalStatus: null,
      qcStatus: 'blocked',
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ step: 'Brand', status: 'brand_approved', sla: '—' });
    expect(rows[1]).toMatchObject({ step: 'Client', status: 'client_review', sla: '—' });
    expect(rows[2]).toMatchObject({ step: 'Legal', status: 'Chờ QC', sla: '—' });
  });

  it('joins member names with roles and counts final videos from real rows', () => {
    expect(
      formatMemberLine([
        { name: 'Lan', role: 'producer' },
        { name: 'Minh', role: 'am' },
      ]),
    ).toBe('Lan (producer) · Minh (am)');
    expect(formatMemberLine([])).toBe('—');
    expect(
      videoFinalCount([
        { type: 'ai_video', status: 'final' },
        { type: 'motion', status: 'final' },
        { type: 'human_video', status: 'draft' },
      ]),
    ).toBe(1);
  });

  it('keeps budget lines empty unless a cost center actually charged', () => {
    expect(budgetLines({ budget: 1600, charged: 200, reserved: 40, byCostCenter: {} })).toEqual([
      { label: 'Video production', budget: '—', charged: '—', reserved: '—', remaining: '—' },
      { label: 'Batch factory', budget: '—', charged: '—', reserved: '—', remaining: '—' },
      { label: 'TTS / voice', budget: '—', charged: '—', reserved: '—', remaining: '—' },
    ]);
    expect(
      budgetLines({
        budget: 1600,
        charged: 720,
        reserved: 80,
        byCostCenter: { video: { charged: 720, reserved: 80 } },
      })[0],
    ).toEqual({
      label: 'Video production',
      budget: '—',
      charged: '720',
      reserved: '80',
      remaining: '—',
    });
  });

  it('filters DAM assets to this project and badges rights warnings', () => {
    expect(
      projectAssets(
        [
          { id: 'a', project_id: 'p1', filename: 'logo.svg' },
          { id: 'b', project_id: 'p2', filename: 'other.svg' },
        ],
        'p1',
      ),
    ).toEqual([{ id: 'a', project_id: 'p1', filename: 'logo.svg' }]);
    expect(rightsBadge({ rights_status: 'warn', expiry_on: '2026-09-13' })).toBe('⚠ sắp hết quyền');
    expect(rightsBadge({ rights_status: 'ok', expiry_on: '2027-01-01' })).toBeNull();
  });
});
