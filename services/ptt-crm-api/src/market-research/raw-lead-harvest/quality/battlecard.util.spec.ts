import { buildRawLeadBattlecard } from './battlecard.util';

describe('buildRawLeadBattlecard', () => {
  const base = {
    id: 42,
    company_name: 'Spa Hoa Mi',
    address: 'Q1, HCM',
    phone: '0909479018',
    phone_norm: '0909479018',
    email: 'a@spa.vn',
    contact_title: 'Quản lý',
    website: 'https://spa.example',
    fanpage_url: null as string | null,
    zalo_url: null as string | null,
    evidence_url: 'https://maps.google.com/?q=1',
    evidence_snippet: 'Spa uy tín Quận 1 chuyên chăm sóc da',
    place_id: 'ChIJ1',
    quality_score: 72,
    icp_fit_score: 60,
    intent_score: 0.8,
    contactable: true,
    readiness_status: 'READY_TO_PUSH',
    classification: 'pass',
    priority_tier: 'P1',
    account_cluster_key: 'place:ChIJ1',
    dial_outcome: null as string | null,
    feedback_code: null as string | null,
  };

  it('builds P1 ready card with contact and evidence', () => {
    const card = buildRawLeadBattlecard({ lead: base, clusterMates: [] });
    expect(card.version).toBe(1);
    expect(card.lead_id).toBe(42);
    expect(card.headline).toContain('Spa Hoa Mi');
    expect(card.headline).toContain('P1');
    expect(card.contact.phone).toBe('0909479018');
    expect(card.evidence.place_id).toBe('ChIJ1');
    expect(card.why_call_now.some((s) => /P1/i.test(s))).toBe(true);
    expect(card.talking_points.length).toBeGreaterThan(0);
    expect(card.talking_points.length).toBeLessThanOrEqual(5);
    expect(card.next_actions[0]).toMatch(/Gọi|Push/i);
  });

  it('flags missing contact and suggests enrich', () => {
    const card = buildRawLeadBattlecard({
      lead: {
        ...base,
        phone: null,
        phone_norm: null,
        contactable: false,
        readiness_status: 'MISSING_CONTACT',
        priority_tier: 'P3',
        quality_score: 20,
      },
      clusterMates: [],
    });
    expect(card.risks.some((r) => /SĐT|contact/i.test(r))).toBe(true);
    expect(card.next_actions[0]).toMatch(/Bổ sung contact/i);
  });

  it('includes dial/feedback risks and cluster mates', () => {
    const card = buildRawLeadBattlecard({
      lead: {
        ...base,
        dial_outcome: 'gatekeeper',
        feedback_code: 'wrong_geo',
        readiness_status: 'NEEDS_REVIEW',
        priority_tier: 'P2',
        global_account_key: 'phone:0909479018',
      },
      clusterMates: [
        {
          id: 99,
          company_name: 'Spa Hoa Mi CN2',
          priority_tier: 'P2',
          phone: '0901111222',
          readiness_status: 'READY_TO_PUSH',
        },
      ],
      crossProjectMates: [
        {
          id: 7,
          project_id: 3,
          project_name: 'Spa HCM',
          company_name: 'Spa Hoa Mi',
          priority_tier: 'P1',
          phone: '0909479018',
        },
      ],
    });
    expect(card.risks.some((r) => /lễ tân|gatekeeper/i.test(r))).toBe(true);
    expect(card.risks.some((r) => /địa bàn|geo|feedback/i.test(r))).toBe(true);
    expect(card.risks.some((r) => /cluster/i.test(r))).toBe(true);
    expect(card.risks.some((r) => /project khác/i.test(r))).toBe(true);
    expect(card.cluster.mates).toHaveLength(1);
    expect(card.cross_project.mates).toHaveLength(1);
    expect(card.cross_project.key).toBe('phone:0909479018');
    expect(card.next_actions[0]).toMatch(/Review|Accept/i);
  });

  it('caps talking points at 5', () => {
    const card = buildRawLeadBattlecard({
      lead: {
        ...base,
        evidence_snippet: 'x'.repeat(200),
        fanpage_url: 'https://facebook.com/spa',
        zalo_url: 'https://zalo.me/spa',
      },
      clusterMates: [],
    });
    expect(card.talking_points.length).toBeLessThanOrEqual(5);
  });
});
