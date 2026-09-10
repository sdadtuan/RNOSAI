import { describe, expect, it } from 'vitest';
import type { ServiceLifecycleRow } from '@/lib/api';
import {
  CONTENT_OS_HUB,
  contentOsBoardHref,
  filterContentOsLifecycles,
} from '@/lib/crm/content-os-hub.util';

function row(partial: Partial<ServiceLifecycleRow> & Pick<ServiceLifecycleRow, 'id' | 'service_slug'>): ServiceLifecycleRow {
  return {
    lead_id: null,
    customer_id: null,
    stage: 'deliver',
    status: 'active',
    assigned_am: null,
    notes: '',
    updated_at: '2026-09-10T00:00:00.000Z',
    ...partial,
  };
}

describe('content-os-hub.util', () => {
  it('builds Content Board href', () => {
    expect(CONTENT_OS_HUB).toBe('/crm/content-os');
    expect(contentOsBoardHref(3)).toBe('/crm/service-delivery/3?tab=content-os');
  });

  it('keeps all rows when allowlist empty', () => {
    const rows = [row({ id: 1, service_slug: 'ads-retainer' }), row({ id: 2, service_slug: 'tiep-thi-noi-dung' })];
    expect(filterContentOsLifecycles(rows, []).map((r) => r.id)).toEqual([1, 2]);
  });

  it('filters by pilot slug when allowlist set', () => {
    const rows = [row({ id: 1, service_slug: 'ads-retainer' }), row({ id: 2, service_slug: 'tiep-thi-noi-dung' })];
    expect(filterContentOsLifecycles(rows, ['tiep-thi-noi-dung']).map((r) => r.id)).toEqual([2]);
  });
});
