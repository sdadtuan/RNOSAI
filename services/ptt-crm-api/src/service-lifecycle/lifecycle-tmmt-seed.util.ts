import {
  OFFICIAL_TMMT_CORE_KEYS,
  TARGET_MARKET_PROF_KEYS,
} from './lifecycle-marketing-plan.util';

function trimText(value: unknown, max = 400): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function setIfEmpty(
  target: Record<string, string>,
  key: string,
  value: string,
  overwrite: boolean,
  filled: string[],
): void {
  const next = trimText(value);
  if (!next) return;
  const current = trimText(target[key]);
  if (!overwrite && current) return;
  if (current === next) return;
  target[key] = next;
  if (!filled.includes(key)) filled.push(key);
}

/**
 * Seed official R5 TMMT fields from Consult brief + Intake highlights.
 * BANT Go ≠ TMMT filled — this bridges the gap so Gate isn't stuck at 0/12 after Intake Go.
 */
export function buildOfficialTmmtSeedFromConsult(input: {
  consultBrief: Record<string, unknown> | null | undefined;
  existingProf?: Record<string, string>;
  existingSf?: Record<string, string>;
  overwrite?: boolean;
}): {
  target_market_prof: Record<string, string>;
  strategy_framework: Record<string, string>;
  filled_keys: string[];
} {
  const overwrite = Boolean(input.overwrite);
  const prof: Record<string, string> = { ...(input.existingProf ?? {}) };
  const sf: Record<string, string> = { ...(input.existingSf ?? {}) };
  const filled: string[] = [];
  const brief = input.consultBrief ?? {};
  const highlights = (brief.highlights ?? {}) as Record<string, unknown>;
  const readiness = (brief.readiness ?? {}) as Record<string, unknown>;

  const pain = trimText(highlights.pain);
  const niche = trimText(highlights.niche);
  const domain = trimText(highlights.domain);
  const goal = trimText(highlights.goal);
  const budget =
    highlights.budget_vnd != null && Number.isFinite(Number(highlights.budget_vnd))
      ? Number(highlights.budget_vnd)
      : null;
  const decision = trimText(readiness.decision);
  const bantTotal = Number(readiness.bant_total ?? 0) || 0;
  const serviceLabel = trimText(brief.service_label) || trimText(brief.service_slug);

  const stakeholders = Array.isArray(brief.stakeholders) ? brief.stakeholders : [];
  const personaParts = stakeholders
    .map((row) => {
      if (!row || typeof row !== 'object') return '';
      const r = row as Record<string, unknown>;
      const role = trimText(r.role_label || r.role);
      const name = trimText(r.name);
      if (!role && !name) return '';
      return [role, name].filter(Boolean).join(': ');
    })
    .filter(Boolean)
    .slice(0, 6);
  const intakeSummary = stripIntakeSummaryNoise(trimText(brief.latest_intake_summary, 800));

  setIfEmpty(
    prof,
    'market_context',
    [
      niche ? `Ngành: ${niche}` : '',
      domain ? `Domain: ${domain}` : '',
      serviceLabel ? `DV: ${serviceLabel}` : '',
      pain ? `Pain: ${pain}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'tam_sam_som',
    budget != null && budget > 0
      ? `Ngân sách MKT ~${Math.round(budget / 1_000_000)}M VND/tháng (từ Lead/Intake).`
      : niche
        ? `SAM sơ bộ: SME ${niche} đang tìm agency.`
        : '',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'geo_behavior',
    domain
      ? `Website/domain: ${domain}. Hành vi tìm kiếm online + social proof.`
      : 'Tập trung Việt Nam; hành vi tìm kiếm solution online.',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'segmentation_icp',
    niche
      ? `ICP: doanh nghiệp ${niche}${pain ? ` — pain: ${pain.slice(0, 160)}` : ''}.`
      : pain
        ? `ICP theo pain Intake: ${pain.slice(0, 220)}.`
        : '',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'personas_roles',
    personaParts.length
      ? personaParts.join(' · ')
      : 'Owner/GM · Trưởng MKT · Người ra quyết định mua dịch vụ agency.',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'jobs_to_be_done',
    goal || 'Tạo pipeline ổn định · Giảm CPL · Có dashboard minh bạch.',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'pains_desired_outcomes',
    pain
      ? `${pain}${goal ? ` → Mong muốn: ${goal}` : ''}`
      : goal
        ? `Mục tiêu: ${goal}`
        : '',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'buy_triggers_obstacles',
    decision === 'go'
      ? `Intake Go (BANT ${bantTotal}/30) — sẵn sàng chuyển Consult/đề xuất.`
      : bantTotal > 0
        ? `BANT ${bantTotal}/30 · Decision ${decision || '—'}.`
        : '',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'criteria_vs_alternatives',
    'Ưu tiên agency có SOP rõ, báo cáo minh bạch, cam kết KPI; tránh agency chỉ chạy ads không chiến lược.',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'insights_evidence',
    intakeSummary || (pain ? `Insight Intake: ${pain.slice(0, 280)}` : ''),
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'segment_priorities',
    niche ? `Ưu tiên phân khúc ${niche} core; mở rộng online nationwide.` : '',
    overwrite,
    filled,
  );
  setIfEmpty(
    prof,
    'success_hypotheses_next',
    goal
      ? `Giả thuyết: nếu tập trung ${goal.slice(0, 120)} thì CPL/lead chất lượng cải thiện trong 60–90 ngày.`
      : decision === 'go'
        ? 'Giả thuyết: sau Intake Go, TMMT + Consult đủ sâu sẽ mở proposal trong sprint tới.'
        : '',
    overwrite,
    filled,
  );

  setIfEmpty(
    sf,
    'target_market',
    [
      niche ? `TMMT: ${niche}` : 'TMMT từ Consult/Intake',
      pain ? pain.slice(0, 160) : '',
      domain ? `Domain ${domain}` : '',
    ]
      .filter(Boolean)
      .join(' — '),
    overwrite,
    filled,
  );

  // Ensure core keys stay in filled list when present
  for (const key of [...OFFICIAL_TMMT_CORE_KEYS, ...TARGET_MARKET_PROF_KEYS]) {
    if (trimText(prof[key]) && !filled.includes(key)) {
      /* already counted when set */
    }
  }

  return {
    target_market_prof: prof,
    strategy_framework: sf,
    filled_keys: filled.sort(),
  };
}

function stripIntakeSummaryNoise(text: string): string {
  return text
    .replace(/\bBANT\s*:?\s*\d+\s*\/\s*30\b/gi, '')
    .replace(/\bDecision:\s*[^\s·|,;]+/gi, '')
    .replace(/\s*·\s*·\s*/g, ' · ')
    .replace(/^[\s·|,;-]+/, '')
    .replace(/[\s·|,;-]+$/, '')
    .trim();
}
