import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContentOsPortfolioService } from './content-os-portfolio.service';
import type { CmktGlossaryRow } from './copilot-glossary.util';

function makeSvc(repo: object, items: object = {}, marketingRepo: object = {}) {
  return new ContentOsPortfolioService(repo as never, {} as never, marketingRepo as never, items as never);
}

function glossary(
  partial: Partial<CmktGlossaryRow> & Pick<CmktGlossaryRow, 'id' | 'status'>,
): CmktGlossaryRow {
  return {
    lifecycle_id: 4,
    brand_id: 'brand-4',
    term: `term-${partial.id}`,
    locale: 'vi',
    preferred: '',
    expires_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

describe('ContentOsPortfolioService.listGlossary', () => {
  it('lists Draft and Approved glossary in staff portfolio scope', async () => {
    const draft = glossary({ id: 1, status: 'Draft' });
    const approved = glossary({ id: 2, status: 'Approved', lifecycle_id: 7, brand_id: 'brand-7' });
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      listGlossary: jest.fn().mockResolvedValue([draft, approved]),
    };
    const svc = makeSvc(repo);
    const out = await svc.listGlossary({ staffId: 9 });
    expect(repo.listGlossary).toHaveBeenCalledWith([4, 7], ['Draft', 'Approved']);
    expect(out.items).toEqual([draft, approved]);
  });

  it('filters to lifecycle hint when that id is in scope', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4, 7]),
      listGlossary: jest.fn().mockResolvedValue([glossary({ id: 1, status: 'Draft' })]),
    };
    const svc = makeSvc(repo);
    await svc.listGlossary({ staffId: 9, lifecycleHint: 4 });
    expect(repo.listGlossary).toHaveBeenCalledWith([4], ['Draft', 'Approved']);
  });

  it('returns empty when staff has no scoped lifecycles', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), listGlossary: jest.fn() };
    const svc = makeSvc(repo);
    await expect(svc.listGlossary({ staffId: 9 })).resolves.toEqual({ items: [] });
    expect(repo.listGlossary).not.toHaveBeenCalled();
  });

  it('does not report a query error as an empty glossary list', async () => {
    const boom = Object.assign(new Error('too many connections'), { code: '53300' });
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listGlossary: jest.fn().mockRejectedValue(boom),
    };
    const svc = makeSvc(repo);
    await expect(svc.listGlossary({ staffId: 9 })).rejects.toBe(boom);
  });
});

describe('ContentOsPortfolioService.approveGlossary', () => {
  it('approves a Draft glossary term in scope (human only)', async () => {
    const draft = glossary({ id: 11, status: 'Draft' });
    const approved = { ...draft, status: 'Approved' as const };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getGlossaryById: jest.fn().mockResolvedValue(draft),
      updateGlossaryStatus: jest.fn().mockResolvedValue(approved),
    };
    const svc = makeSvc(repo);
    const out = await svc.approveGlossary({ staffId: 9, glossaryId: 11 });
    expect(repo.updateGlossaryStatus).toHaveBeenCalledWith(11, 'Approved');
    expect(out.status).toBe('Approved');
  });

  it('returns 409 when glossary is not Draft', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getGlossaryById: jest.fn().mockResolvedValue(glossary({ id: 11, status: 'Approved' })),
      updateGlossaryStatus: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveGlossary({ staffId: 9, glossaryId: 11 })).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateGlossaryStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when glossary lifecycle is outside staff scope', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getGlossaryById: jest.fn().mockResolvedValue(glossary({ id: 11, status: 'Draft', lifecycle_id: 99 })),
      updateGlossaryStatus: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveGlossary({ staffId: 9, glossaryId: 11 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.updateGlossaryStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when glossary is missing', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getGlossaryById: jest.fn().mockResolvedValue(null),
      updateGlossaryStatus: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(svc.approveGlossary({ staffId: 9, glossaryId: 404 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ContentOsPortfolioService.createGlossary', () => {
  it('inserts Draft only and audits glossary_create', async () => {
    const created = glossary({ id: 21, status: 'Draft', term: 'sống xanh', locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung' });
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      insertGlossary: jest.fn().mockResolvedValue(created),
      insertAuditExport: jest.fn().mockResolvedValue({}),
    };
    const svc = makeSvc(repo);
    const out = await svc.createGlossary({
      staffId: 9,
      actor: 'am@ptt.vn',
      body: {
        term: 'sống xanh',
        locale: 'vi-VN',
        brand_id: 'tiep-thi-noi-dung',
        lifecycle_id: 4,
      },
    });
    expect(repo.insertGlossary).toHaveBeenCalledWith(
      expect.objectContaining({
        term: 'sống xanh',
        locale: 'vi-VN',
        brand_id: 'tiep-thi-noi-dung',
        lifecycle_id: 4,
        status: 'Draft',
      }),
    );
    expect(repo.insertAuditExport).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'am@ptt.vn', action: 'glossary_create' }),
    );
    expect(out.status).toBe('Draft');
  });

  it('maps unique violation to 409 glossary_duplicate', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      insertGlossary: jest.fn().mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' })),
      insertAuditExport: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(
      svc.createGlossary({
        staffId: 9,
        actor: 'am@ptt.vn',
        body: {
          term: 'sống xanh',
          locale: 'vi-VN',
          brand_id: 'tiep-thi-noi-dung',
          lifecycle_id: 4,
        },
      }),
    ).rejects.toMatchObject({ response: { error: 'glossary_duplicate' } });
    expect(repo.insertAuditExport).not.toHaveBeenCalled();
  });
});

describe('ContentOsPortfolioService.patchGlossaryDraft', () => {
  it('patches Draft preferred wording', async () => {
    const draft = glossary({ id: 11, status: 'Draft' });
    const patched = { ...draft, preferred: 'Sống xanh' };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getGlossaryById: jest.fn().mockResolvedValue(draft),
      updateGlossaryDraft: jest.fn().mockResolvedValue(patched),
    };
    const svc = makeSvc(repo);
    const out = await svc.patchGlossaryDraft({
      staffId: 9,
      glossaryId: 11,
      body: { preferred: 'Sống xanh' },
    });
    expect(repo.updateGlossaryDraft).toHaveBeenCalledWith(11, { preferred: 'Sống xanh' });
    expect(out.preferred).toBe('Sống xanh');
  });

  it('returns 409 glossary_not_draft when Approved', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      getGlossaryById: jest.fn().mockResolvedValue(glossary({ id: 11, status: 'Approved' })),
      updateGlossaryDraft: jest.fn(),
    };
    const svc = makeSvc(repo);
    await expect(
      svc.patchGlossaryDraft({ staffId: 9, glossaryId: 11, body: { preferred: 'x' } }),
    ).rejects.toMatchObject({ response: { error: 'glossary_not_draft' } });
    expect(repo.updateGlossaryDraft).not.toHaveBeenCalled();
  });
});

describe('ContentOsPortfolioService.getPortfolioItem glossary_hits', () => {
  it('attaches only Approved glossary terms found in copy', async () => {
    const item = {
      id: 21,
      lifecycle_id: 4,
      brief_json: { brand_id: 'brand-4', locale: 'vi' },
      body_json: { markdown: 'CTA: đăng ký nhận tư vấn ngay.' },
    };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        glossary({ id: 1, status: 'Draft', term: 'draft-secret' }),
        glossary({ id: 2, status: 'Approved', term: 'đăng ký nhận tư vấn' }),
        glossary({ id: 3, status: 'Approved', term: 'unused-term' }),
      ]),
    };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, items);
    const out = await svc.getPortfolioItem({ staffId: 9, itemId: 21, lifecycleHint: 4 });
    expect(out.glossary_hits).toEqual(['đăng ký nhận tư vấn']);
    expect(out.glossary_hits).not.toContain('draft-secret');
    expect(out.glossary_hits).not.toContain('unused-term');
  });

  it('leaves glossary_hits empty when no approved terms match', async () => {
    const item = { id: 21, lifecycle_id: 4, body_json: { markdown: 'plain copy' } };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([]),
    };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, items);
    const out = await svc.getPortfolioItem({ staffId: 9, itemId: 21, lifecycleHint: 4 });
    expect(out.glossary_hits ?? []).toEqual([]);
  });

  it('does not highlight another brand or locale when the item has both', async () => {
    const item = {
      id: 21,
      lifecycle_id: 4,
      brief_json: { brand_id: 'brand-4', locale: 'vi' },
      body_json: { markdown: 'CTA: đăng ký nhận tư vấn other-brand other-locale' },
    };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        glossary({ id: 2, status: 'Approved', term: 'đăng ký nhận tư vấn', brand_id: 'brand-4', locale: 'vi' }),
        glossary({ id: 8, status: 'Approved', term: 'other-brand', brand_id: 'brand-9', locale: 'vi' }),
        glossary({ id: 9, status: 'Approved', term: 'other-locale', brand_id: 'brand-4', locale: 'en' }),
      ]),
    };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, items);
    const out = await svc.getPortfolioItem({ staffId: 9, itemId: 21, lifecycleHint: 4 });
    expect(out.glossary_hits).toEqual(['đăng ký nhận tư vấn']);
    expect(out.glossary_hits).not.toContain('other-brand');
    expect(out.glossary_hits).not.toContain('other-locale');
  });

  it('leaves glossary_hits empty when the item is missing brand_id or locale', async () => {
    const item = {
      id: 21,
      lifecycle_id: 4,
      brief_json: {},
      body_json: { markdown: 'CTA: đăng ký nhận tư vấn ngay.' },
    };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        glossary({ id: 2, status: 'Approved', term: 'đăng ký nhận tư vấn' }),
      ]),
    };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const svc = makeSvc(repo, items);
    const out = await svc.getPortfolioItem({ staffId: 9, itemId: 21, lifecycleHint: 4 });
    expect(out.glossary_hits ?? []).toEqual([]);
  });

  it('highlights copy when the brief lacks brand_id/locale but the lifecycle snapshot has them', async () => {
    const item = {
      id: 21,
      lifecycle_id: 4,
      brief_json: {},
      body_json: { markdown: 'CTA: đăng ký nhận tư vấn ngay.' },
    };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        glossary({ id: 2, status: 'Approved', term: 'đăng ký nhận tư vấn' }),
      ]),
    };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const marketingRepo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue({
        brand_context_json: { brand_id: 'brand-4', locale: 'vi' },
      }),
    };
    const svc = makeSvc(repo, items, marketingRepo);
    const out = await svc.getPortfolioItem({ staffId: 9, itemId: 21, lifecycleHint: 4 });
    expect(marketingRepo.getActiveSnapshotSummary).toHaveBeenCalledWith(4);
    expect(out.glossary_hits).toEqual(['đăng ký nhận tư vấn']);
  });

  it('lets item brief brand_id/locale win over snapshot scope', async () => {
    const item = {
      id: 21,
      lifecycle_id: 4,
      brief_json: { brand_id: 'brand-4', locale: 'vi' },
      body_json: { markdown: 'item-wins snapshot-term' },
    };
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
      listGlossaryForLifecycle: jest.fn().mockResolvedValue([
        glossary({ id: 2, status: 'Approved', term: 'item-wins', brand_id: 'brand-4', locale: 'vi' }),
        glossary({
          id: 8,
          status: 'Approved',
          term: 'snapshot-term',
          brand_id: 'brand-9',
          locale: 'en',
        }),
      ]),
    };
    const items = { getItem: jest.fn().mockResolvedValue(item) };
    const marketingRepo = {
      getActiveSnapshotSummary: jest.fn().mockResolvedValue({
        brand_context_json: { brand_id: 'brand-9', locale: 'en' },
      }),
    };
    const svc = makeSvc(repo, items, marketingRepo);
    const out = await svc.getPortfolioItem({ staffId: 9, itemId: 21, lifecycleHint: 4 });
    expect(out.glossary_hits).toEqual(['item-wins']);
    expect(out.glossary_hits).not.toContain('snapshot-term');
  });
});
