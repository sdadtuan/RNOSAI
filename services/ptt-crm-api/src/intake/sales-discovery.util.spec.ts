import {
  addDiscoveryService,
  buildDiscoveryCompatAnswers,
  discoveryClientBriefPatch,
  discoveryConsultFormPatch,
  discoveryProgress,
  groupCatalogServices,
  isDiscoveryComplete,
  normalizeSalesDiscoveryBrief,
  parseWebsiteBundle,
  prefillSalesDiscovery,
  primaryServiceSlug,
  sessionHasCompleteDiscovery,
  toggleDiscoveryChannel,
  emptySalesDiscoveryBrief,
} from './sales-discovery.util';

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
