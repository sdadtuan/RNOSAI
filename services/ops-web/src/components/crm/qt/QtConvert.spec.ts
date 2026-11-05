import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertQtVersion, type QtConvertResult } from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import {
  QtConvertPanel,
  isQtConvertible,
  plannedLifecyclesFrom,
} from './QtConvert';

const FORBIDDEN = ['sẽ có ở W2', 'mở ở Wave', 'NOVA', 'Nhảy màn', '265.647.600'];

const SAMPLE_RESULT = {
  conversion_id: 'cvt-88',
  lifecycles: [
    { line_id: 11, lifecycle_id: 701, dv_code: 'DV08' },
    { line_id: 12, lifecycle_id: 702, dv_code: 'DV05' },
  ],
  invoice_draft_ids: [501],
  optional_handoff: [] as QtConvertResult['optional_handoff'],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QtConvertPanel', () => {
  it('disables convert when status is not accepted', () => {
    expect(isQtConvertible('draft')).toBe(false);
    expect(isQtConvertible('sent')).toBe(false);
    expect(isQtConvertible('accepted')).toBe(true);

    const html = renderToStaticMarkup(
      createElement(QtConvertPanel, {
        quoteCode: 'QT-PTT-2026-000089',
        versionId: 'vid-accepted',
        status: 'draft',
        planned: [{ line_id: 11, lifecycle_id: null, dv_code: 'DV08' }],
      }),
    );

    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Chạy convert/);
    expect(html).not.toContain('NOVA');
    expect(html).not.toContain('<main');
  });

  it('shows accepted version, planned lifecycles, and AC-08 idempotent note', () => {
    const html = renderToStaticMarkup(
      createElement(QtConvertPanel, {
        quoteCode: 'QT-PTT-2026-000089',
        versionId: 'vid-accepted',
        status: 'accepted',
        planned: plannedLifecyclesFrom(
          [
            { id: 11, dv_code: 'DV08' },
            { id: 12, dv_code: 'DV05' },
          ],
          null,
        ),
        result: SAMPLE_RESULT,
      }),
    );

    expect(html).toContain('QT-PTT-2026-000089');
    expect(html).toContain('vid-accepted');
    expect(html).toContain('Đã xác nhận');
    expect(html).toContain('DV08');
    expect(html).toContain('DV05');
    expect(html).toContain('AC-08');
    expect(html).toContain('không nhân bản');
    expect(html).toContain('optional_handoff');
    expect(html).toContain(dash(null));
    expect(html).not.toContain('Content OS');
    expect(html).not.toContain('CSD ticket');
    expect(html).not.toContain('đã tạo CP');
    expect(html).not.toContain('đã tạo CSD');
    expect(html).not.toContain('/crm/video/');
    expect(html).not.toContain('<main');
    for (const banned of FORBIDDEN) {
      expect(html).not.toContain(banned);
    }
  });

  it('AC-10 Brand Film handoff deep-links Video SOP + VID-TPL-01 without an editor', () => {
    const html = renderToStaticMarkup(
      createElement(QtConvertPanel, {
        quoteCode: 'QT-PTT-2026-000089',
        versionId: 'vid-accepted',
        status: 'accepted',
        result: {
          ...SAMPLE_RESULT,
          optional_handoff: [{ vd_project_id: 88, template_key: 'VID-TPL-01' }],
        },
      }),
    );

    expect(html).toContain('/crm/video/88');
    expect(html).toContain('VID-TPL-01');
    expect(html).not.toContain('timeline');
    expect(html).not.toContain('6 scene');
    expect(html).not.toContain('optional_handoff trống');
    expect(html).not.toContain('<main');
  });

  it('shows quote_not_accepted from the API', () => {
    const html = renderToStaticMarkup(
      createElement(QtConvertPanel, {
        quoteCode: 'QT-PTT-2026-000001',
        versionId: 'vid-1',
        status: 'sent',
        planned: [],
        error: 'quote_not_accepted',
      }),
    );
    expect(html).toContain('quote_not_accepted');
  });
});

describe('plannedLifecyclesFrom', () => {
  it('prefers last convert payload over inventing a second set', () => {
    const fromLines = plannedLifecyclesFrom([{ id: 99, dv_code: 'DV99' }], SAMPLE_RESULT);
    expect(fromLines).toEqual([
      { line_id: 11, lifecycle_id: 701, dv_code: 'DV08' },
      { line_id: 12, lifecycle_id: 702, dv_code: 'DV05' },
    ]);
  });
});

describe('convertQtVersion', () => {
  it('second convert returns the same ids (mock fetch)', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(SAMPLE_RESULT), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await convertQtVersion('tok', 9, 'vid-1', 'cvt-idem-1');
    const second = await convertQtVersion('tok', 9, 'vid-1', 'cvt-idem-1');

    expect(second).toEqual(first);
    expect(second.conversion_id).toBe('cvt-88');
    expect(second.lifecycles).toEqual(SAMPLE_RESULT.lifecycles);
    expect(second.invoice_draft_ids).toEqual([501]);
    expect(second.optional_handoff).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/proposals/9/versions/vid-1/convert'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': 'cvt-idem-1' }),
      }),
    );
  });
});
