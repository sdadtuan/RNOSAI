'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchDiscoveryOptions,
  fetchIntakeDefinitionBySlug,
  fetchIntakeSessions,
  type DiscoveryOptionsPayload,
  type IntakeSessionRow,
} from '@/lib/api';
import {
  normalizeIntakeMode,
  parseDiscoveryChecklist,
  parseDiscoveryResponses,
  questionItemsForMode,
} from '@/lib/crm/intake-discovery';
import {
  authorityLabel,
  budgetLabel,
  channelLabels,
  discoveryServiceChips,
  normalizeSalesDiscoveryBrief,
  optionLabel,
  prefillSalesDiscovery,
  readDiscoveryBriefFromAnswers,
  temperatureLabel,
  timelineLabel,
  type SalesDiscoveryBrief,
} from '@/lib/crm/sales-discovery';
import './sales-discovery.css';

function Value({ value }: { value: string }) {
  const text = String(value ?? '').trim();
  return <p className={`sd-readonly-value${text ? '' : ' is-empty'}`}>{text || '—'}</p>;
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`sd-field${wide ? ' sd-field--wide' : ''}`}>
      <span className="sd-label">{label}</span>
      <Value value={value} />
    </div>
  );
}

export function SalesDiscoveryBriefView({
  brief,
  options,
}: {
  brief: SalesDiscoveryBrief | null;
  options?: DiscoveryOptionsPayload | null;
}) {
  const chips = useMemo(
    () => (brief ? discoveryServiceChips(brief.services, options?.service_groups) : []),
    [brief, options],
  );
  if (!brief) {
    return <p className="muted">Chưa có Sales Brief.</p>;
  }
  const industry = optionLabel(options?.industries ?? [], brief.industry) || brief.industry;
  const jobTitle = optionLabel(options?.job_titles ?? [], brief.job_title) || brief.job_title;
  const authority = authorityLabel(brief.budget_authority);
  const budget = budgetLabel(brief.budget_band) || brief.budget_band;
  const timeline = timelineLabel(brief.timeline_band) || brief.timeline_band;
  const channels = channelLabels(brief.channels);
  const temp = temperatureLabel(brief.temperature);
  return (
    <div className="sd-page sd-page--embed sd-readonly" data-testid="sales-discovery-readonly">
      <section className="sd-section">
        <div className="sd-section__head">
          <h2 className="sd-section__title">A. Thông tin doanh nghiệp</h2>
        </div>
        <div className="sd-grid">
          <Field wide label="Tên DN / thương hiệu" value={brief.company_name} />
          <Field label="Ngành nghề" value={industry} />
          <Field label="Sản phẩm / dịch vụ chủ lực" value={brief.flagship_product} />
          <Field wide label="Website / Fanpage / TikTok" value={brief.websites} />
        </div>
      </section>
      <section className="sd-section">
        <div className="sd-section__head">
          <h2 className="sd-section__title">B. Người liên hệ</h2>
        </div>
        <div className="sd-grid">
          <Field label="Họ tên" value={brief.contact_name} />
          <Field label="SĐT" value={brief.phone} />
          <Field label="Email" value={brief.email} />
          <Field label="Chức vụ" value={jobTitle} />
          <Field wide label="Quyền quyết định ngân sách" value={authority} />
        </div>
      </section>
      <section className="sd-section">
        <div className="sd-section__head">
          <h2 className="sd-section__title">C. Nhu cầu Marketing</h2>
        </div>
        <div className="sd-field" style={{ marginBottom: 14 }}>
          <span className="sd-label">Dịch vụ khách hàng quan tâm</span>
          {chips.length ? (
            <div className="sd-picked">
              {chips.map((chip) => (
                <span className="sd-chip is-on" key={chip.slug} title={chip.title}>
                  {chip.parent ? `${chip.parent} · ${chip.title}` : chip.title}
                </span>
              ))}
            </div>
          ) : (
            <Value value="" />
          )}
        </div>
        <div className="sd-grid">
          <Field label="Vấn đề lớn nhất" value={brief.biggest_problem} />
          <Field label="Mục tiêu Marketing" value={brief.marketing_goal} />
          <Field label="Sản phẩm ưu tiên quảng bá" value={brief.priority_product} />
          <Field label="Khách hàng mục tiêu" value={brief.target_customers} />
          <Field label="Khu vực triển khai" value={brief.region} />
        </div>
      </section>
      <section className="sd-section">
        <div className="sd-section__head">
          <h2 className="sd-section__title">D. Hiện trạng Marketing</h2>
        </div>
        <div className="sd-grid">
          <Field wide label="Kênh muốn chạy và cách chốt đơn" value={channels} />
          <Field label="Kết quả Marketing hiện tại" value={brief.current_results} />
          <Field label="Khó khăn / nguyên nhân chưa hiệu quả" value={brief.difficulties} />
        </div>
      </section>
      <section className="sd-section">
        <div className="sd-section__head">
          <h2 className="sd-section__title">E. Ngân sách & thời điểm</h2>
        </div>
        <div className="sd-grid">
          <Field label="Ngân sách Marketing dự kiến" value={budget} />
          <Field label="Thời gian mong muốn triển khai" value={timeline} />
        </div>
      </section>
      <section className="sd-section">
        <div className="sd-section__head">
          <h2 className="sd-section__title">F. Ghi chú & mức độ sẵn sàng</h2>
        </div>
        <div className="sd-grid">
          <Field wide label="Ghi chú nội dung cuộc gọi" value={brief.call_notes} />
          <Field label="Mức độ sẵn sàng" value={temp} />
        </div>
      </section>
    </div>
  );
}

function pickSession(sessions: IntakeSessionRow[]): IntakeSessionRow | null {
  const completed = [...sessions].filter((row) => row.status === 'completed').sort((a, b) => b.id - a.id);
  const draft = [...sessions].filter((row) => row.status === 'draft').sort((a, b) => b.id - a.id);
  return completed[0] ?? draft[0] ?? sessions[0] ?? null;
}

export async function readSavedSalesBrief(token: string, session: IntakeSessionRow | null) {
  const savedBrief = readDiscoveryBriefFromAnswers(session?.answers_json);
  if (savedBrief || session?.status !== 'completed') return savedBrief;
  const mode = normalizeIntakeMode(session.mode);
  const definition = session.service_slug
    ? await fetchIntakeDefinitionBySlug(token, session.service_slug).catch(() => null)
    : null;
  const questions = questionItemsForMode(definition, mode);
  const checklist = parseDiscoveryChecklist(session.answers_json, mode, questions);
  const labels = new Map(questions.map(({ key, text }) => [key, text]));
  const responses = Object.entries(parseDiscoveryResponses(session.answers_json))
    .filter(([, response]) => response.answer.trim())
    .map(([key, response]) => `${labels.get(key) || key}: ${response.answer}`);
  const brief = prefillSalesDiscovery({ session });
  const crm = session.answers_json?.crm_fields as Record<string, unknown> | undefined;
  const saved = (key: string) => typeof crm?.[key] === 'string' ? String(crm[key]) : '';
  brief.marketing_goal = saved('goal');
  brief.target_customers = saved('target_audience');
  brief.budget_band = saved('budget_band');
  brief.timeline_band = saved('timeline_band');
  brief.region = saved('region');
  brief.industry = saved('industry');
  brief.flagship_product = saved('flagship_product');
  brief.priority_product = saved('priority_product');
  brief.difficulties = saved('difficulties');
  brief.websites = ['website', 'fanpage', 'tiktok'].map(saved).filter(Boolean).join('\n');
  brief.call_notes = [brief.call_notes || checklist.notes, ...responses].filter(Boolean).join('\n');
  return normalizeSalesDiscoveryBrief({ ...brief, budget_authority: saved('budget_authority') });
}

export function SalesDiscoveryReadOnlyPanel({
  token,
  leadId,
}: {
  token: string;
  leadId: number;
}) {
  const [brief, setBrief] = useState<SalesDiscoveryBrief | null>(null);
  const [options, setOptions] = useState<DiscoveryOptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void Promise.all([
      fetchIntakeSessions(token, { lead_id: leadId }),
      fetchDiscoveryOptions(token).catch(() => null),
    ]).then(async ([sessions, opts]) => {
      const session = pickSession(sessions);
      const saved = await readSavedSalesBrief(token, session);
      if (cancelled) return;
      setBrief(saved);
      setOptions(opts);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, leadId]);
  if (loading) return <p className="muted">Đang tải Sales Brief…</p>;
  if (error) return <p role="alert">Không tải được Sales Brief. Hãy tải lại trang.</p>;
  return <SalesDiscoveryBriefView brief={brief} options={options} />;
}
