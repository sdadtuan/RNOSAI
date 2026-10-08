import { describe, expect, it } from 'vitest';
import {
  clientBriefUiMissing,
  clientPlanDraftModelLine,
  decodeBase64Bytes,
  showClientPlanExportButton,
} from './client-plan-brief.ui';

describe('clientBriefUiMissing', () => {
  it('lists the required brief labels and ignores audience and competitors', () => {
    expect(
      clientBriefUiMissing({
        company_name: 'Quý Nguyễn Studio',
        niche: 'Ảnh cưới',
        need: 'Lịch chụp giảm',
        usp: '',
        goal: 'Tăng lịch chụp',
        channels: 'Facebook inbox',
      }),
    ).toEqual(['Điểm khác biệt']);
  });

  it('treats placeholder tokens as empty', () => {
    expect(
      clientBriefUiMissing({
        company_name: 'A',
        niche: 'B',
        need: 'C',
        usp: '[cần chốt]',
        goal: '[cần xác nhận]',
        channels: 'Kênh',
      }),
    ).toEqual(['Điểm khác biệt', 'Mục tiêu đo được']);
  });

  it('is empty when the six required facts are filled', () => {
    expect(
      clientBriefUiMissing({
        company_name: 'A',
        niche: 'B',
        need: 'C',
        usp: 'Concept riêng',
        goal: 'Tăng lịch',
        channels: 'Facebook',
      }),
    ).toEqual([]);
  });
});

describe('showClientPlanExportButton', () => {
  it('hides the export button when G4 is red', () => {
    expect(showClientPlanExportButton(['Nhập tên kế hoạch MKT sơ bộ.'])).toBe(false);
  });

  it('shows the export button when the G4 checklist is empty', () => {
    expect(showClientPlanExportButton([])).toBe(true);
  });
});

describe('clientPlanDraftModelLine', () => {
  it('names gpt-4o-mini when there is no public page', () => {
    expect(clientPlanDraftModelLine('gpt-4o-mini')).toBe(
      'Không có website/fanpage. Một lần gọi gpt-4o-mini.',
    );
  });

  it('names the configured model when a page was used', () => {
    expect(clientPlanDraftModelLine('PTT_MKT_AI_MODEL')).toBe('Một lần gọi PTT_MKT_AI_MODEL.');
  });
});

describe('decodeBase64Bytes', () => {
  it('decodes a PPTX payload that starts with PK', () => {
    const bytes = decodeBase64Bytes(Buffer.from('PK').toString('base64'));
    expect(Array.from(bytes)).toEqual([0x50, 0x4b]);
  });
});
