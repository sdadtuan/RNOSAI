'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchLeadPresalesClientBrief,
  fetchLeadPresalesMarketingPlan,
  patchLead,
  patchLeadPresalesClientBrief,
  patchLeadPresalesMarketingPlan,
  patchLeadPresalesTask,
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
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
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
      setBudget('');
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
      if (saved.missing.length > 0) return;
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

      <label className="client-plan-brief__field">
        Điểm khác biệt <i className="client-plan-brief__star">*</i>
        <textarea value={usp} disabled={!canEdit || busy} onChange={(event) => setUsp(event.target.value)} />
      </label>
      <label className="client-plan-brief__field">
        Mục tiêu đo được <i className="client-plan-brief__star">*</i>
        <textarea value={goal} disabled={!canEdit || busy} onChange={(event) => setGoal(event.target.value)} />
      </label>
      <label className="client-plan-brief__field">
        Kênh muốn chạy và cách chốt đơn <i className="client-plan-brief__star">*</i>
        <textarea value={channels} disabled={!canEdit || busy} onChange={(event) => setChannels(event.target.value)} />
      </label>

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
