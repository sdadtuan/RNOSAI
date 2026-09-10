import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '@/lib/api';
import { submitRequestForm, validateRequestForm } from './cmkte-request-form';

afterEach(() => {
  vi.unstubAllGlobals();
});

const valid = {
  client: 'Client A · Brand A',
  source: 'account',
  deliverable: '12 social posts',
  objective: 'Awareness',
  due: '2026-09-20',
};

describe('validateRequestForm', () => {
  it('returns required-field message when deliverable is missing', () => {
    expect(validateRequestForm({ ...valid, deliverable: '' })).toBe(
      'Thiếu trường bắt buộc — không tạo request.',
    );
    expect(validateRequestForm({ ...valid, deliverable: '   ' })).toBe(
      'Thiếu trường bắt buộc — không tạo request.',
    );
  });

  it('returns null when required fields are present', () => {
    expect(validateRequestForm(valid)).toBeNull();
  });
});

describe('submitRequestForm', () => {
  it('does not POST when deliverable is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const out = await submitRequestForm({
      ...valid,
      deliverable: '',
      priority: 'High',
      lifecycle_id: 4,
      token: 'tok-9',
    });

    expect(out).toEqual({ error: 'Thiếu trường bắt buộc — không tạo request.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs portfolio request when form is valid', async () => {
    const created = { id: 3, display_code: 'CR-20260910-001', triage_status: 'Submitted' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => created,
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await submitRequestForm({
      ...valid,
      priority: 'High',
      lifecycle_id: 4,
      token: 'tok-9',
    });

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/requests`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok-9',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lifecycle_id: 4,
        source: 'account',
        client_label: 'Client A',
        brand_label: 'Brand A',
        deliverable_ask: '12 social posts',
        objective: 'Awareness',
        due_at: '2026-09-20',
        priority: 'High',
      }),
    });
    expect(out).toEqual({ request: created });
  });
});
