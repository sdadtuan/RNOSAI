'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchLeadPresalesClientBrief,
  fetchLeadPresalesMarketingPlan,
  patchLead,
  patchLeadPresalesClientBrief,
  patchLeadPresalesMarketingPlan,
  patchLeadPresalesTask,
  postLeadPresalesClientBriefSuggest,
  postLeadPresalesClientPlanExport,
  postLeadPresalesMarketingPlanAiDraft,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import {
  clientBriefUiMissing,
  clientPlanDraftModelLine,
  clientPlanPptxBlob,
  downloadNamedBlob,
  g4MessagesVi,
  mergeHumanEditedKeys,
  showClientPlanExportButton,
} from '@/lib/crm/client-plan-brief.ui';
import { CONSULT_CHANNEL_OPTIONS, formatChannelsBrief, parseChannelsBrief } from '@/lib/crm/consult-facts-suggest.ui';
import { hydratePresalesR5Form } from '@/lib/crm/presales-r5-plan.util';

const PLAN_FIELDS: Array<{ key: string; label: string; slot: string }> = [
  { key: 'name', label: 'Tên kế hoạch', slot: 'name' },
  { key: 'north_star', label: 'North Star', slot: 'star' },
  { key: 'objectives', label: 'Mục tiêu chiến lược', slot: 'objectives' },
  { key: 'target_market', label: 'Thị trường mục tiêu', slot: 'target' },
  { key: 'market_message', label: 'Thông điệp thị trường', slot: 'message' },
  { key: 'media_reach', label: 'Kênh tiếp cận', slot: 'reach' },
  { key: 'conversion_strategy', label: 'Chiến lược chuyển đổi', slot: 'convert' },
  { key: 'retention_system', label: 'Hệ thống giữ chân', slot: 'retain' },
  { key: 'nurture_system', label: 'Nuôi dưỡng lead', slot: 'nurture' },
  { key: 'world_class_experience', label: 'Trải nghiệm', slot: 'experience' },
  { key: 'lifecycle_extension', label: 'Gia hạn', slot: 'extend' },
  { key: 'referral_engine', label: 'Giới thiệu', slot: 'refer' },
];

const EMPTY_PLAN: Record<string, string> = Object.fromEntries(PLAN_FIELDS.map((field) => [field.key, '']));

interface Props {
  token: string;
  leadId: number;
  funnel: LeadFunnelSnapshot;
  canEdit: boolean;
  canAiDraft: boolean;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
}

export function PresalesConsultPlanScreen({
  token,
  leadId,
  funnel,
  canEdit,
  canAiDraft,
  onMessage,
  onError,
  onFunnelChange,
}: Props) {
  const [company, setCompany] = useState('');
  const [niche, setNiche] = useState('');
  const [need, setNeed] = useState('');
  const [storedCompany, setStoredCompany] = useState('');
  const [storedNiche, setStoredNiche] = useState('');
  const [storedNeed, setStoredNeed] = useState('');
  const [usp, setUsp] = useState('');
  const [goal, setGoal] = useState('');
  const [channels, setChannels] = useState('');
  const [audience, setAudience] = useState('');
  const [website, setWebsite] = useState('');
  const [fanpage, setFanpage] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [retain, setRetain] = useState('');
  const [metrics, setMetrics] = useState('');
  const [budget, setBudget] = useState('');
  const [humanEdited, setHumanEdited] = useState<string[]>([]);
  const [dirty, setDirty] = useState<string[]>([]);
  const [plan, setPlan] = useState<Record<string, string>>(EMPTY_PLAN);
  const [planValidation, setPlanValidation] = useState<string[]>([]);
  const [modelName, setModelName] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [factsReady, setFactsReady] = useState(false);
  const [goalPicks, setGoalPicks] = useState<string[]>([]);
  const [suggestedChannels, setSuggestedChannels] = useState<string[]>([]);
  const onErrorRef = useRef(onError);
  const autoSuggestRef = useRef(false);
  const leadRef = useRef(leadId);
  leadRef.current = leadId;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setFactsReady(false);
    autoSuggestRef.current = false;
    setGoalPicks([]);
    setSuggestedChannels([]);
    void (async () => {
      try {
        const [briefOut, planOut] = await Promise.all([
          fetchLeadPresalesClientBrief(token, leadId),
          fetchLeadPresalesMarketingPlan(token, leadId),
        ]);
        if (cancelled) return;
        const hydrated = hydratePresalesR5Form(planOut.plan);
        setStoredCompany(briefOut.facts.company_name);
        setStoredNiche(briefOut.facts.niche);
        setStoredNeed(briefOut.facts.need);
        setCompany(briefOut.facts.company_name);
        setNiche(briefOut.facts.niche);
        setNeed(briefOut.facts.need);
        setUsp(briefOut.brief.usp ?? '');
        setGoal(briefOut.brief.goal ?? '');
        setChannels(briefOut.brief.channels ?? '');
        setAudience(briefOut.brief.audience ?? '');
        setWebsite(briefOut.brief.website ?? '');
        setFanpage(briefOut.brief.fanpage ?? '');
        setCompetitors(briefOut.brief.competitors ?? '');
        setRetain(briefOut.brief.retain ?? '');
        setMetrics(briefOut.brief.metrics ?? '');
        setHumanEdited(briefOut.brief.human_edited_keys ?? []);
        setPlan({
          ...EMPTY_PLAN,
          name: hydrated.planName,
          north_star: hydrated.planNorthStar,
          objectives: hydrated.planObjectives,
          ...hydrated.planStrategy,
        });
        setPlanValidation(planOut.validation.messages ?? []);
        setModelName(planOut.ai_draft?.model_name ?? '');
        setFactsReady(true);
      } catch (err) {
        if (!cancelled) onErrorRef.current?.(err instanceof Error ? err.message : 'Không tải được kế hoạch');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, token]);

  const missing = clientBriefUiMissing({ company_name: company, niche, need, usp, goal, channels });
  const modelLine = clientPlanDraftModelLine(modelName);
  const g4 = g4MessagesVi(planValidation);
  const channelState = parseChannelsBrief(channels);

  useEffect(() => {
    if (!factsReady || !canEdit || !canAiDraft || autoSuggestRef.current) return;
    const parsed = parseChannelsBrief(channels);
    if (usp.trim() && goal.trim() && parsed.selected.length > 0) return;
    if (!company.trim() || !niche.trim() || !need.trim()) return;
    autoSuggestRef.current = true;
    void runSuggest('fill-empty');
    // runSuggest reads the facts from this render; re-running after the fill is blocked by autoSuggestRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factsReady, canEdit, canAiDraft, company, niche, need, usp, goal, channels]);

  function markDirty(key: string, value: string) {
    setPlan((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function briefPatch(withKeys: boolean) {
    return {
      audience,
      usp,
      goal,
      channels,
      retain,
      competitors,
      metrics,
      website,
      fanpage,
      ...(withKeys ? { human_edited_keys: mergeHumanEditedKeys(humanEdited, dirty) } : {}),
    };
  }

  async function runSuggest(mode: 'fill-empty' | 'replace') {
    if (!canEdit || !canAiDraft || suggesting) return;
    if (!company.trim() || !niche.trim() || !need.trim()) {
      onError?.('Thiếu Công ty, Ngành hoặc Nhu cầu.');
      return;
    }
    const requestLead = leadId;
    setSuggesting(true);
    try {
      const out = await postLeadPresalesClientBriefSuggest(token, leadId);
      if (leadRef.current !== requestLead) return;
      const parsed = parseChannelsBrief(channels);
      const nextUsp = mode === 'replace' || !usp.trim() ? out.usp : usp;
      const nextClose = mode === 'replace' || !parsed.close.trim() ? out.close : parsed.close;
      const nextSelected = mode === 'replace' || parsed.selected.length === 0 ? out.channels : parsed.selected;
      const nextChannels = formatChannelsBrief(nextSelected, nextClose);
      setUsp(nextUsp);
      setChannels(nextChannels);
      setGoalPicks(out.goals);
      setSuggestedChannels(out.channels);
      if (nextUsp !== usp || nextChannels !== channels) {
        await patchLeadPresalesClientBrief(token, leadId, {
          ...briefPatch(false),
          usp: nextUsp,
          channels: nextChannels,
        });
      }
      onMessage?.('Đã điền điểm khác biệt và gợi ý mục tiêu, kênh');
    } catch (err) {
      if (leadRef.current === requestLead) onError?.(err instanceof Error ? err.message : 'AI gợi ý thất bại');
    } finally {
      if (leadRef.current === requestLead) setSuggesting(false);
    }
  }

  async function pickGoal(pick: string) {
    setGoal(pick);
    try {
      await persistBrief({ goal: pick });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Không lưu được mục tiêu');
    }
  }

  async function persistBrief(overrides: { usp?: string; goal?: string; channels?: string }) {
    if (!canEdit) return;
    await patchLeadPresalesClientBrief(token, leadId, { ...briefPatch(false), ...overrides });
  }

  function toggleChannel(label: string, on: boolean) {
    const parsed = parseChannelsBrief(channels);
    const selected = on
      ? parsed.selected.includes(label)
        ? parsed.selected
        : [...parsed.selected, label]
      : parsed.selected.filter((item) => item !== label);
    const next = formatChannelsBrief(selected, parsed.close);
    setChannels(next);
    void persistBrief({ channels: next }).catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Không lưu được kênh');
    });
  }

  function setCloseNote(close: string) {
    const parsed = parseChannelsBrief(channels);
    setChannels(formatChannelsBrief(parsed.selected, close));
  }

  function saveCloseNote() {
    void persistBrief({ channels }).catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Không lưu được cách chốt');
    });
  }

  async function persistFacts(): Promise<boolean> {
    const companyTyped = !storedCompany.trim() && company.trim().length > 0;
    const nicheTyped = niche.trim() !== storedNiche.trim() && niche.trim().length > 0;
    const needTyped = need.trim() !== storedNeed.trim() && need.trim().length > 0;
    const budgetTyped = budget.trim().length > 0;
    if (companyTyped) {
      await patchLead(token, leadId, { company_name: company.trim() });
      setStoredCompany(company.trim());
    }
    if (nicheTyped || needTyped || budgetTyped) {
      const leadTask = (funnel.presales?.tasks.lead ?? [])[0];
      if (!leadTask) {
        onError?.('Chưa có task Lead để lưu ngành, nhu cầu, ngân sách.');
        return false;
      }
      await patchLeadPresalesTask(token, leadId, leadTask.id, {
        form_data: {
          ...(leadTask.form_data ?? {}),
          ...(nicheTyped ? { niche: niche.trim() } : {}),
          ...(needTyped ? { need: need.trim() } : {}),
          ...(budgetTyped ? { budget: budget.trim() } : {}),
        },
      });
      if (nicheTyped) setStoredNiche(niche.trim());
      if (needTyped) setStoredNeed(need.trim());
    }
    return true;
  }

  async function onAi() {
    if (!canEdit || !canAiDraft || missing.length > 0) return;
    setBusy(true);
    try {
      const factsOk = await persistFacts();
      if (!factsOk) return;
      const saved = await patchLeadPresalesClientBrief(token, leadId, briefPatch(dirty.length > 0));
      setHumanEdited(saved.brief.human_edited_keys ?? humanEdited);
      if (saved.missing.length > 0) {
        onError?.(`Thiếu ${saved.missing[0]}.`);
        return;
      }
      const out = await postLeadPresalesMarketingPlanAiDraft(token, leadId);
      const hydrated = hydratePresalesR5Form(out.plan);
      const locked = new Set(mergeHumanEditedKeys(saved.brief.human_edited_keys ?? humanEdited, dirty));
      setPlan((prev) => {
        const next: Record<string, string> = {
          ...EMPTY_PLAN,
          name: hydrated.planName,
          north_star: hydrated.planNorthStar,
          objectives: hydrated.planObjectives,
          ...hydrated.planStrategy,
        };
        for (const key of locked) {
          if ((prev[key] ?? '').trim()) next[key] = prev[key];
        }
        return next;
      });
      setPlanValidation(out.validation.messages ?? []);
      setModelName(out.ai?.model ?? out.ai_draft?.model_name ?? '');
      onFunnelChange(out.funnel);
      onMessage?.(out.validation.ok ? 'Đã tạo bản nháp kế hoạch' : 'Bản nháp — cần bổ sung thêm trường');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'AI viết kế hoạch thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!canEdit) return;
    setBusy(true);
    try {
      const factsOk = await persistFacts();
      if (!factsOk) return;
      const keys = mergeHumanEditedKeys(humanEdited, dirty);
      const saved = await patchLeadPresalesClientBrief(token, leadId, {
        ...briefPatch(false),
        human_edited_keys: keys,
      });
      setHumanEdited(saved.brief.human_edited_keys ?? keys);
      setDirty([]);
      const strategy = Object.fromEntries(
        PLAN_FIELDS.filter((field) => !['name', 'north_star', 'objectives'].includes(field.key)).map((field) => [
          field.key,
          plan[field.key] ?? '',
        ]),
      );
      const out = await patchLeadPresalesMarketingPlan(token, leadId, {
        name: plan.name ?? '',
        north_star: plan.north_star ?? '',
        objectives: plan.objectives ?? '',
        strategy_framework: strategy,
      });
      setPlanValidation(out.validation.messages ?? []);
      onFunnelChange(out.funnel);
      onMessage?.('Đã lưu kế hoạch');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Lưu kế hoạch thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBusy(true);
    try {
      const out = await postLeadPresalesClientPlanExport(token, leadId);
      downloadNamedBlob(clientPlanPptxBlob(out.pptx_base64), out.filename);
      if (out.note) onMessage?.(out.note);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Không tải được PPTX');
    } finally {
      setBusy(false);
    }
  }

  function factField(
    label: string,
    value: string,
    stored: string,
    onChange: (value: string) => void,
  ) {
    if (stored.trim()) return <span className="consult-plan__chip">{label}: {stored}</span>;
    return (
      <label className="client-plan-brief__field">
        {label} <i className="client-plan-brief__star">*</i>
        <input value={value} disabled={!canEdit || busy} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  return (
    <section className="consult-plan stack-gap" aria-label="Kế hoạch gửi khách">
      <div className="consult-plan__chips">
        {factField('Công ty', company, storedCompany, setCompany)}
        {factField('Ngành', niche, storedNiche, setNiche)}
        {factField('Nhu cầu', need, storedNeed, setNeed)}
      </div>

      <div className="consult-facts__toolbar">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={busy || suggesting || !canEdit || !canAiDraft || !company.trim() || !niche.trim() || !need.trim()}
          onClick={() => void runSuggest('replace')}
        >
          {suggesting ? 'Đang gợi ý…' : 'AI gợi ý lại'}
        </button>
        <p className="client-plan-brief__hint">Điểm khác biệt do AI điền. Mục tiêu và kênh là gợi ý — chọn hoặc sửa trước khi viết kế hoạch.</p>
      </div>

      <label className="client-plan-brief__field">
        Điểm khác biệt <i className="client-plan-brief__star">*</i>
        <textarea
          aria-label="Điểm khác biệt"
          value={usp}
          disabled={!canEdit || busy || suggesting}
          onChange={(event) => setUsp(event.target.value)}
          onBlur={() => {
            void persistBrief({ usp }).catch((err) => {
              onError?.(err instanceof Error ? err.message : 'Không lưu được điểm khác biệt');
            });
          }}
        />
        <span className="client-plan-brief__hint">AI điền từ ngành và nhu cầu. Sửa nếu chưa đúng.</span>
      </label>

      <div className="client-plan-brief__field">
        <span>
          Mục tiêu đo được <i className="client-plan-brief__star">*</i>
        </span>
        {goalPicks.length > 0 ? (
          <div className="consult-facts__picks" role="listbox" aria-label="Gợi ý mục tiêu">
            {goalPicks.map((pick) => (
              <button
                key={pick}
                type="button"
                className={goal.trim() === pick ? 'consult-facts__pick is-on' : 'consult-facts__pick'}
                disabled={!canEdit || busy || suggesting}
                onClick={() => void pickGoal(pick)}
              >
                {pick}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          aria-label="Mục tiêu đo được"
          value={goal}
          disabled={!canEdit || busy || suggesting}
          onChange={(event) => setGoal(event.target.value)}
          onBlur={() => {
            void persistBrief({ goal }).catch((err) => {
              onError?.(err instanceof Error ? err.message : 'Không lưu được mục tiêu');
            });
          }}
        />
        <span className="client-plan-brief__hint">Chọn một gợi ý hoặc sửa. Số chưa có giữ [cần chốt].</span>
      </div>

      <div className="client-plan-brief__field">
        <span>
          Kênh muốn chạy và cách chốt đơn <i className="client-plan-brief__star">*</i>
        </span>
        <div className="consult-facts__channels" role="group" aria-label="Kênh muốn chạy">
          {CONSULT_CHANNEL_OPTIONS.map((label) => (
            <label key={label} className="consult-facts__check">
              <input
                type="checkbox"
                checked={channelState.selected.includes(label)}
                disabled={!canEdit || busy || suggesting}
                onChange={(event) => toggleChannel(label, event.target.checked)}
              />
              {label}
              {suggestedChannels.includes(label) ? <span className="consult-facts__ai">AI</span> : null}
            </label>
          ))}
        </div>
        <label className="client-plan-brief__field">
          Cách chốt đơn
          <input
            aria-label="Cách chốt đơn"
            value={channelState.close}
            disabled={!canEdit || busy || suggesting}
            onChange={(event) => setCloseNote(event.target.value)}
            onBlur={saveCloseNote}
          />
        </label>
      </div>

      <details>
        <summary>Thêm cho file</summary>
        <div className="stack-gap-sm">
          <label className="client-plan-brief__field">
            Website
            <input value={website} disabled={!canEdit || busy} onChange={(event) => setWebsite(event.target.value)} />
          </label>
          <label className="client-plan-brief__field">
            Fanpage
            <input value={fanpage} disabled={!canEdit || busy} onChange={(event) => setFanpage(event.target.value)} />
          </label>
          <label className="client-plan-brief__field">
            Khách của họ là ai
            <textarea value={audience} disabled={!canEdit || busy} onChange={(event) => setAudience(event.target.value)} />
          </label>
          <label className="client-plan-brief__field">
            Đối thủ
            <textarea value={competitors} disabled={!canEdit || busy} onChange={(event) => setCompetitors(event.target.value)} />
          </label>
          <label className="client-plan-brief__field">
            Khách cũ được giữ thế nào
            <textarea value={retain} disabled={!canEdit || busy} onChange={(event) => setRetain(event.target.value)} />
          </label>
          <label className="client-plan-brief__field">
            Số liệu đang có
            <textarea value={metrics} disabled={!canEdit || busy} onChange={(event) => setMetrics(event.target.value)} />
          </label>
          <label className="client-plan-brief__field">
            Ngân sách/tháng
            <input value={budget} disabled={!canEdit || busy} onChange={(event) => setBudget(event.target.value)} />
          </label>
        </div>
      </details>

      <div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy || !canEdit || !canAiDraft || missing.length > 0}
          onClick={() => void onAi()}
        >
          AI viết kế hoạch
        </button>
        {missing.length > 0 ? (
          <ul className="client-plan-brief__missing">
            {missing.map((label) => (
              <li key={label}>Thiếu {label}.</li>
            ))}
          </ul>
        ) : null}
      </div>

      {modelLine ? (
        <div className="banner banner-warning">
          <strong>Bản nháp — SP duyệt.</strong>
          <p style={{ margin: '0.35rem 0 0' }}>{modelLine}</p>
        </div>
      ) : null}

      {PLAN_FIELDS.map((field) => {
        const locked = humanEdited.includes(field.key) || dirty.includes(field.key);
        return (
          <label className="client-plan-brief__field" key={field.slot}>
            {field.label}
            {locked ? <span className="consult-plan__lock">Đã sửa — AI không đè</span> : null}
            <textarea
              id={`consult-plan-${field.slot}`}
              value={plan[field.key] ?? ''}
              disabled={!canEdit || busy}
              onChange={(event) => markDirty(field.key, event.target.value)}
            />
          </label>
        );
      })}

      {g4.length > 0 ? (
        <ul className="client-plan-brief__missing">
          {g4.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex-gap">
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !canEdit} onClick={() => void onSave()}>
          Lưu
        </button>
        {showClientPlanExportButton(planValidation) ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void onExport()}>
            Tải PPTX
          </button>
        ) : null}
      </div>
    </section>
  );
}
