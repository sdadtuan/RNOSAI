import { describe, it, expect } from 'vitest';
import {
  addDiscoveryService,
  buildDiscoveryCompatAnswers,
  discoveryClientBriefPatch,
  discoveryConsultFormPatch,
  discoveryProgress,
  groupCatalogServices,
  liftDiscoveryServiceCodes,
  isDiscoveryScopeSlug,
  discoveryServiceChips,
  groupDiscoveryServiceChips,
  isDiscoveryParentSelected,
  discoveryParentStoredCode,
  isDiscoveryComplete,
  normalizeSalesDiscoveryBrief,
  parseWebsiteBundle,
  prefillSalesDiscovery,
  primaryServiceSlug,
  sessionHasCompleteDiscovery,
  toggleDiscoveryChannel,
  emptySalesDiscoveryBrief,
  DISCOVERY_REQUIRED_FIELDS,
  discoveryFieldFocus,
} from './sales-discovery';

function filledBrief() {
  return normalizeSalesDiscoveryBrief({
    company_name: 'Spa Hoa',
    industry: 'spa',
    flagship_product: 'Massage',
    contact_name: 'An',
    phone: '0901234567',
    services: ['ai-chatbot-ban-hang', 'thiet-lap-crm'],
    biggest_problem: 'Ít lead',
    marketing_goal: '30 lead/tháng',
    target_customers: 'Nữ 25-45',
    region: 'TP.HCM',
    budget_band: '10_30',
    timeline_band: 'this_month',
    call_notes: 'Gọi 10 phút, quan tâm chatbot',
    temperature: 'hot',
    websites: 'https://spa.vn https://facebook.com/spa',
    channels: ['facebook', 'none'],
  });
}

describe('sales-discovery.util', () => {
  it('counts 14 core fields and treats services as required', () => {
    const empty = discoveryProgress(emptySalesDiscoveryBrief());
    expect(empty.total).toBe(14);
    expect(empty.filled).toBe(0);
    expect(empty.missing).toContain('Dịch vụ quan tâm');
    expect(isDiscoveryComplete(filledBrief())).toBe(true);
    expect(discoveryProgress(filledBrief()).filled).toBe(14);
  });

  it('drops "Chưa triển khai" when another channel is selected', () => {
    const brief = filledBrief();
    expect(brief.channels).toEqual(['facebook']);
    expect(toggleDiscoveryChannel(['facebook'], 'none')).toEqual(['none']);
    expect(toggleDiscoveryChannel(['none'], 'google')).toEqual(['google']);
  });

  it('parses website bundle and consult/client patches', () => {
    const urls = parseWebsiteBundle('https://spa.vn https://facebook.com/spa https://tiktok.com/@spa');
    expect(urls.website).toContain('spa.vn');
    expect(urls.fanpage).toContain('facebook.com');
    expect(urls.tiktok).toContain('tiktok.com');
    const brief = filledBrief();
    const form = discoveryConsultFormPatch(brief);
    expect(form.goal).toBe('30 lead/tháng');
    expect(form.target_audience).toBe('Nữ 25-45');
    expect(form.need).toBe('Ít lead');
    const client = discoveryClientBriefPatch(brief);
    expect(client.goal).toBe('30 lead/tháng');
    expect(client.website).toContain('spa.vn');
    expect(primaryServiceSlug(brief.services)).toBe('ai-chatbot-ban-hang');
  });

  it('prefills from lead + legacy session and keeps an existing brief', () => {
    const prefilled = prefillSalesDiscovery({
      company_name: 'Lead Co',
      full_name: 'Bánh',
      phone: '0911',
      email: 'a@b.c',
      need: 'Need from lead',
      industry_slug: 'fnb',
      session: {
        company_name: 'Session Co',
        contact_name: 'Chi',
        contact_role: 'owner',
        lead_temperature: 'warm',
        service_slug: 'thiet-ke-landing-page',
        answers_json: { notes: 'ghi chú cũ', crm_fields: { need: 'pain' } },
      },
    });
    expect(prefilled.company_name).toBe('Session Co');
    expect(prefilled.contact_name).toBe('Chi');
    expect(prefilled.phone).toBe('0911');
    expect(prefilled.industry).toBe('fnb');
    expect(prefilled.biggest_problem).toBe('pain');
    expect(prefilled.temperature).toBe('warm');
    expect(prefilled.services).toEqual(['thiet-ke-landing-page']);
    expect(prefilled.call_notes).toBe('ghi chú cũ');

    const existing = prefillSalesDiscovery({
      company_name: 'Ignored',
      session: {
        answers_json: { discovery_brief: filledBrief() },
      },
    });
    expect(existing.company_name).toBe('Spa Hoa');
    expect(sessionHasCompleteDiscovery({ discovery_brief: filledBrief() })).toBe(true);
  });

  it('does not revive a leftover service_slug when discovery_brief.services is an explicit empty list', () => {
    const cleared = prefillSalesDiscovery({
      session: {
        service_slug: 'scope:125',
        answers_json: { discovery_brief: { ...emptySalesDiscoveryBrief(), services: [] } },
      },
    });
    expect(cleared.services).toEqual([]);

    const legacy = prefillSalesDiscovery({
      session: {
        service_slug: 'thiet-ke-landing-page',
        answers_json: { notes: 'x' },
      },
    });
    expect(legacy.services).toEqual(['thiet-ke-landing-page']);
  });


  it('merges compat answers and adds services without duplicates', () => {
    const answers = buildDiscoveryCompatAnswers({ keep: 1, crm_fields: { other: 'x' } }, filledBrief());
    expect(answers.keep).toBe(1);
    expect((answers.crm_fields as { other: string; need: string }).other).toBe('x');
    expect((answers.crm_fields as { need: string }).need).toBe('Ít lead');
    expect(answers.discovery_brief).toMatchObject({ company_name: 'Spa Hoa' });
    expect(addDiscoveryService(['a'], 'a')).toEqual(['a']);
    expect(addDiscoveryService(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('groups known catalog slugs and leaves leftovers in Other', () => {
    const groups = groupCatalogServices([
      { slug: 'ai-chatbot-ban-hang', name: 'AI' },
      { slug: 'mystery-svc', name: 'Mystery' },
    ]);
    expect(groups.some((g) => g.services.some((s) => s.slug === 'ai-chatbot-ban-hang'))).toBe(true);
    const other = groups.find((g) => g.key === 'other');
    expect(other?.services.map((s) => s.slug)).toEqual(['mystery-svc']);
  });
});

describe('parseWebsiteBundle labeled and compact forms', () => {
  it('splits facebook.com and tiktok.com without protocol', () => {
    const urls = parseWebsiteBundle('facebook.com/pandatea tiktok.com/@pandatea');
    expect(urls.fanpage).toBe('facebook.com/pandatea');
    expect(urls.tiktok).toBe('tiktok.com/@pandatea');
  });

  it('reads Fanpage: and TikTok: labels', () => {
    const urls = parseWebsiteBundle('Website: spa.vn Fanpage: facebook.com/spa TikTok: tiktok.com/@spa');
    expect(urls.website).toContain('spa.vn');
    expect(urls.fanpage).toContain('facebook.com/spa');
    expect(urls.tiktok).toContain('tiktok.com/@spa');
  });
});


describe("liftDiscoveryServiceCodes", () => {
  const groups = [
    {
      services: [
        {
          slug: "dich-vu-seo-tong-the",
          children: [
            { slug: "scope:11" },
            { slug: "scope:12" },
          ],
        },
        { slug: "lead-gen" },
      ],
    },
  ];

  it("maps scope slugs back to the parent service code and de-duplicates", () => {
    expect(
      liftDiscoveryServiceCodes(
        ["scope:11", "scope:12", "lead-gen", "scope:11", "mystery"],
        groups,
      ),
    ).toEqual(["dich-vu-seo-tong-the", "lead-gen", "mystery"]);
  });

  it("drops unknown scope slugs and ignores empties", () => {
    expect(isDiscoveryScopeSlug("scope:99")).toBe(true);
    expect(isDiscoveryScopeSlug("dich-vu-seo-tong-the")).toBe(false);
    expect(liftDiscoveryServiceCodes(["scope:99", "", "lead-gen"], groups)).toEqual(["lead-gen"]);
  });
});


describe("discovery service chips and parent-level selection", () => {
  const groups = [
    {
      services: [
        {
          slug: "ai-chatbot-ban-hang",
          name: "AI Chatbot & Tro ly ban hang AI",
          children: [
            { slug: "scope:1", name: "Kich ban hoi thoai" },
            { slug: "scope:2", name: "Tich hop CRM" },
          ],
        },
        { slug: "lead-gen", name: "Lead generation" },
      ],
    },
  ];

  it("builds chips for a scope pick with the parent shown separately", () => {
    expect(discoveryServiceChips(["scope:1"], groups)).toEqual([
      { slug: "scope:1", title: "Kich ban hoi thoai", parent: "AI Chatbot & Tro ly ban hang AI" },
    ]);
  });

  it("builds a chip for a childless service and a legacy parent name code", () => {
    expect(discoveryServiceChips(["lead-gen", "AI Chatbot & Tro ly ban hang AI"], groups)).toEqual([
      { slug: "lead-gen", title: "Lead generation" },
      { slug: "AI Chatbot & Tro ly ban hang AI", title: "AI Chatbot & Tro ly ban hang AI" },
    ]);
  });

  it("detects a parent-level selection by slug or legacy name without requiring scope ticks", () => {
    const svc = groups[0].services[0];
    expect(isDiscoveryParentSelected(["ai-chatbot-ban-hang"], svc)).toBe(true);
    expect(isDiscoveryParentSelected(["AI Chatbot & Tro ly ban hang AI"], svc)).toBe(true);
    expect(discoveryParentStoredCode(["AI Chatbot & Tro ly ban hang AI"], svc)).toBe("AI Chatbot & Tro ly ban hang AI");
    expect(isDiscoveryParentSelected(["scope:1"], svc)).toBe(false);
    expect(isDiscoveryParentSelected(["lead-gen"], svc)).toBe(false);
  });
});

describe('normalizeSalesDiscoveryBrief trim option', () => {
  it('keeps trailing spaces when trim is disabled, and trims by default for save', () => {
    const live = normalizeSalesDiscoveryBrief(
      { contact_name: 'Nguyen ', company_name: 'Spa Hoa Sen ', biggest_problem: 'Ít lead ' },
      { trim: false },
    );
    expect(live.contact_name).toBe('Nguyen ');
    expect(live.company_name).toBe('Spa Hoa Sen ');
    expect(live.biggest_problem).toBe('Ít lead ');
    const saved = normalizeSalesDiscoveryBrief(live);
    expect(saved.contact_name).toBe('Nguyen');
    expect(saved.company_name).toBe('Spa Hoa Sen');
    expect(saved.biggest_problem).toBe('Ít lead');
  });
});



describe('discoveryFieldFocus', () => {
  it('covers every required missing-item key with a wizard tab and testid', () => {
    const keys = DISCOVERY_REQUIRED_FIELDS.map((row) => row.key);
    expect(keys).toHaveLength(14);
    for (const key of keys) {
      const dest = discoveryFieldFocus(key);
      expect(dest.step).toBeGreaterThanOrEqual(1);
      expect(dest.step).toBeLessThanOrEqual(3);
      expect(dest.testid).toMatch(/^sd-/);
    }
  });
});

describe('groupDiscoveryServiceChips', () => {
  it('groups scope chips under the parent service and collects standalone services in one row group', () => {
    const groups = groupDiscoveryServiceChips([
      { slug: 'brand-workshop', title: 'Brand workshop với lãnh đạo', parent: 'Hệ thống nhận diện Thương hiệu' },
      { slug: 'seo', title: 'SEO tổng thể' },
      { slug: 'nc-kh', title: 'Nghiên cứu khách hàng/khảo sát nhận thức', parent: 'Hệ thống nhận diện Thương hiệu' },
      { slug: 'content', title: 'Content marketing' },
    ]);
    expect(groups).toEqual([
      {
        parent: null,
        items: [
          { slug: 'seo', title: 'SEO tổng thể' },
          { slug: 'content', title: 'Content marketing' },
        ],
      },
      {
        parent: 'Hệ thống nhận diện Thương hiệu',
        items: [
          { slug: 'brand-workshop', title: 'Brand workshop với lãnh đạo', parent: 'Hệ thống nhận diện Thương hiệu' },
          { slug: 'nc-kh', title: 'Nghiên cứu khách hàng/khảo sát nhận thức', parent: 'Hệ thống nhận diện Thương hiệu' },
        ],
      },
    ]);
    const heading = groups[1]?.parent ?? '';
    const scopeTitles = (groups[1]?.items ?? []).map((item) => item.title).join(' ');
    expect(heading).toBe('Hệ thống nhận diện Thương hiệu');
    expect(scopeTitles).not.toMatch(/…|\.\.\./);
  });
});
