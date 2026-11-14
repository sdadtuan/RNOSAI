'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchIntakeDefinitionBySlug,
  fetchIntakeSessions,
  fetchLeadPresalesMarketingPlan,
  patchLeadPresalesMarketingPlan,
  releaseLeadToSales,
  fetchLeadSolutionAccess,
  returnLeadToSales,
  updateLeadSolutionDeadline,
  postLeadPresalesMarketingPlanAiDraft,
  fetchDiscoveryOptions,
  type DiscoveryServiceGroup,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import { BANT_KEYS, type BantKey } from '@/lib/crm/intake-bant';
import { BANT_CHECKLIST } from '@/lib/crm/intake-bant-checklist';
import { BANT_FIELD_LABELS } from '@/lib/crm/intake-labels';
import { intakeServiceLabel } from '@/lib/crm/intake-service-resolve';
import {
  budgetLabel,
  channelLabels,
  discoveryServiceChips,
  readDiscoveryBriefFromAnswers,
  temperatureLabel,
  timelineLabel,
} from '@/lib/crm/sales-discovery';
import { attachedScopeLines, scopeFromLeadSessions } from '@/lib/crm/consult-attached-scope';
import { p13CodeForIntakeSlug } from '@/lib/crm/p13-intake-service';
import {
  buildSolutionDocumentHtml,
  mergeSolutionLines,
  readSolutionPack,
  solutionPackReady,
  solutionSubmitGaps,
  type SolutionPackLine,
} from '@/lib/crm/solution-pack';
import { fetchP13Service, fetchP13Services } from '@/lib/p13/api';
import type { LeadPartyFormValue } from '@/components/crm/LeadPartyCard';
import { LeadInternalNotes } from '@/components/crm/LeadInternalNotes';
import {
  SOLUTION_FILE_MAX_COUNT,
  solutionFileAddError,
} from '@/lib/crm/solution-file-limit';
import { ActionErrorToast } from '@/components/ui/ActionToast';
import { pushToast } from '@/lib/toast';
import { humanizeCrmApiError } from '@/lib/crm/crm-api-error';
import { formatCompactSlaLine } from '@/lib/crm/sla-countdown-label';
import {
  buildUploadedAttachment,
  readSolutionAttachments,
  type SolutionAttachment,
} from '@/lib/crm/solution-file-display';
import { presentSolutionAiDraft, SOLUTION_AI_DRAFT_LABEL, SOLUTION_AI_PENDING_LABEL, type SolutionAiDraftView } from '@/lib/crm/solution-ai-draft-display';
import { SolutionAiDraftBody, SolutionFileList } from '@/components/crm/SolutionFileList';

type Attachment = SolutionAttachment;

type AnswerLine = { question: string; answer: string; bantKey?: string };

const DECISION_LABEL: Record<string, string> = {
  go: 'Go',
  nurture: 'Nurture',
  no_go: 'No-Go',
};

function plain(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function crmField(session: IntakeSessionRow | null, key: string): string {
  if (!session) return '';
  const raw = session.answers_json;
  if (!raw || typeof raw !== 'object') return '';
  const record = raw as Record<string, unknown>;
  const fields = record.crm_fields;
  if (fields && typeof fields === 'object') {
    const fromFields = plain(String((fields as Record<string, unknown>)[key] ?? ''));
    if (fromFields) return fromFields;
  }
  return plain(String(record[key] ?? ''));
}

function discoveryNotes(session: IntakeSessionRow | null): string {
  if (!session?.answers_json || typeof session.answers_json !== 'object') return '';
  const block = (session.answers_json as Record<string, unknown>).discovery_checklist;
  if (!block || typeof block !== 'object') return '';
  return plain(String((block as Record<string, unknown>).notes ?? ''));
}

function redFlagNotes(session: IntakeSessionRow | null): string {
  if (!session?.answers_json || typeof session.answers_json !== 'object') return '';
  const block = (session.answers_json as Record<string, unknown>).red_flags;
  if (!block || typeof block !== 'object') return '';
  return plain(String((block as Record<string, unknown>).notes ?? ''));
}

const WIN_INTEL_LABELS: Record<string, string> = {
  incumbent: 'Nhà cung cấp hiện tại',
  competitor: 'Đối thủ',
  selection_criteria: 'Tiêu chí chọn đối tác',
  switch_risk: 'Rủi ro khi chuyển đổi',
};

function winIntelLines(session: IntakeSessionRow | null): Array<{ label: string; answer: string }> {
  if (!session?.answers_json || typeof session.answers_json !== 'object') return [];
  const block = (session.answers_json as Record<string, unknown>).win_intel;
  if (!block || typeof block !== 'object') return [];
  const out: Array<{ label: string; answer: string }> = [];
  for (const [key, label] of Object.entries(WIN_INTEL_LABELS)) {
    const entry = (block as Record<string, unknown>)[key];
    const answer =
      entry && typeof entry === 'object'
        ? plain(String((entry as Record<string, unknown>).answer ?? ''))
        : plain(String(entry ?? ''));
    if (answer) out.push({ label, answer });
  }
  return out;
}

function filledCommitments(
  session: IntakeSessionRow | null,
): Array<{ label: string; detail: string; deadline: string }> {
  const rows = session?.commitments_json ?? [];
  return rows
    .map((row, index) => ({
      label: plain(String(row.label ?? '')) || ('Cam kết ' + (index + 1)),
      detail: plain(String(row.detail ?? '')),
      deadline: plain(String(row.deadline ?? '')),
    }))
    .filter((row) => row.detail);
}

function intakeNeed(session: IntakeSessionRow | null): string {
  const raw = session?.answers_json;
  if (!raw || typeof raw !== 'object') return '';
  const record = raw as Record<string, unknown>;
  const fields = record.crm_fields;
  if (fields && typeof fields === 'object') {
    const fromFields = plain(String((fields as { need?: string }).need ?? ''));
    if (fromFields) return fromFields;
  }
  return plain(String(record.need ?? ''));
}

function readFiles(plan: Record<string, unknown> | null): Attachment[] {
  return readSolutionAttachments(plan);
}

function answerLines(
  session: IntakeSessionRow,
  questions: Array<{ key: string; text: string; bant_key?: string }>,
): AnswerLine[] {
  const raw = session.answers_json?.discovery_responses;
  if (!raw || typeof raw !== 'object') return [];
  const byKey = new Map(questions.map((item) => [item.key, item]));
  const lines: AnswerLine[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const answer = plain(String((value as { answer?: string }).answer ?? ''));
    if (!answer) continue;
    const item = byKey.get(key);
    lines.push({
      question: item?.text || key,
      answer,
      bantKey: item?.bant_key,
    });
  }
  return lines;
}

function bantScoreText(key: BantKey, score: number): string {
  if (score < 1 || score > 5) return 'Chưa chấm';
  const chosen = BANT_CHECKLIST[key].items.find((item) => item.score === score);
  return chosen?.label || `${score}/5`;
}

function saigonYmd(iso: string | null | undefined): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Saigon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function isoToViDate(iso: string): string {
  const ymd = saigonYmd(iso) || iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function viDateToIso(vi: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(vi || '').trim());
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  const dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00+07:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function SolutionClock({
  label,
  dueAt,
  overdue,
  soon,
}: {
  label: string;
  dueAt: string;
  overdue: boolean;
  soon: boolean;
}) {
  const dueMs = Date.parse(dueAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(dueMs)) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [dueMs]);
  if (!label || !Number.isFinite(dueMs)) return null;
  const remain = dueMs - now;
  const late = overdue || remain < 0;
  const tone = late
    ? 'quote-case-timer quote-case-timer--late handoff-sla-banner handoff-sla-banner--line handoff-sla-banner--breach'
    : soon
      ? 'quote-case-timer quote-case-timer--soon handoff-sla-banner handoff-sla-banner--line handoff-sla-banner--warning'
      : 'quote-case-timer handoff-sla-banner handoff-sla-banner--line handoff-sla-banner--ok';
  return (
    <p className={tone} aria-live="polite" data-testid="solution-desk-clock">
      {formatCompactSlaLine(label, remain, dueAt)}
    </p>
  );
}

export function SolutionCaseDesk({
  token,
  lead,
  party,
  funnel,
  onFunnelChange,
  onMessage,
  onError,
  filesOnly = false,
  submitOnly = false,
  actionsPanel = false,
  canSubmit = false,
  submitDisabledReason,
  submitBusy = false,
  onSubmitToSales,
  userName,
}: {
  token: string;
  lead: LeadRow;
  party: LeadPartyFormValue;
  funnel: LeadFunnelSnapshot | null;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  filesOnly?: boolean;
  submitOnly?: boolean;
  actionsPanel?: boolean;
  canSubmit?: boolean;
  submitDisabledReason?: string;
  submitBusy?: boolean;
  onSubmitToSales?: () => void | Promise<void>;
  userName?: string;
}) {
  const [session, setSession] = useState<IntakeSessionRow | null>(null);
  const [items, setItems] = useState<Array<{ code: string; label: string }>>([]);
  const [answers, setAnswers] = useState<AnswerLine[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [problem, setProblem] = useState('');
  const [approach, setApproach] = useState('');
  const [lines, setLines] = useState<SolutionPackLine[]>([]);
  const [serviceName, setServiceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'reading' | 'uploading'>('idle');
  const [aiResult, setAiResult] = useState('');
  const [aiDraft, setAiDraft] = useState<SolutionAiDraftView | null>(null);
  const [serviceGroups, setServiceGroups] = useState<DiscoveryServiceGroup[]>([]);
  const solutionFileInputRef = useRef<HTMLInputElement>(null);
  const handoff = funnel?.presales?.handoff?.status ?? '';
  // Only the assigned Solution person (or SUPER-ADMIN) may AI tạo Solution / Nộp; the API enforces it too.
  const [solutionCanAct, setSolutionCanAct] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchLeadSolutionAccess(token, lead.id)
      .then((out) => {
        if (!cancelled) setSolutionCanAct(Boolean(out?.can_act));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, lead.id, handoff]);
  const notAssignee = solutionCanAct === false;
  const notAssigneeTip = 'Chỉ người được giao Solution';
  const solution = funnel?.presales?.solution_case;
  const storedDue = funnel?.presales?.handoff?.solution_due_at || solution?.timer_due_at || '';
  const [deadlineText, setDeadlineText] = useState(() => isoToViDate(storedDue));
  const [deadlineIso, setDeadlineIso] = useState(() => saigonYmd(storedDue));
  useEffect(() => {
    const ymd = saigonYmd(storedDue);
    if (!ymd) return;
    setDeadlineIso(ymd);
    setDeadlineText(isoToViDate(storedDue));
  }, [storedDue]);
  const canEditDeadline = !filesOnly && (Boolean(actionsPanel) || !submitOnly) && (handoff === 'pending' || handoff === 'with_solution');

  useEffect(() => {
    let cancelled = false;
    void fetchDiscoveryOptions(token)
      .then((opts) => {
        if (!cancelled && opts?.service_groups?.length) setServiceGroups(opts.service_groups);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);
  const canEditFiles = handoff === 'pending' || handoff === 'with_solution';
  const serviceSlug = session?.service_slug || funnel?.presales?.presales.service_slug || '';

  const load = useCallback(async () => {
    const sessions = await fetchIntakeSessions(token, { lead_id: lead.id }).catch(() => []);
    const picked =
      [...sessions].sort((a, b) => b.id - a.id).find((row) => row.status === 'completed') ??
      [...sessions].sort((a, b) => b.id - a.id)[0] ??
      null;
    setSession(picked);
    const slug = picked?.service_slug || funnel?.presales?.presales.service_slug || '';
    const [definition, planOut, scopePack] = await Promise.all([
      slug ? fetchIntakeDefinitionBySlug(token, slug).catch(() => null) : Promise.resolve(null),
      fetchLeadPresalesMarketingPlan(token, lead.id).catch(() => null),
      (async () => {
        const scope = scopeFromLeadSessions(sessions, slug);
        if (!scope?.item_codes.length) return { items: [], serviceName: '' };
        const services = await fetchP13Services(token).catch(() => []);
        const code = scope.service_code || p13CodeForIntakeSlug(slug, services) || '';
        const named = services.find((row) => row.code === code)?.name || '';
        if (!code) return { items: scope.item_codes.map((itemCode) => ({ code: itemCode, label: '' })), serviceName: named };
        const detail = await fetchP13Service(token, code).catch(() => null);
        if (!detail) return { items: scope.item_codes.map((itemCode) => ({ code: itemCode, label: '' })), serviceName: named };
        return { items: attachedScopeLines(scope, detail.items), serviceName: detail.name || named };
      })(),
    ]);
    const questions =
      picked?.mode === 'in_person'
        ? definition?.inperson_question_items ?? []
        : definition?.phone_question_items ?? [];
    setAnswers(picked ? answerLines(picked, questions) : []);
    setItems(scopePack.items);
    setServiceName(scopePack.serviceName);
    const plan = planOut?.plan ?? null;
    const draft = readSolutionPack(plan);
    setProblem(draft.problem || intakeNeed(picked));
    setApproach(draft.approach);
    setLines(mergeSolutionLines(scopePack.items, draft.lines));
    setFiles(readFiles(plan));
    setAiDraft(presentSolutionAiDraft(plan));
  }, [funnel?.presales?.presales.service_slug, lead.id, token]);

  useEffect(() => {
    void load().catch(() => setError('Không tải được hồ sơ Sales giao'));
  }, [load]);

  useEffect(() => {
    if (aiDraft?.status !== 'pending') return;
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [aiDraft?.status, load]);

  const discoveryBrief = readDiscoveryBriefFromAnswers(session?.answers_json);
  const need = discoveryBrief?.biggest_problem || intakeNeed(session);
  const leadName = plain(lead.full_name || '');
  const companyOnCard = plain(party.company_name || '');
  const sessionCompany = plain(session?.company_name || '');
  const sessionContact = plain(session?.contact_name || '');
  const people = (session?.stakeholders_json ?? []).filter((row) => {
    const name = plain(String(row.name ?? ''));
    return Boolean(name) && name !== leadName;
  });
  const shownAnswers = answers.filter((line) => {
    const answer = plain(line.answer);
    if (!answer || answer === need || answer === leadName) return false;
    return true;
  });
  const bant = session?.bant_json ?? {};
  const serviceLabel = serviceSlug ? intakeServiceLabel(serviceSlug) : '';

  if (filesOnly) {
    if (!session && files.length === 0) return null;
    const company = sessionCompany || companyOnCard;
    const contact = sessionContact || leadName;
    return (
      <section className="solution-desk" aria-label="File Solution đã nộp">
        <h3>File Solution đã nộp</h3>
        <div className="solution-desk__file-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !canEditFiles}
            onClick={() => solutionFileInputRef.current?.click()}
          >
            Chọn file
          </button>
          {canEditFiles ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || notAssignee}
              title={notAssignee ? notAssigneeTip : undefined}
              data-testid="solution-desk-ai"
              onClick={() => void run(runAiSolution)}
            >
              {busy ? 'Đang tạo Solution…' : 'AI tạo Solution'}
            </button>
          ) : null}
        </div>
        {files.length === 0 ? (
          <p className="muted">Chưa có file Solution.</p>
        ) : (
          <SolutionFileList files={files} />
        )}
        <dl className="solution-desk__facts">
          {company ? (
            <div>
              <dt>Công ty</dt>
              <dd>{company}</dd>
            </div>
          ) : null}
          {contact ? (
            <div>
              <dt>Người liên hệ</dt>
              <dd>{contact}</dd>
            </div>
          ) : null}
          {serviceLabel ? (
            <div>
              <dt>Dịch vụ</dt>
              <dd>{serviceLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>Nhu cầu</dt>
            <dd>{need || 'Chưa ghi nhu cầu.'}</dd>
          </div>
          <div>
            <dt>Quyết định</dt>
            <dd>
              {discoveryBrief
                ? temperatureLabel(discoveryBrief.temperature) || discoveryBrief.temperature || '?'
                : DECISION_LABEL[session?.decision || ''] || session?.decision || '?'}
              {session?.bant_total != null ? ` · BANT ${session.bant_total}/30` : ''}
            </dd>
          </div>
        </dl>
        <ul className="solution-desk__bant">
          {BANT_KEYS.map((key) => {
            const score = Number(bant[key] ?? 0);
            return (
              <li key={key}>
                <div className="solution-desk__bant-top">
                  <strong>{BANT_FIELD_LABELS[key].label.split(' "')[0]}</strong>
                  <span>{score >= 1 ? `${score}/5` : 'Chưa chấm'}</span>
                </div>
                <p>{score >= 1 ? bantScoreText(key, score) : BANT_CHECKLIST[key].hint}</p>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Thao tác thất bại';
      const message = humanizeCrmApiError(undefined, raw);
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFiles(next: Attachment[], opts?: { trackProgress?: boolean }) {
    setFiles(next);
    const out = await patchLeadPresalesMarketingPlan(
      token,
      lead.id,
      { strategy_framework: { mkt_files: JSON.stringify(next) } },
      opts?.trackProgress
        ? {
            onUploadProgress: (percent) => {
              setUploadPhase('uploading');
              setUploadProgress(percent);
            },
          }
        : undefined,
    );
    if (out.funnel) onFunnelChange(out.funnel);
  }

  const canPack = handoff === 'with_solution';
  const packedReady = solutionPackReady(lines);

  function updateLine(code: string, patch: Partial<SolutionPackLine>) {
    setLines((current) => current.map((line) => (line.code === code ? { ...line, ...patch } : line)));
  }

  function downloadSolutionHtml(html: string) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Solution.html';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function packDocument() {
    if (!packedReady) throw new Error('Điền việc sẽ làm và kết quả khách nhận cho từng hạng mục.');
    const company = companyOnCard || sessionCompany || leadName || 'Quý khách';
    const html = buildSolutionDocumentHtml({
      company,
      service: serviceName || intakeServiceLabel(serviceSlug),
      owner: plain(lead.owner_name || '') || 'Người phụ trách',
      dateLabel: new Date().toLocaleDateString('vi-VN'),
      problem,
      approach,
      lines,
    });
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    const next = [
      ...files.filter((file) => file.name !== 'Solution.html'),
      buildUploadedAttachment({
        id: `solution-${Date.now()}`,
        name: 'Solution.html',
        mime: 'text/html',
        dataUrl,
        uploadedBy: userName,
      }),
    ];
    setFiles(next);
    const packed = await patchLeadPresalesMarketingPlan(token, lead.id, {
      strategy_framework: {
        mkt_files: JSON.stringify(next),
        solution_pack: JSON.stringify({ problem, approach, lines }),
      },
    });
    if (packed.funnel) onFunnelChange(packed.funnel);
    downloadSolutionHtml(html);
    onMessage?.('Đã đóng gói hồ sơ Solution.');
  }


  async function runAiSolution() {
    const out = await postLeadPresalesMarketingPlanAiDraft(token, lead.id);
    if (out.funnel) onFunnelChange(out.funnel);
    await load();
    const draft =
      presentSolutionAiDraft(out.plan) ??
      presentSolutionAiDraft((await fetchLeadPresalesMarketingPlan(token, lead.id).catch(() => null))?.plan);
    if (draft) setAiDraft(draft);
    const pending = out.ai?.status === 'pending' || draft?.status === 'pending';
    const note = pending
      ? SOLUTION_AI_PENDING_LABEL
      : out.validation?.ok
        ? SOLUTION_AI_DRAFT_LABEL
        : (out.validation?.messages?.filter(Boolean).join(' ') || 'AI đã tạo bản nháp — cần bổ sung thêm.');
    setAiResult(note);
    onMessage?.(note);
  }

  function updateAiSection(key: string, body: string) {
    setAiDraft((current) =>
      current
        ? { ...current, sections: current.sections.map((row) => (row.key === key ? { ...row, body } : row)) }
        : current,
    );
  }

  async function saveAiDraftSections() {
    if (!aiDraft || aiDraft.status === 'pending') return;
    const current = await fetchLeadPresalesMarketingPlan(token, lead.id);
    const plan = (current?.plan ?? {}) as Record<string, unknown>;
    const frameworkRaw = plan.strategy_framework ?? plan.strategy_framework_json;
    let framework: Record<string, unknown> = {};
    if (typeof frameworkRaw === 'string') {
      try {
        framework = JSON.parse(frameworkRaw) as Record<string, unknown>;
      } catch {
        framework = {};
      }
    } else if (frameworkRaw && typeof frameworkRaw === 'object' && !Array.isArray(frameworkRaw)) {
      framework = { ...(frameworkRaw as Record<string, unknown>) };
    }
    let packed: Record<string, unknown> = {};
    try {
      packed =
        typeof framework.solution_ai === 'string'
          ? (JSON.parse(framework.solution_ai) as Record<string, unknown>)
          : framework.solution_ai && typeof framework.solution_ai === 'object'
            ? { ...(framework.solution_ai as Record<string, unknown>) }
            : {};
    } catch {
      packed = {};
    }
    framework.solution_ai = JSON.stringify({
      ...packed,
      status: packed.status === 'pending' ? 'pending' : 'ready',
      source: packed.source ?? (aiDraft.source === 'agent' ? 'agent' : 'llm'),
      title: aiDraft.title,
      sections: Object.fromEntries(aiDraft.sections.map((row) => [row.key, row.body])),
    });
    await patchLeadPresalesMarketingPlan(token, lead.id, { strategy_framework: framework });
    await load();
  }

  const hasSolutionFile = files.some((file) => file.name.trim());
  const submitGaps =
    handoff === 'with_solution'
      ? solutionSubmitGaps({ lines, fileNames: files.map((file) => file.name) })
      : [];
  const uploading = uploadPhase !== 'idle' && uploadProgress != null;
  const uploadLabel =
    uploadPhase === 'reading'
      ? 'Đang đọc file…'
      : uploading
        ? `Đang tải file… ${uploadProgress}%`
        : null;
  const releaseDisabled = busy || notAssignee || !hasSolutionFile || submitGaps.length > 0 || uploading;
  const releaseReason = notAssignee
    ? notAssigneeTip
    : uploading
    ? (uploadLabel ?? 'Đang tải file…')
    : !hasSolutionFile
      ? 'Cần tải file Solution trước'
      : submitGaps.length > 0
        ? submitGaps.join(' ')
        : busy
          ? 'Đang xử lý…'
          : '';

  const filePicker = (
        <input
          ref={solutionFileInputRef}
          className="sr-only"
          type="file"
          aria-label="Chọn file Solution"
          data-testid="solution-desk-file"
          disabled={busy || !canEditFiles}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = '';
            if (!picked) return;
            void run(async () => {
              const currentTotal = files.reduce((sum, file) => {
                const comma = file.data_url.indexOf(',');
                const b64 = comma >= 0 ? file.data_url.slice(comma + 1) : '';
                return sum + Math.floor((b64.length * 3) / 4);
              }, 0);
              const blocked = solutionFileAddError(currentTotal, picked.size, files.length);
              if (blocked) throw new Error(blocked);
              setUploadPhase('reading');
              setUploadProgress(0);
              try {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onprogress = (progressEvent) => {
                    if (progressEvent.lengthComputable && progressEvent.total > 0) {
                      setUploadProgress(Math.min(99, Math.round((progressEvent.loaded / progressEvent.total) * 30)));
                    }
                  };
                  reader.onload = () => resolve(String(reader.result ?? ''));
                  reader.onerror = () => reject(new Error('Không đọc được file'));
                  reader.readAsDataURL(picked);
                });
                setUploadPhase('uploading');
                setUploadProgress(0);
                await saveFiles(
                  [
                    ...files,
                    buildUploadedAttachment({
                      name: picked.name,
                      mime: picked.type,
                      dataUrl,
                      size: picked.size,
                      uploadedBy: userName,
                    }),
                  ],
                  { trackProgress: true },
                );
                onMessage?.(`Đã tải ${picked.name}`);
              } finally {
                setUploadPhase('idle');
                setUploadProgress(null);
              }
            });
          }}
        />
  );

  const fileButtons = (
        <div className="solution-desk__file-row">
          <button
            type="button"
            className="ahd-btn ahd-btn--ghost"
            disabled={busy || !canEditFiles}
            onClick={() => solutionFileInputRef.current?.click()}
            data-testid="solution-desk-file-btn"
          >
            {uploadLabel ?? 'Chọn file'}
          </button>
          {canEditFiles ? (
            <button
              type="button"
              className="ahd-btn ahd-btn--ghost"
              disabled={busy || notAssignee}
              title={notAssignee ? notAssigneeTip : undefined}
              data-testid="solution-desk-ai"
              onClick={() => void run(runAiSolution)}
            >
              {busy ? 'Đang tạo Solution…' : 'AI tạo Solution'}
            </button>
          ) : null}
        </div>
  );

  const uploadBar = uploadLabel ? (
          <div
            className="solution-desk__upload-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress ?? 0}
            aria-label={uploadLabel}
            data-testid="solution-desk-upload-progress"
          >
            <p>{uploadLabel}</p>
            <div className="solution-desk__upload-bar">
              <span style={{ width: `${uploadPhase === 'reading' ? Math.max(uploadProgress ?? 0, 8) : uploadProgress ?? 0}%` }} />
            </div>
          </div>
        ) : null;

  const deadlineEditor = canEditDeadline ? (
        <div className="solution-desk__deadline" data-testid="solution-desk-deadline">
          <label>
            Deadline Solutions
            <input
              type="text"
              inputMode="numeric"
              lang="vi-VN"
              placeholder="dd/MM/yyyy"
              autoComplete="off"
              value={deadlineText}
              aria-label="Deadline Solutions (dd/MM/yyyy)"
              data-testid={actionsPanel ? 'ahd-deadline' : 'solution-desk-deadline-input'}
              onChange={(e) => {
                const v = e.target.value;
                setDeadlineText(v);
                const iso = viDateToIso(v);
                if (iso) setDeadlineIso(iso);
              }}
              onBlur={() => {
                const iso = viDateToIso(deadlineText) || deadlineIso;
                if (iso) {
                  setDeadlineIso(iso);
                  setDeadlineText(isoToViDate(iso));
                }
              }}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="ahd-btn ahd-btn--ghost ahd-btn--block"
            data-testid={actionsPanel ? 'ahd-deadline-save' : 'solution-desk-deadline-save'}
            disabled={busy || !deadlineIso}
            onClick={() =>
              void run(async () => {
                const out = await updateLeadSolutionDeadline(token, lead.id, deadlineIso);
                onFunnelChange(out.funnel);
                onMessage?.('Đã lưu Deadline Solutions.');
              })
            }
          >
            Lưu Deadline
          </button>
        </div>
      ) : storedDue ? (
        <p data-testid="solution-desk-deadline-view">Deadline Solutions: {isoToViDate(storedDue)}</p>
      ) : null;

  if (actionsPanel) {
    return (
      <section className="solution-desk solution-desk--actions" aria-label="Thao tác Solution" data-testid="solution-desk-actions">
        {error ? (
          <p className="lead-alert lead-alert--error" role="alert">
            {error}
          </p>
        ) : null}
        {deadlineEditor}
        {filePicker}
        {fileButtons}
        {uploadBar}
        {canSubmit ? (
          <div className="solution-desk__submit">
            <button
              type="button"
              className="ahd-btn ahd-btn--primary ahd-btn--block"
              data-testid="ahd-submit-sales"
              disabled={busy || submitBusy || notAssignee || Boolean(submitDisabledReason)}
              title={(notAssignee ? notAssigneeTip : submitDisabledReason) || undefined}
              aria-disabled={busy || submitBusy || notAssignee || Boolean(submitDisabledReason)}
              onClick={() => void onSubmitToSales?.()}
            >
              Nộp Solution cho Sales
            </button>
            {notAssignee || submitDisabledReason ? (
              <p className="ahd-assign-hint" data-testid="ahd-submit-hint">{notAssignee ? notAssigneeTip : submitDisabledReason}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  if (submitOnly) {
    return (
      <section className="solution-desk" aria-label="File Solution" data-testid="solution-desk-submit-only">
        {error ? (
          <p className="lead-alert lead-alert--error" role="alert">
            {error}
          </p>
        ) : null}
        {files.length === 0 ? (
          <p className="muted">Chưa có file Solution.</p>
        ) : (
          <SolutionFileList
            files={files}
            canEdit={canEditFiles}
            busy={busy}
            onRemove={(file) => void run(async () => saveFiles(files.filter((row) => row.id !== file.id)))}
          />
        )}
        {aiDraft ? (
          <SolutionAiDraftBody
            title={aiDraft.title}
            badge={aiDraft.badge}
            sections={aiDraft.sections}
            pending={aiDraft.status === 'pending'}
            canEdit={canEditFiles && aiDraft.status !== 'pending'}
            busy={busy}
            companyName={companyOnCard || sessionCompany || lead.company_name || leadName}
            contactName={leadName || sessionContact}
            leadCode={String(lead.id)}
            createdAt={aiDraft.requestedAt}
            onSectionChange={updateAiSection}
            onSave={() => void run(saveAiDraftSections)}
          />
        ) : aiResult ? (
          <p className="muted" data-testid="solution-desk-ai-result">
            {aiResult}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="solution-desk" aria-label="Hồ sơ Solution">
      <header className="solution-desk__head">
        <p className="solution-desk__kicker">Hồ sơ Sales đã giao</p>
        <p className="muted">
          {solution?.phase === 'cho_nhan'
            ? 'AM đang kiểm tra Brief và làm Solution.'
            : solution?.phase === 'chinh_sua'
              ? 'Chỉnh theo yêu cầu, rồi bấm Nộp Solution trước hạn.'
              : handoff === 'with_solution'
                ? 'Đóng gói và nộp Solution trước Deadline. Lead sẽ chuyển sang Chờ báo giá.'
                : 'Đã nộp Solution — Chờ báo giá.'}
        </p>
      </header>
      {solution ? (
        <SolutionClock
          label={solution.timer_label}
          dueAt={solution.timer_due_at}
          overdue={solution.timer_overdue}
          soon={solution.timer_warning}
        />
      ) : null}
      {canEditDeadline ? (
        <div className="solution-desk__deadline" data-testid="solution-desk-deadline">
          <label>
            Deadline Solutions
            <input
              type="text"
              inputMode="numeric"
              lang="vi-VN"
              placeholder="dd/MM/yyyy"
              autoComplete="off"
              value={deadlineText}
              aria-label="Deadline Solutions (dd/MM/yyyy)"
              data-testid={actionsPanel ? 'ahd-deadline' : 'solution-desk-deadline-input'}
              onChange={(e) => {
                const v = e.target.value;
                setDeadlineText(v);
                const iso = viDateToIso(v);
                if (iso) setDeadlineIso(iso);
              }}
              onBlur={() => {
                const iso = viDateToIso(deadlineText) || deadlineIso;
                if (iso) {
                  setDeadlineIso(iso);
                  setDeadlineText(isoToViDate(iso));
                }
              }}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid={actionsPanel ? 'ahd-deadline-save' : 'solution-desk-deadline-save'}
            disabled={busy || !deadlineIso}
            onClick={() =>
              void run(async () => {
                const out = await updateLeadSolutionDeadline(token, lead.id, deadlineIso);
                onFunnelChange(out.funnel);
                onMessage?.('Đã lưu Deadline Solutions.');
              })
            }
          >
            Lưu Deadline
          </button>
        </div>
      ) : storedDue ? (
        <p data-testid="solution-desk-deadline-view">Deadline Solutions: {isoToViDate(storedDue)}</p>
      ) : null}
      {solution?.revision_note ? (
        <p>
          <strong>Khách cần chỉnh:</strong> {solution.revision_note}
        </p>
      ) : null}
      {solution?.warning_note ? (
        <div className="lead-alert" role="status">
          {solution.warning_note}
        </div>
      ) : null}
      {solution?.sla_note ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {solution.sla_note}
        </div>
      ) : null}

      <div className="solution-desk__cols">
      <div className="solution-desk__col">

      <ActionErrorToast message={error} />

      <div className="solution-desk__block" data-testid="solution-sales-company">
        <h3>Công ty</h3>
        <dl className="solution-desk__facts">
          <div>
            <dt>Công ty</dt>
            <dd>{sessionCompany || companyOnCard || 'Chưa ghi tên công ty.'}</dd>
          </div>
          <div>
            <dt>Người liên hệ</dt>
            <dd>{sessionContact || leadName || '—'}</dd>
          </div>
          <div>
            <dt>Dịch vụ</dt>
            <dd>{serviceSlug ? intakeServiceLabel(serviceSlug) : '—'}</dd>
          </div>
          <div>
            <dt>Quyết định</dt>
            <dd>
              {discoveryBrief
                ? temperatureLabel(discoveryBrief.temperature) || discoveryBrief.temperature || '?'
                : DECISION_LABEL[session?.decision || ''] || session?.decision || '?'}
              {session?.decision_reason ? ` · ${session.decision_reason}` : ''}
            </dd>
          </div>
        </dl>
        {people.length > 0 ? (
          <ul>
            {people.map((row) => (
              <li key={`${row.role}-${row.name}`}>
                {row.role_label || row.role}: {row.name}
                {row.title ? ` · ${row.title}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="solution-desk__block" data-testid="solution-sales-needs">
        <h3>Nhu cầu</h3>
        <p>{need || 'Sales chưa ghi nhu cầu.'}</p>
        {discoveryBrief ? (
          <dl className="solution-desk__facts" data-testid="solution-discovery">
            {discoveryBrief.marketing_goal ? (<div><dt>Mục tiêu Marketing</dt><dd>{discoveryBrief.marketing_goal}</dd></div>) : null}
            {discoveryBrief.target_customers ? (<div><dt>KH mục tiêu</dt><dd>{discoveryBrief.target_customers}</dd></div>) : null}
            {discoveryBrief.region ? (<div><dt>Khu vực</dt><dd>{discoveryBrief.region}</dd></div>) : null}
            {discoveryBrief.flagship_product ? (<div><dt>Sản phẩm chủ lực</dt><dd>{discoveryBrief.flagship_product}</dd></div>) : null}
            {discoveryBrief.services?.length ? (<div><dt>Dịch vụ quan tâm</dt><dd>{discoveryServiceChips(discoveryBrief.services, serviceGroups).map((chip) => (chip.parent ? `${chip.parent} – ${chip.title}` : chip.title)).join(', ')}</dd></div>) : null}
          </dl>
        ) : null}
      </div>

      <div className="solution-desk__block" data-testid="solution-sales-items">
        <h3>Hạng mục</h3>
        {items.length === 0 ? (
          <p>Chưa chọn hạng mục.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.code}>
                <strong>{item.code}</strong>
                {item.label ? ` ${item.label}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="solution-desk__block" data-testid="solution-sales-current">
        <h3>Hiện trạng</h3>
        <p>
          {discoveryBrief?.current_results || (discoveryBrief?.channels?.length ? channelLabels(discoveryBrief.channels) : '') || crmField(session, 'current_state') ||
            crmField(session, 'current_situation') ||
            crmField(session, 'as_is') ||
            (winIntelLines(session).length === 0 && shownAnswers.length === 0
              ? 'Sales chưa ghi hiện trạng.'
              : '')}
        </p>
        {winIntelLines(session).map((row) => (
          <p key={row.label}>
            <strong>{row.label}:</strong> {row.answer}
          </p>
        ))}
        {shownAnswers.length > 0 ? (
          <ul className="solution-desk__answers">
            {shownAnswers.map((line) => (
              <li key={line.question}>
                <strong>{line.question}</strong>
                <span>{line.answer}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      </div>
      <div className="solution-desk__col">
      <div className="solution-desk__block" data-testid="solution-discovery-budget">
        <h3>{discoveryBrief ? 'Ngân sách / Thời điểm' : `Ngân sách / BANT ${session?.bant_total ?? 0}/30`}</h3>
        {discoveryBrief ? (
          <dl className="solution-desk__facts">
            <div><dt>Ngân sách</dt><dd>{budgetLabel(discoveryBrief.budget_band) || '?'}</dd></div>
            <div><dt>Thời điểm</dt><dd>{timelineLabel(discoveryBrief.timeline_band) || '?'}</dd></div>
            <div><dt>Kênh đang dùng</dt><dd>{channelLabels(discoveryBrief.channels) || '?'}</dd></div>
          </dl>
        ) : (
        <ul className="solution-desk__bant">
          {BANT_KEYS.map((key) => {
            const score = Number(bant[key] ?? 0);
            const said = answers.filter((line) => line.bantKey === key);
            return (
              <li key={key}>
                <div className="solution-desk__bant-top">
                  <strong>{BANT_FIELD_LABELS[key].label.split(' "')[0]}</strong>
                  <span>{score >= 1 ? `${score}/5` : 'Chưa chấm'}</span>
                </div>
                <p>{score >= 1 ? bantScoreText(key, score) : BANT_CHECKLIST[key].hint}</p>
                {said.map((line) => (
                  <p key={line.question}>Khách nói: {line.answer}</p>
                ))}
              </li>
            );
          })}
        </ul>
        )}
      </div>

      <div className="solution-desk__block" data-testid="solution-sales-notes">
        <h3>Ghi chú</h3>
        <p>
          {discoveryBrief?.call_notes || discoveryBrief?.difficulties || crmField(session, 'notes') ||
            crmField(session, 'sales_notes') ||
            crmField(session, 'note') ||
            discoveryNotes(session) ||
            redFlagNotes(session) ||
            'Không có ghi chú từ Sales.'}
        </p>
      </div>

      <div className="solution-desk__block" data-testid="solution-sales-actions">
        <h3>Việc cần làm</h3>
        {filledCommitments(session).length > 0 ? (
          <ul>
            {filledCommitments(session).map((row) => (
              <li key={row.label}>
                <strong>{row.label}</strong>
                {row.deadline ? ` · hạn ${row.deadline}` : ''}: {row.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {crmField(session, 'actions') ||
              crmField(session, 'next_actions') ||
              crmField(session, 'action') ||
              'Không có việc cần làm được ghi.'}
          </p>
        )}
      </div>

      <div className="solution-desk__submit">
        <h3>Nộp Solution cho Sales</h3>
        <p className="muted">PDF, Word, Excel hoặc ảnh. Tối đa 5 file, tổng dung lượng dưới 15MB.</p>
        <input
          ref={solutionFileInputRef}
          className="sr-only"
          type="file"
          aria-label="Chọn file Solution"
          data-testid="solution-desk-file"
          disabled={busy || !canEditFiles}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = '';
            if (!picked) return;
            void run(async () => {
              const currentTotal = files.reduce((sum, file) => {
                const comma = file.data_url.indexOf(',');
                const b64 = comma >= 0 ? file.data_url.slice(comma + 1) : '';
                return sum + Math.floor((b64.length * 3) / 4);
              }, 0);
              const blocked = solutionFileAddError(currentTotal, picked.size, files.length);
              if (blocked) throw new Error(blocked);
              setUploadPhase('reading');
              setUploadProgress(0);
              try {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onprogress = (event) => {
                    if (event.lengthComputable && event.total > 0) {
                      setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 30)));
                    }
                  };
                  reader.onload = () => resolve(String(reader.result ?? ''));
                  reader.onerror = () => reject(new Error('Không đọc được file'));
                  reader.readAsDataURL(picked);
                });
                setUploadPhase('uploading');
                setUploadProgress(0);
                await saveFiles(
                  [
                    ...files,
                    buildUploadedAttachment({
                      name: picked.name,
                      mime: picked.type,
                      dataUrl,
                      size: picked.size,
                      uploadedBy: userName,
                    }),
                  ],
                  { trackProgress: true },
                );
                onMessage?.(`Đã tải ${picked.name}`);
              } finally {
                setUploadPhase('idle');
                setUploadProgress(null);
              }
            });
          }}
        />
        <div className="solution-desk__file-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !canEditFiles}
            onClick={() => solutionFileInputRef.current?.click()}
            data-testid="solution-desk-file-btn"
          >
            {uploadLabel ?? 'Chọn file'}
          </button>
          {canEditFiles ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || notAssignee}
              title={notAssignee ? notAssigneeTip : undefined}
              data-testid="solution-desk-ai"
              onClick={() => void run(runAiSolution)}
            >
              {busy ? 'Đang tạo Solution…' : 'AI tạo Solution'}
            </button>
          ) : null}
        </div>
        {uploadLabel ? (
          <div
            className="solution-desk__upload-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress ?? 0}
            aria-label={uploadLabel}
            data-testid="solution-desk-upload-progress"
          >
            <p>{uploadLabel}</p>
            <div className="solution-desk__upload-bar">
              <span style={{ width: `${uploadPhase === 'reading' ? Math.max(uploadProgress ?? 0, 8) : uploadProgress ?? 0}%` }} />
            </div>
          </div>
        ) : null}
        {files.length === 0 && !uploadLabel ? (
          <p className="muted">Chưa có file Solution.</p>
        ) : files.length === 0 ? null : (
          <SolutionFileList
            files={files}
            canEdit={canEditFiles}
            busy={busy}
            onRemove={(file) => void run(async () => saveFiles(files.filter((row) => row.id !== file.id)))}
          />
        )}
        {aiDraft ? (
          <SolutionAiDraftBody
            title={aiDraft.title}
            badge={aiDraft.badge}
            sections={aiDraft.sections}
            pending={aiDraft.status === 'pending'}
            canEdit={canEditFiles && aiDraft.status !== 'pending'}
            busy={busy}
            companyName={companyOnCard || sessionCompany || lead.company_name || leadName}
            contactName={leadName || sessionContact}
            leadCode={String(lead.id)}
            createdAt={aiDraft.requestedAt}
            onSectionChange={updateAiSection}
            onSave={() => void run(saveAiDraftSections)}
          />
        ) : null}
        <div className="solution-desk__actions">
          {null}
          {handoff === 'with_solution' ? (
            <>
              {submitGaps.length > 0 ? (
                <ul className="solution-desk__gaps">
                  {submitGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : null}
              <div className="solution-desk__tra-sales-cluster">
              <span
                className="solution-desk__tra-sales-wrap"
                onClick={() => {
                  if (releaseDisabled && releaseReason) {
                    pushToast(releaseReason, 'error');
                  }
                }}
              >
              <button
                type="button"
                className="btn btn-primary"
                data-testid="solution-desk-tra-sales"
                disabled={releaseDisabled}
                aria-disabled={releaseDisabled}
                style={{ pointerEvents: releaseDisabled ? 'none' : undefined }}
                title={releaseReason || undefined}
                onClick={() =>
                  void run(async () => {
                    const out = await releaseLeadToSales(token, lead.id);
                    onFunnelChange(out.funnel);
                    onMessage?.('Đã nộp Solution. Lead chuyển sang Chờ báo giá.');
                    pushToast('Đã nộp Solution. Lead chuyển sang Chờ báo giá.', 'success');
                  })
                }
              >
                {uploading ? (uploadLabel ?? 'Đang tải file…') : 'Nộp Solution'}
              </button>
              </span>
              {releaseDisabled && releaseReason ? (
                <p className="muted solution-desk__disabled-reason" data-testid="solution-desk-disabled-reason">
                  {releaseReason}
                </p>
              ) : null}
              </div>
            </>
          ) : null}
          {handoff === 'with_solution' ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Thông tin Sales còn thiếu?');
                if (reason == null) return;
                if (reason.trim().length < 5) {
                  setError('Nhập lý do, ít nhất 5 ký tự');
                  return;
                }
                void run(async () => {
                  const out = await returnLeadToSales(token, lead.id, reason.trim());
                  onFunnelChange(out.funnel);
                  onMessage?.('Đã trả lại Sales');
                });
              }}
            >
              Trả lại — thiếu thông tin
            </button>
          ) : null}
        </div>
      </div>
      </div>
      </div>

      <section className="solution-pack" aria-label="Đóng gói Solution gửi khách">
        <h3>Đóng gói gửi khách</h3>
        <p className="muted">Viết như đang nói với khách. Tên và câu trong các ô này là chữ trên tài liệu gửi khách.</p>
        {lines.length === 0 ? (
          <p>Chưa có hạng mục để đóng gói.</p>
        ) : (
          <>
            <label>
              Vấn đề
              <textarea rows={2} value={problem} disabled={!canPack} onChange={(event) => setProblem(event.target.value)} />
            </label>
            <label>
              Hướng xử lý
              <textarea rows={2} value={approach} disabled={!canPack} onChange={(event) => setApproach(event.target.value)} />
            </label>
            {lines.map((line) => (
              <div className="solution-pack__line" key={line.code}>
                <p className="solution-pack__code">{line.code}</p>
                <label>
                  Tên trên tài liệu
                  <input
                    value={line.customerTitle}
                    disabled={!canPack}
                    onChange={(event) => updateLine(line.code, { customerTitle: event.target.value })}
                  />
                </label>
                <div className="solution-pack__grid">
                  <label>
                    Việc sẽ làm
                    <textarea
                      rows={2}
                      value={line.work}
                      disabled={!canPack}
                      onChange={(event) => updateLine(line.code, { work: event.target.value })}
                    />
                  </label>
                  <label>
                    Kết quả khách nhận
                    <textarea
                      rows={2}
                      value={line.result}
                      disabled={!canPack}
                      onChange={(event) => updateLine(line.code, { result: event.target.value })}
                    />
                  </label>
                  <label>
                    Thời gian
                    <input
                      value={line.timing}
                      disabled={!canPack}
                      onChange={(event) => updateLine(line.code, { timing: event.target.value })}
                    />
                  </label>
                  <label>
                    Không làm
                    <input
                      value={line.outOfScope}
                      disabled={!canPack}
                      onChange={(event) => updateLine(line.code, { outOfScope: event.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
            <div className="solution-desk__actions">
              <button type="button" className="btn btn-primary" disabled={!canPack || busy || !packedReady} onClick={() => void run(packDocument)}>
                Đóng gói Solution
              </button>
              {!canPack ? (
                <p className="muted">Nhận case trước khi đóng gói.</p>
              ) : !packedReady ? (
                <p className="muted">Điền Việc sẽ làm và Kết quả khách nhận cho từng hạng mục.</p>
              ) : null}
            </div>
          </>
        )}
      </section>
      <LeadInternalNotes
        token={token}
        leadId={lead.id}
        onMessage={onMessage}
        onError={onError}
        compact
        sectionTestId="scd-notes"
        inputTestId="scd-internal-input"
      />
    </section>
  );
}
