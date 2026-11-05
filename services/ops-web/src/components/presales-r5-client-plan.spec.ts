import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresalesClientBriefCard } from '@/components/PresalesClientBriefCard';
import { PresalesR5PlanForm } from '@/components/PresalesR5PlanForm';
import { PresalesR5PreviewPanel } from '@/components/PresalesR5PreviewPanel';

const strategy = {
  target_market: '',
  market_message: '',
  media_reach: '',
  conversion_strategy: '',
  retention_system: '',
  nurture_system: '',
  world_class_experience: '',
  lifecycle_extension: '',
  referral_engine: '',
};

describe('PresalesClientBriefCard', () => {
  it('marks usp, goal, and channels as required and names both model paths', () => {
    const html = renderToStaticMarkup(
      createElement(PresalesClientBriefCard, {
        token: 'token',
        leadId: 7,
        canEdit: true,
        canAiDraft: true,
        onAiDraft: async () => undefined,
      }),
    );
    expect(html).toContain('Điểm khác biệt');
    expect(html).toContain('Mục tiêu đo được');
    expect(html).toContain('Kênh muốn chạy và cách chốt đơn');
    expect(html).toContain('Khách của họ là ai');
    expect(html).toContain('PTT_MKT_AI_MODEL');
    expect(html).toContain('gpt-4o-mini');
    expect(html).toContain('AI điền R5');
    expect(html.match(/client-plan-brief__star/g)).toHaveLength(3);
    expect(html).not.toContain('Gửi email');
  });
});

describe('PresalesR5PreviewPanel export', () => {
  it('hides Tạo file gửi khách when G4 is red and keeps the overview link', () => {
    const html = renderToStaticMarkup(
      createElement(PresalesR5PreviewPanel, {
        planName: '',
        planNorthStar: '',
        planObjectives: '',
        planStrategy: strategy,
        planValidation: ['Nhập tên kế hoạch MKT sơ bộ.'],
        stage: 'consult',
        onEditR5: () => undefined,
        token: 'token',
        leadId: 7,
      }),
    );
    expect(html).not.toContain('Tạo file gửi khách');
    expect(html).toContain('Đủ gate G4 rồi mới xuất file gửi khách.');
    expect(html).toContain('Chỉnh sửa trên Tổng quan →');
    expect(html).not.toContain('Gửi email');
  });

  it('shows Tạo file gửi khách when the G4 checklist is empty', () => {
    const html = renderToStaticMarkup(
      createElement(PresalesR5PreviewPanel, {
        planName: 'Kế hoạch',
        planNorthStar: 'Tăng lịch',
        planObjectives: '',
        planStrategy: {
          ...strategy,
          market_message: 'Concept',
          media_reach: 'Facebook',
          conversion_strategy: 'Inbox',
        },
        planValidation: [],
        stage: 'consult',
        onEditR5: () => undefined,
        token: 'token',
        leadId: 7,
      }),
    );
    expect(html).toContain('Tạo file gửi khách');
    expect(html).not.toContain('Đủ gate G4 rồi mới xuất file gửi khách.');
    expect(html).not.toContain('Gửi email');
  });
});

describe('PresalesR5PlanForm banner', () => {
  it('shows the draft banner with the model line and keeps Save', () => {
    const html = renderToStaticMarkup(
      createElement(PresalesR5PlanForm, {
        planName: '',
        planNorthStar: '',
        planObjectives: '',
        planStrategy: strategy,
        planValidation: [],
        disabled: false,
        canEdit: true,
        showAiDraftBadge: true,
        aiModel: 'gpt-4o-mini',
        onPlanNameChange: () => undefined,
        onNorthStarChange: () => undefined,
        onObjectivesChange: () => undefined,
        onStrategyChange: () => undefined,
        onSave: () => undefined,
      }),
    );
    expect(html).toContain('Bản nháp — SP duyệt.');
    expect(html).toContain('Không có website/fanpage. Một lần gọi gpt-4o-mini.');
    expect(html).toContain('Lưu KH MKT sơ bộ');
    expect(html).not.toContain('AI draft');
  });
});
