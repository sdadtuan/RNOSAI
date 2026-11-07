'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  claimLeadSolution,
  fetchIntakeDefinitionBySlug,
  fetchIntakeSessions,
  fetchLeadPresalesMarketingPlan,
  patchLeadPresalesMarketingPlan,
  releaseLeadToSales,
  returnLeadToSales,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import { BANT_KEYS, type BantKey } from '@/lib/crm/intake-bant';
import { BANT_CHECKLIST } from '@/lib/crm/intake-bant-checklist';
import { BANT_FIELD_LABELS } from '@/lib/crm/intake-labels';
import { intakeServiceLabel } from '@/lib/crm/intake-service-resolve';
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

const FILE_MAX_BYTES = 1_500_000;
const FILE_MAX_COUNT = 5;

type Attachment = { id: string; name: string; mime: string; data_url: string };

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
  const raw = plan?.strategy_framework_json ?? plan?.strategy_framework;
  let framework: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      framework = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      framework = {};
    }
  } else if (raw && typeof raw === 'object') {
    framework = raw as Record<string, unknown>;
  }
  const packed = String(framework.mkt_files ?? '');
  if (!packed.trim()) return [];
  try {
    const parsed = JSON.parse(packed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const file = row as Attachment;
      if (!file.name || !file.data_url) return [];
      return [file];
    });
  } catch {
    return [];
  }
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
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [dueMs]);
  if (!label || !Number.isFinite(dueMs)) return null;
  const remain = dueMs - now;
  const late = overdue || remain < 0;
  const abs = Math.abs(remain);
  const totalSeconds = Math.floor(abs / 1000);
  const clock = [Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  const tone = late ? 'quote-case-timer quote-case-timer--late' : soon ? 'quote-case-timer quote-case-timer--soon' : 'quote-case-timer';
  return (
    <p className={tone} aria-live="polite">
      <span>{label}</span>
      <strong>{remain < 0 ? `Quá hạn ${clock}` : `Còn ${clock}`}</strong>
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
}: {
  token: string;
  lead: LeadRow;
  party: LeadPartyFormValue;
  funnel: LeadFunnelSnapshot | null;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  filesOnly?: boolean;
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
  const handoff = funnel?.presales?.handoff?.status ?? '';
  const solution = funnel?.presales?.solution_case;
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
  }, [funnel?.presales?.presales.service_slug, lead.id, token]);

  useEffect(() => {
    void load().catch(() => setError('Không tải được hồ sơ Sales giao'));
  }, [load]);

  const need = intakeNeed(session);
  const leadName = plain(lead.full_name || '');
  const companyOnCard = plain(party.company_name || '');
  const sessionCompany = plain(session?.company_name || '');
  const sessionContact = plain(session?.contact_name || '');
  const showCompany = Boolean(sessionCompany && sessionCompany !== companyOnCard);
  const showContact = Boolean(sessionContact && sessionContact !== leadName);
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
        {files.length === 0 ? (
          <p className="muted">Chưa có file Solution.</p>
        ) : (
          <ul>
            {files.map((file) => (
              <li key={file.id}>
                <a href={file.data_url} download={file.name}>
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
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
              {DECISION_LABEL[session?.decision || ''] || session?.decision || '—'}
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
      const message = err instanceof Error ? err.message : 'Thao tác thất bại';
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFiles(next: Attachment[]) {
    setFiles(next);
    await patchLeadPresalesMarketingPlan(token, lead.id, {
      strategy_framework: { mkt_files: JSON.stringify(next) },
    });
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
      { id: `solution-${Date.now()}`, name: 'Solution.html', mime: 'text/html', data_url: dataUrl },
    ];
    setFiles(next);
    await patchLeadPresalesMarketingPlan(token, lead.id, {
      strategy_framework: {
        mkt_files: JSON.stringify(next),
        solution_pack: JSON.stringify({ problem, approach, lines }),
      },
    });
    downloadSolutionHtml(html);
    onMessage?.('Đã đóng gói Solution.html.');
  }

  const hasSolutionFile = files.some((file) => file.name.trim());
  const submitGaps =
    handoff === 'with_solution'
      ? solutionSubmitGaps({ lines, fileNames: files.map((file) => file.name) })
      : [];

  return (
    <section className="solution-desk" aria-label="Hồ sơ Solution">
      <header className="solution-desk__head">
        <p className="solution-desk__kicker">Hồ sơ Sales đã giao</p>
        <p className="muted">
          {solution?.phase === 'cho_nhan'
            ? `${solution.assignee_name || 'Marketing Leader'} bấm nhận case Solutions trong 15 phút.`
            : solution?.phase === 'chinh_sua'
              ? 'Chỉnh theo yêu cầu, rồi bấm Trả Sales trong 2 giờ.'
              : handoff === 'with_solution'
                ? 'Đóng gói Solution.html, rồi Trả Sales trong hạn làm việc.'
                : 'Đã nộp cho Sales.'}
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

      {error ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {error.includes('\n') ? (
            <ul>
              {error.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            error
          )}
        </div>
      ) : null}

      <dl className="solution-desk__facts">
        {showCompany ? (
          <div>
            <dt>Công ty</dt>
            <dd>{sessionCompany}</dd>
          </div>
        ) : null}
        {showContact ? (
          <div>
            <dt>Người khảo sát</dt>
            <dd>{sessionContact}</dd>
          </div>
        ) : null}
        <div>
          <dt>Dịch vụ</dt>
          <dd>{serviceSlug ? intakeServiceLabel(serviceSlug) : '—'}</dd>
        </div>
        <div>
          <dt>Quyết định</dt>
          <dd>
            {DECISION_LABEL[session?.decision || ''] || session?.decision || '—'}
            {session?.decision_reason ? ` · ${session.decision_reason}` : ''}
          </dd>
        </div>
      </dl>

      <div className="solution-desk__block">
        <h3>Nhu cầu / điểm đau</h3>
        <p>{need || 'Sales chưa ghi nhu cầu.'}</p>
      </div>

      <div className="solution-desk__block">
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

      {shownAnswers.length > 0 ? (
        <div className="solution-desk__block">
          <h3>Câu Sales đã hỏi</h3>
          <ul className="solution-desk__answers">
            {shownAnswers.map((line) => (
              <li key={line.question}>
                <strong>{line.question}</strong>
                <span>{line.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {people.length > 0 ? (
        <div className="solution-desk__block">
          <h3>Người liên quan</h3>
          <ul>
            {people.map((row) => (
              <li key={`${row.role}-${row.name}`}>
                {row.role_label || row.role}: {row.name}
                {row.title ? ` · ${row.title}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      </div>
      <div className="solution-desk__col">
      <div className="solution-desk__block">
        <h3>BANT {session?.bant_total ?? 0}/30</h3>
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
      </div>

      <div className="solution-desk__submit">
        <h3>Nộp Solution cho Sales</h3>
        <p className="muted">PDF, Word, Excel hoặc ảnh. Tối đa 5 file, mỗi file 1.5MB.</p>
        <input
          type="file"
          aria-label="Tải file Solution"
          disabled={busy || handoff !== 'with_solution'}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = '';
            if (!picked) return;
            void run(async () => {
              if (picked.size > FILE_MAX_BYTES) throw new Error('File lớn hơn 1.5MB');
              if (files.length >= FILE_MAX_COUNT) throw new Error('Tối đa 5 file');
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result ?? ''));
                reader.onerror = () => reject(new Error('Không đọc được file'));
                reader.readAsDataURL(picked);
              });
              await saveFiles([
                ...files,
                {
                  id: `${Date.now()}-${picked.name}`,
                  name: picked.name,
                  mime: picked.type || 'application/octet-stream',
                  data_url: dataUrl,
                },
              ]);
              onMessage?.(`Đã tải ${picked.name}`);
            });
          }}
        />
        {files.length === 0 ? (
          <p className="muted">Chưa có file Solution.</p>
        ) : (
          <ul>
            {files.map((file) => (
              <li key={file.id}>
                <a href={file.data_url} download={file.name}>
                  {file.name}
                </a>
                {handoff === 'with_solution' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={busy}
                    onClick={() => void run(async () => saveFiles(files.filter((row) => row.id !== file.id)))}
                  >
                    Gỡ
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="solution-desk__actions">
          {handoff === 'pending' ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const out = await claimLeadSolution(token, lead.id);
                  onFunnelChange(out.funnel);
                  onMessage?.('Đã nhận case');
                })
              }
            >
              Nhận case
            </button>
          ) : null}
          {handoff === 'with_solution' ? (
            <>
              {submitGaps.length > 0 ? (
                <ul className="solution-desk__gaps">
                  {submitGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !hasSolutionFile || submitGaps.length > 0}
                onClick={() =>
                  void run(async () => {
                    const out = await releaseLeadToSales(token, lead.id);
                    onFunnelChange(out.funnel);
                    onMessage?.('Đã trả Sales. Khách có 8 giờ để phản hồi.');
                  })
                }
              >
                Trả Sales
              </button>
            </>
          ) : null}
          {handoff === 'pending' || handoff === 'with_solution' ? (
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
    </section>
  );
}
