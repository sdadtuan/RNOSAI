'use client';

import { Children, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  fetchDiscoveryOptions,
  fetchIntakeSessions,
  fetchLeadPresalesClientBrief,
  fetchLeadPresalesConsultBrief,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import {
  authorityLabel,
  discoveryIndustryLabel,
  temperatureLabel,
  readDiscoveryBriefFromAnswers,
  type DiscoveryOption,
  type SalesDiscoveryBrief,
} from '@/lib/crm/sales-discovery';
import {
  amDeskChecklist,
  focusDiscoveryChecklistItem,
  dash,
  formatHandoffStamp,
  resolveHandoffFlow,
  flowTimesFromFunnel,
} from '@/lib/crm/handoff-flow.util';
import { LeadInternalNotes } from '@/components/crm/LeadInternalNotes';
import { HandoffFlowStepper } from '@/components/crm/am/HandoffFlowStepper';
import { HandoffSlaCountdown } from '@/components/crm/HandoffSlaCountdown';
import { pickHandoffSlaClockForStep } from '@/lib/crm/handoff-sla-current.util';
import {
  buildAmDeskBrief,
  checklistSourceFromMerged,
  hrefForUrl,
  hrefForTel,
  hrefForMailto,
  humanizeSource,
  isFilled,
  type AmDeskClientBriefLike,
  type AmDeskConsultLike,
} from '@/lib/crm/am-desk-data';
import '@/components/crm/am/am-handoff-desk.css';
import './sales-lead-desk.css';

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const I = {
  back: 'M15 19l-7-7 7-7',
  source: 'M4 7h16M4 12h10M4 17h16',
  created: 'M8 7V3m8 4V3M5 11h14M6 5h12a1 1 0 011 1v13a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1z',
  person: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  sent: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  phone: 'M6.5 3h3l1.5 4-2 1.5a12 12 0 006 6L17 13l4 1.5v3A16 16 0 016.5 3z',
  mail: 'M4 6h16v12H4V6zm0 0l8 7 8-7',
  brief: 'M4 19V5a1 1 0 011-1h9l6 6v9a1 1 0 01-1 1H5a1 1 0 01-1-1z',
  industry: 'M3 21h18M5 21V8l6-3 6 3v13M9 21v-6h6v6',
  pin: 'M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11zM12 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  link: 'M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.93M14 11a5 5 0 00-7.07 0L5.52 12.4a5 5 0 007.07 7.07L14 18.07',
  scale: 'M3 20h18M6 16V8m6 8V4m6 12v-6',
  model: 'M12 2l9 5v10l-9 5-9-5V7l9-5z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  check: 'M5 12l5 5L20 7',
  bolt: 'M13 2L4 14h7l-1 8 10-13h-7l0-7z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Field({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  const empty = !isFilled(value) || value === '—';
  if (empty) return null;
  const link = href || hrefForUrl(value);
  return (
    <div>
      <Icon d={icon} />
      <dd>
        <span className="ahd-k">{label}: </span>
        {link ? (
          <a
            className="ahd-link"
            href={link}
            {...(/^https?:/i.test(link) ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )}
      </dd>
    </div>
  );
}

function EmptyState({ text = 'Chưa có dữ liệu.' }: { text?: string }) {
  return <p className="ahd-empty-state">{text}</p>;
}

function FieldList({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  if (!items.length) return <EmptyState />;
  return <dl className="ahd-dl">{items}</dl>;
}

type PartyLike = {
  company_name?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  job_title?: string;
  industry?: string;
  address?: string;
  logo_url?: string;
  logo?: string;
} | null;

export type SalesLeadDeskProps = {
  token: string;
  lead: LeadRow;
  party?: PartyLike;
  funnel: LeadFunnelSnapshot | null;
  userName?: string;
  salesViewer?: boolean;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onBack?: () => void;
  children?: ReactNode;
};

function salesNextAction(
  currentKey: string,
  submitted: boolean,
  returned: boolean,
): { title: string; body: string; cta?: 'submit' | 'complete' } {
  if (returned) {
    return {
      title: 'AM trả về Sales',
      body: 'Bổ sung thông tin Pre Sale theo lý do trả về, rồi Submit to AM lại.',
      cta: 'submit',
    };
  }
  if (!submitted && (currentKey === 'sales_brief' || !currentKey)) {
    return {
      title: 'Hoàn thiện Sales Discovery',
      body: 'Điền hết các trường bắt buộc trong form, rồi bấm Submit to AM để chuyển lead sang Chờ Solutions.',
      cta: 'submit',
    };
  }
  if (currentKey === 'await_solutions') {
    return {
      title: 'Đã gửi AM',
      body: 'Lead đang ở Chờ Solutions. AM sẽ kiểm tra brief và giao cho Marketing.',
    };
  }
  if (currentKey === 'doing_solutions') {
    return {
      title: 'Đang làm Solutions',
      body: 'Marketing đang làm Solutions — bạn chỉ xem. Khi xong, lead chuyển sang Chờ báo giá.',
    };
  }
  if (currentKey === 'receive_lead') {
    return {
      title: 'Tiếp nhận Lead',
      body: 'Nhận lead và bắt đầu Sales Discovery (Pre Sale).',
      cta: 'submit',
    };
  }
  if (currentKey === 'await_quote') {
    return {
      title: 'Chờ báo giá',
      body: 'Solution đã xong. Xem Solution, phản hồi khách, rồi bấm «Khách đồng ý — Chờ báo giá» để AM lập báo giá.',
    };
  }
  if (currentKey === 'negotiate') {
    return {
      title: 'Thương thảo',
      body: 'Báo giá đã có. Thương thảo với khách, xem và tải báo giá, cập nhật tiến độ chốt.',
    };
  }
  if (currentKey === 'sign_contract') {
    return {
      title: 'Ký hợp đồng',
      body: 'AM soạn hợp đồng. Sales xem và tải hợp đồng; hoàn tất ký để chuyển sang triển khai.',
    };
  }
  return {
    title: 'Bước tiếp theo',
    body: submitted ? 'Theo dõi tiến độ trên thanh 7 bước.' : 'Hoàn thiện Sales Discovery, rồi Submit to AM.',
    cta: submitted ? undefined : 'submit',
  };
}

function goToDiscoverySubmit(checklist: { items: { key: string; ok: boolean }[]; allOk: boolean }) {
  if (checklist.allOk) {
    focusDiscoveryChecklistItem('ready', checklist.items, { preferSubmit: true });
    window.setTimeout(() => {
      const submit = document.querySelector<HTMLButtonElement>('[data-testid="sd-submit"]');
      if (submit) {
        submit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!submit.disabled) submit.click();
      }
    }, 80);
    return;
  }
  const first = checklist.items.find((item) => !item.ok);
  focusDiscoveryChecklistItem(first?.key || 'company', checklist.items);
}

export function SalesLeadDesk({
  token,
  lead,
  party,
  funnel,
  userName,
  salesViewer = true,
  onBack,
  children,
}: SalesLeadDeskProps) {
  const [session, setSession] = useState<IntakeSessionRow | null>(null);
  const [industryOptions, setIndustryOptions] = useState<DiscoveryOption[]>([]);
  const [consultPack, setConsultPack] = useState<AmDeskConsultLike | null>(null);
  const [clientPack, setClientPack] = useState<AmDeskClientBriefLike | null>(null);

  const brief: SalesDiscoveryBrief | null = useMemo(
    () => readDiscoveryBriefFromAnswers(session?.answers_json) ?? null,
    [session],
  );

  const view = useMemo(
    () =>
      buildAmDeskBrief({
        discovery: brief,
        lead,
        party,
        session,
        consult: consultPack,
        clientBrief: clientPack,
        presalesNotes: (funnel?.presales as { notes?: string } | null | undefined)?.notes,
        serviceSlug: (funnel?.presales as { service_slug?: string } | null | undefined)?.service_slug,
      }),
    [brief, lead, party, session, consultPack, clientPack, funnel],
  );

  const load = useCallback(async () => {
    const [sessions, consult, clientBrief] = await Promise.all([
      fetchIntakeSessions(token, { lead_id: lead.id }).catch(() => [] as IntakeSessionRow[]),
      fetchLeadPresalesConsultBrief(token, lead.id).catch(() => null),
      fetchLeadPresalesClientBrief(token, lead.id).catch(() => null),
    ]);
    const completed = [...sessions].filter((s) => s.status === 'completed').sort((a, b) => b.id - a.id);
    const draft = [...sessions].filter((s) => s.status === 'draft').sort((a, b) => b.id - a.id);
    setSession(completed[0] ?? draft[0] ?? sessions[0] ?? null);
    setConsultPack(consult && typeof consult === 'object' ? (consult as AmDeskConsultLike) : null);
    setClientPack(clientBrief && typeof clientBrief === 'object' ? (clientBrief as AmDeskClientBriefLike) : null);
  }, [token, lead.id]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load, funnel?.presales?.handoff?.status]);

  useEffect(() => {
    function onDiscoveryChanged() {
      void load().catch(() => undefined);
    }
    window.addEventListener('sld:discovery-changed', onDiscoveryChanged);
    return () => window.removeEventListener('sld:discovery-changed', onDiscoveryChanged);
  }, [load]);


  useEffect(() => {
    let cancelled = false;
    void fetchDiscoveryOptions(token)
      .then((opts) => {
        if (cancelled || !opts) return;
        const industries = (opts.industries ?? []) as DiscoveryOption[];
        if (industries.length) setIndustryOptions(industries);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handoff = funnel?.presales?.handoff;
  const submitted = session?.status === 'completed' || Boolean(handoff?.handed_off_at) || handoff?.status === 'pending' || handoff?.status === 'with_solution' || handoff?.status === 'released';
  const returned = handoff?.status === 'returned';
  const flow = resolveHandoffFlow({
    leadStatus: lead.status,
    leadCreatedAt: lead.created_at,
    leadReceivedAt: lead.received_at,
    handoffStatus: handoff?.status,
    quotePhase: funnel?.presales?.quote_case?.phase,
    hasContract: Boolean(lead.has_contract),
    discoverySubmitted: submitted,
    discoverySubmittedAt: session?.updated_at ?? handoff?.handed_off_at,
    returnedToSales: returned,
    ...flowTimesFromFunnel(funnel),
  });
  const checklist = amDeskChecklist(checklistSourceFromMerged(view), {
    legacyReady: view.isLegacy && submitted,
  });
  const salesName = dash((lead as { owner_name?: string }).owner_name || (salesViewer ? userName : ''));
  const amName = dash(
    (lead as { am_name?: string; account_manager_name?: string }).am_name ||
      (lead as { account_manager_name?: string }).account_manager_name ||
      (funnel?.presales as { am_name?: string } | null | undefined)?.am_name,
  );
  const temp = view.temperature;
  const tempLabel = temperatureLabel(temp) || temp;
  const source = humanizeSource(view.source) || dash(lead.source || lead.channel);
  const created = formatHandoffStamp(lead.created_at || lead.received_at);
  const sentAm = formatHandoffStamp(handoff?.handed_off_at);
  const company = view.company_name || party?.company_name || lead.company_name || lead.full_name || '';
  const leadCode = lead.project_code || `LD-${lead.id}`;
  const contactName = view.contact_name;
  const phone = view.phone || lead.phone || '';
  const next = salesNextAction(flow.currentKey, submitted, returned);
  const fanpage = view.fanpage;
  const tiktok = view.tiktok;
  const site = view.website;

  return (
    <div className="ahd sld" data-testid="sales-lead-desk">
      <nav className="ahd-crumb" aria-label="breadcrumb">
        <Link href="/crm/leads">CRM</Link>
        <span className="ahd-crumb__sep">›</span>
        <Link href="/crm/leads">Leads</Link>
        <span className="ahd-crumb__sep">›</span>
        <span className="ahd-crumb__now">{leadCode}</span>
      </nav>

      <header className="ahd-head">
        <div className="ahd-head__left">
          <button
            type="button"
            className="ahd-back"
            aria-label="Quay lại"
            data-testid="sld-back"
            onClick={() => (onBack ? onBack() : window.history.back())}
          >
            <Icon d={I.back} size={18} />
          </button>
          <div>
            <div className="ahd-title-row">
              <h1 className="ahd-title">
                {leadCode} – {company}
              </h1>
              <span className="ahd-badge" data-testid="sld-status">
                {flow.currentLabel}
              </span>
            </div>
            <ul className="ahd-meta">
              <li>
                <Icon d={I.source} size={13} />
                Nguồn: <strong>{source}</strong>
              </li>
              <li>
                <Icon d={I.created} size={13} />
                Tạo: <strong>{created || '—'}</strong>
              </li>
              <li>
                <Icon d={I.person} size={13} />
                Phụ trách Sales: <strong>{salesName}</strong>
              </li>
              <li>
                <Icon d={I.sent} size={13} />
                Đã gửi AM: <strong>{sentAm || '—'}</strong>
              </li>
            </ul>
          </div>
        </div>
        <div className="ahd-head__actions">
          {phone ? (
            <a className="ahd-btn ahd-btn--ghost" href={`tel:${phone}`} data-testid="sld-call">
              <Icon d={I.phone} size={14} />
              Gọi khách
            </a>
          ) : null}
          {next.cta === 'submit' && !submitted ? (
            <button
              type="button"
              className="ahd-btn ahd-btn--primary"
              data-testid="sld-goto-submit"
              onClick={() => goToDiscoverySubmit(checklist)}
            >
              <Icon d={I.arrow} size={14} />
              Submit to AM
            </button>
          ) : null}
        </div>
      </header>

      <HandoffFlowStepper view={flow} sla={funnel?.presales?.handoff_sla ?? null} />
      <HandoffSlaCountdown clock={pickHandoffSlaClockForStep(funnel?.presales?.handoff_sla, flow.currentKey)} />

      <div className="ahd-body ahd-body--notes-only" data-side="notes">
        <div className="ahd-col">
          <section className="ahd-card" data-testid="sld-quick">
            <h3 className="ahd-card__title">
              <Icon d={I.brief} />
              Thông tin nhanh Lead
            </h3>
            <div className="ahd-brand">
              <div className="ahd-avatar">
                {party?.logo_url || (lead as { logo_url?: string }).logo_url || party?.logo ? (
                  <img
                    src={party?.logo_url || (lead as { logo_url?: string }).logo_url || party?.logo}
                    alt={String(company || lead.full_name || '')}
                  />
                ) : (
                  initials(String(company || lead.full_name || ''))
                )}
              </div>
              <p className="ahd-brand__name">{company}</p>
            </div>
            <FieldList>
              <Field icon={I.industry} label="Ngành nghề" value={discoveryIndustryLabel(view.industry, industryOptions) || view.industry} />
              <Field icon={I.pin} label="Địa bàn" value={view.region} />
              <Field icon={I.link} label="Website" value={site} href={hrefForUrl(site)} />
              <Field icon={I.link} label="Fanpage" value={fanpage} href={hrefForUrl(fanpage)} />
              <Field icon={I.link} label="TikTok" value={tiktok} href={hrefForUrl(tiktok)} />
              <Field icon={I.scale} label="Quy mô" value={view.scale} />
              <Field icon={I.model} label="Mô hình" value={view.model} />
            </FieldList>
          </section>

          <section className="ahd-card" data-testid="sld-contact">
            <h3 className="ahd-card__title">
              <Icon d={I.person} />
              Người liên hệ
            </h3>
            <FieldList>
              <Field icon={I.person} label="Họ tên" value={contactName} />
              <Field icon={I.brief} label="Chức vụ" value={view.job_title} />
              <Field icon={I.phone} label="Điện thoại" value={view.phone || phone} href={hrefForTel(view.phone || phone)} />
              <Field icon={I.mail} label="Email" value={view.email} href={hrefForMailto(view.email)} />
              <Field icon={I.shield} label="Quyền quyết định" value={view.budget_authority ? authorityLabel(view.budget_authority) : ''} />
              <Field icon={I.person} label="Người duyệt ngân sách" value={view.budget_approver} />
            </FieldList>
          </section>

          <section className="ahd-card" data-testid="sld-mgmt">
            <h3 className="ahd-card__title">
              <Icon d={I.users} />
              Thông tin quản lý
            </h3>
            <div className="ahd-people">
              <div className="ahd-person">
                <span className="ahd-person__av">{initials(salesName === '—' ? 'S' : salesName)}</span>
                <span>
                  Sales phụ trách: <strong>{salesName}</strong>
                  {salesViewer ? <span className="ahd-you"> (Bạn)</span> : null}
                </span>
              </div>
              <div className="ahd-person">
                <span className="ahd-person__av">{initials(amName === '—' ? 'A' : amName)}</span>
                <span>
                  AM phụ trách: <strong>{amName}</strong>
                  {!salesViewer && amName !== '—' ? <span className="ahd-you"> (Bạn)</span> : null}
                </span>
              </div>
              {temp ? (
                <div className="ahd-person ahd-person--temp">
                  <span className="ahd-temp-row">
                    <span className="ahd-k">Mức độ</span>
                    <span className={`ahd-temp ahd-temp--${temp}`} data-testid="sld-temp" title={String(tempLabel || '')}>
                      {temp === 'hot' ? '🔥 ' : ''}
                      {tempLabel}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="ahd-col ahd-col--main">{children}</div>

        <div className="ahd-col ahd-col--side ahd-col--side-notes" data-testid="sld-side" data-side="notes">
          <LeadInternalNotes
            token={token}
            leadId={lead.id}
            compact
            onMessage={undefined}
            onError={undefined}
            sectionTestId="sld-notes"
            inputTestId="sld-internal-input"
          />
        </div>
      </div>
    </div>
  );
}

export function SalesOrLegacyLeadLayout({
  useDesk,
  token,
  lead,
  party,
  funnel,
  userName,
  salesViewer,
  onFunnelChange,
  onBack,
  children,
}: {
  useDesk: boolean;
  token?: string | null;
  lead?: LeadRow | null;
  party?: PartyLike;
  funnel?: LeadFunnelSnapshot | null;
  userName?: string;
  salesViewer?: boolean;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onBack?: () => void;
  children?: ReactNode;
}) {
  if (useDesk && token && lead) {
    return (
      <SalesLeadDesk
        token={token}
        lead={lead}
        party={party}
        funnel={funnel ?? null}
        userName={userName}
        salesViewer={salesViewer}
        onFunnelChange={onFunnelChange}
        onBack={onBack}
      >
        {children}
      </SalesLeadDesk>
    );
  }
  return <div className="lead-detail-layout">{children}</div>;
}