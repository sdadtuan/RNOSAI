import { ContentBrandContextService } from './content-brand-context.service';

describe('ContentBrandContextService glossary copilot whitelist', () => {
  it('puts only Approved unexpired glossary into copilotGlossary', async () => {
    const repo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue({
        sealed: false,
        brand_context_json: { brand_name: 'Thương hiệu', brand_id: 'brand-4', locale: 'vi' },
      }),
      loadPlannerSource: jest.fn(),
      listInsightsForLifecycle: jest.fn().mockResolvedValue([]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        {
          id: 1,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'draft-secret',
          locale: 'vi',
          preferred: '',
          status: 'Draft',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 2,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'đăng ký nhận tư vấn',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 3,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'expired-term',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: '2020-01-01T00:00:00.000Z',
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentBrandContextService(
      { contentMarketingPiiConsentDefault: false } as never,
      repo as never,
      { context: jest.fn().mockResolvedValue(null) } as never,
    );
    const out = await svc.resolveForLifecycle(4);
    expect(out.copilotGlossary).toEqual([
      expect.objectContaining({ id: 2, term: 'đăng ký nhận tư vấn', brand_id: 'brand-4' }),
    ]);
    expect((out.copilotGlossary as Array<{ term: string }>).map((row) => row.term)).not.toContain(
      'draft-secret',
    );
    expect((out.copilotGlossary as Array<{ term: string }>).map((row) => row.term)).not.toContain(
      'expired-term',
    );
  });

  it('does not mix another brand or locale when the lifecycle has both', async () => {
    const repo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue({
        sealed: true,
        brand_context_json: { brand_name: 'Acme', brand_id: 'brand-4', locale: 'vi' },
      }),
      loadPlannerSource: jest.fn(),
      listInsightsForLifecycle: jest.fn().mockResolvedValue([]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        {
          id: 2,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'đăng ký nhận tư vấn',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 8,
          lifecycle_id: 4,
          brand_id: 'brand-9',
          term: 'other-brand',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 9,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'other-locale',
          locale: 'en',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentBrandContextService(
      { contentMarketingPiiConsentDefault: false } as never,
      repo as never,
      { context: jest.fn().mockResolvedValue(null) } as never,
    );
    const out = await svc.resolveForLifecycle(4);
    expect((out.copilotGlossary as Array<{ term: string }>).map((row) => row.term)).toEqual([
      'đăng ký nhận tư vấn',
    ]);
  });

  it('returns no copilotGlossary when lifecycle brand_id or locale is missing', async () => {
    const repo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue(null),
      loadPlannerSource: jest.fn().mockResolvedValue(null),
      listInsightsForLifecycle: jest.fn().mockResolvedValue([]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        {
          id: 2,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'đăng ký nhận tư vấn',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentBrandContextService(
      { contentMarketingPiiConsentDefault: false } as never,
      repo as never,
      { context: jest.fn().mockResolvedValue(null) } as never,
    );
    const out = await svc.resolveForLifecycle(4);
    expect(out.copilotGlossary).toEqual([]);
  });

  it('passes through planner brief brand_id and locale so glossary is not empty', async () => {
    const repo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue(null),
      loadPlannerSource: jest.fn().mockResolvedValue({
        brief_json: { brand_name: 'Acme', brand_id: 'brand-4', locale: 'vi' },
      }),
      listInsightsForLifecycle: jest.fn().mockResolvedValue([]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        {
          id: 2,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'đăng ký nhận tư vấn',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentBrandContextService(
      { contentMarketingPiiConsentDefault: false } as never,
      repo as never,
      { context: jest.fn().mockResolvedValue(null) } as never,
    );
    const out = await svc.resolveForLifecycle(4);
    expect(out.brand_id).toBe('brand-4');
    expect(out.locale).toBe('vi');
    expect(out.copilotGlossary).toEqual([
      expect.objectContaining({ id: 2, term: 'đăng ký nhận tư vấn', brand_id: 'brand-4' }),
    ]);
  });

  it('merges item brief brand_id/locale over snapshot so item jobs can populate scope', async () => {
    const repo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue({
        sealed: false,
        brand_context_json: { brand_name: 'Acme' },
      }),
      loadPlannerSource: jest.fn(),
      listInsightsForLifecycle: jest.fn().mockResolvedValue([]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        {
          id: 2,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'đăng ký nhận tư vấn',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentBrandContextService(
      { contentMarketingPiiConsentDefault: false } as never,
      repo as never,
      { context: jest.fn().mockResolvedValue(null) } as never,
    );
    const out = await svc.resolveForLifecycle(4, {
      brief_json: { brand_id: 'brand-4', locale: 'vi' },
    });
    expect(out.brand_id).toBe('brand-4');
    expect(out.locale).toBe('vi');
    expect(out.copilotGlossary).toEqual([
      expect.objectContaining({ id: 2, term: 'đăng ký nhận tư vấn' }),
    ]);
  });

  it('lets item brief brand_id and locale win over snapshot scope', async () => {
    const repo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue({
        sealed: true,
        brand_context_json: { brand_name: 'Acme', brand_id: 'brand-9', locale: 'en' },
      }),
      loadPlannerSource: jest.fn(),
      listInsightsForLifecycle: jest.fn().mockResolvedValue([]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        {
          id: 2,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'item-wins',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 8,
          lifecycle_id: 4,
          brand_id: 'brand-9',
          term: 'snapshot-term',
          locale: 'en',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentBrandContextService(
      { contentMarketingPiiConsentDefault: false } as never,
      repo as never,
      { context: jest.fn().mockResolvedValue(null) } as never,
    );
    const out = await svc.resolveForLifecycle(4, {
      brief_json: { brand_id: 'brand-4', locale: 'vi' },
    });
    expect((out.copilotGlossary as Array<{ term: string }>).map((row) => row.term)).toEqual([
      'item-wins',
    ]);
  });

  it('keeps glossary empty when item merge still lacks brand_id or locale', async () => {
    const repo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue({
        sealed: false,
        brand_context_json: { brand_name: 'Acme', brand_id: 'brand-4' },
      }),
      loadPlannerSource: jest.fn(),
      listInsightsForLifecycle: jest.fn().mockResolvedValue([]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        {
          id: 2,
          lifecycle_id: 4,
          brand_id: 'brand-4',
          term: 'đăng ký nhận tư vấn',
          locale: 'vi',
          preferred: '',
          status: 'Approved',
          expires_at: null,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]),
    };
    const svc = new ContentBrandContextService(
      { contentMarketingPiiConsentDefault: false } as never,
      repo as never,
      { context: jest.fn().mockResolvedValue(null) } as never,
    );
    const out = await svc.resolveForLifecycle(4, { brief_json: { brand_id: 'brand-4' } });
    expect(out.copilotGlossary).toEqual([]);
  });
});
