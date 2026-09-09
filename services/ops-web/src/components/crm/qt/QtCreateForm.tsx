'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchLead, fetchLeads } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { fetchAmAccounts } from '@/lib/crm/am-api';
import { LeadPartyCard, emptyLeadParty, type LeadPartyFormValue } from '@/components/crm/LeadPartyCard';
import { leadPartyClientLabel } from '@/lib/crm/lead-party.util';
import {
  createQtQuote,
  type QtCreateBody,
  type QtCreateSource,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';

export const QT_CREATE_SOURCES = [
  {
    id: 'lead' as const,
    label: 'Từ Lead / Deal Room',
    hint: 'Kế thừa khách, owner. Deep-link ?lead_id= từ Consult.',
    recommended: true,
  },
  {
    id: 'am360' as const,
    label: 'Từ AM 360',
    hint: 'Chọn khách đang active. Gắn lead sau nếu có.',
    recommended: false,
  },
  {
    id: 'blank' as const,
    label: 'Trống',
    hint: 'Chọn Lead hoặc khách AM 360. Không invent client.',
    recommended: false,
  },
];

export const QT_QUOTE_TYPES = [
  { id: 'new_business', label: 'New business' },
  { id: 'renewal', label: 'Renewal' },
  { id: 'upsell', label: 'Upsell' },
  { id: 'retainer', label: 'Retainer' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'project', label: 'Project' },
  { id: 'change_request', label: 'Change request' },
] as const;

export type QtLeadOption = {
  id: number;
  full_name: string;
  client_id?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_asset_id?: string | null;
};
export type QtClientOption = { agency_client_id: string; name: string };

export function prefillFromSearch(search: URLSearchParams): {
  source: QtCreateSource;
  leadId: string;
  customerId: string;
  agencyClientId: string;
} {
  const leadId = search.get('lead_id')?.trim() ?? '';
  const customerId = search.get('customer_id')?.trim() ?? '';
  const agencyClientId = search.get('agency_client_id')?.trim() ?? '';
  const source: QtCreateSource = leadId ? 'lead' : agencyClientId ? 'am360' : 'lead';
  return { source, leadId, customerId, agencyClientId };
}

export function resolveAgencyClientFromLead(input: {
  leadId: string;
  leads: QtLeadOption[];
  urlAgencyClientId: string;
}): string {
  const fromUrl = input.urlAgencyClientId.trim();
  if (fromUrl) return fromUrl;
  const lead = input.leads.find((row) => String(row.id) === input.leadId);
  return lead?.client_id?.trim() ?? '';
}

export function partyFromLeadOption(lead?: QtLeadOption | null): LeadPartyFormValue {
  return {
    company_name: String(lead?.company_name ?? ''),
    company_address: String(lead?.company_address ?? ''),
    phone: String(lead?.phone ?? ''),
    email: String(lead?.email ?? ''),
    logo_asset_id: String(lead?.logo_asset_id ?? ''),
    full_name: String(lead?.full_name ?? ''),
  };
}

export function buildQuoteCreateRequest(input: {
  source: QtCreateSource;
  leadId: string;
  agencyClientId: string;
  customerId: string;
  title: string;
  quoteType: string;
  idempotencyKey: string;
  party?: LeadPartyFormValue;
}): { headers: { 'Idempotency-Key': string }; body: QtCreateBody } {
  const body: QtCreateBody = {
    source: input.source,
    title: input.title.trim(),
    quote_type: input.quoteType,
  };
  const leadId = Number(input.leadId);
  if (Number.isFinite(leadId) && leadId > 0) body.lead_id = leadId;
  const client = input.agencyClientId.trim();
  if (client) body.agency_client_id = client;
  const customerId = Number(input.customerId);
  if (Number.isFinite(customerId) && customerId > 0) body.customer_id = customerId;
  if (input.source === 'lead' && input.party) {
    body.lead_party = {
      company_name: input.party.company_name,
      company_address: input.party.company_address,
      phone: input.party.phone,
      email: input.party.email,
      logo_asset_id: input.party.logo_asset_id || null,
    };
  }
  return {
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body,
  };
}

export function QtSourceCards({
  source,
  onChange,
}: {
  source: QtCreateSource;
  onChange: (source: QtCreateSource) => void;
}) {
  return (
    <div className="qt-grid3">
      {QT_CREATE_SOURCES.map((card) => (
        <button
          key={card.id}
          type="button"
          className={`qt-card qt-source${source === card.id ? ' qt-source--on' : ''}`}
          onClick={() => onChange(card.id)}
        >
          {card.recommended ? <span className="qt-pill qt-pill--info">Khuyến nghị</span> : null}
          <h3>{card.label}</h3>
          <p className="qt-muted">{card.hint}</p>
        </button>
      ))}
    </div>
  );
}

export function QtCreateFields({
  source,
  leadId,
  agencyClientId,
  customerId,
  title,
  quoteType,
  leads,
  clients,
  onLeadChange,
  onClientChange,
  onTitleChange,
  onQuoteTypeChange,
  party,
  onPartyChange,
}: {
  source: QtCreateSource;
  leadId: string;
  agencyClientId: string;
  customerId: string;
  title: string;
  quoteType: string;
  leads: QtLeadOption[];
  clients: QtClientOption[];
  onLeadChange: (leadId: string, clientId?: string | null) => void;
  onClientChange: (agencyClientId: string) => void;
  onTitleChange: (title: string) => void;
  onQuoteTypeChange: (quoteType: string) => void;
  party?: LeadPartyFormValue;
  onPartyChange?: (next: LeadPartyFormValue) => void;
}) {
  const leadOptions = [...leads];
  if (leadId && !leadOptions.some((lead) => String(lead.id) === leadId)) {
    leadOptions.unshift({ id: Number(leadId), full_name: `Lead ${leadId}` });
  }
  const clientOptions = [...clients];
  if (agencyClientId && !clientOptions.some((client) => client.agency_client_id === agencyClientId)) {
    clientOptions.unshift({ agency_client_id: agencyClientId, name: 'Khách đã chọn' });
  }
  const selectedLead = leadOptions.find((lead) => String(lead.id) === leadId);

  return (
    <div className="qt-create-fields">
    <div className="qt-grid2">
      <div className="qt-card qt-form">
        <label>
          Lead {source === 'lead' ? '*' : ''}
          <select
            className="qt-inp"
            name="lead_id"
            value={leadId}
            onChange={(event) => {
              const next = event.target.value;
              const lead = leadOptions.find((row) => String(row.id) === next);
              onLeadChange(next, lead?.client_id);
            }}
            required={source === 'lead'}
          >
            <option value="">Chọn lead</option>
            {leadOptions.map((lead) => (
              <option key={lead.id} value={String(lead.id)}>
                LD-{lead.id} · {lead.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {source === 'lead' ? 'Đã có trên AM 360 (upsell)' : 'Khách (AM 360) *'}
          <select
            className="qt-inp"
            name="agency_client_id"
            value={agencyClientId}
            onChange={(event) => onClientChange(event.target.value)}
            required={source !== 'lead'}
          >
            <option value="">{source === 'lead' ? 'Không — chỉ Lead' : 'Chọn khách'}</option>
            {clientOptions.map((client) => (
              <option key={client.agency_client_id} value={client.agency_client_id}>
                {client.name}
              </option>
            ))}
          </select>
          <span className="qt-muted">
            {source === 'lead'
              ? 'Không tạo khách mới tại đây. Chỉ chọn nếu khách đã có sổ AM 360.'
              : 'Chọn tên — không dán UUID'}
          </span>
        </label>
        <label>
          Tiêu đề *
          <input
            className="qt-inp"
            name="title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            required
          />
        </label>
        <label>
          Loại
          <select
            className="qt-inp"
            name="quote_type"
            value={quoteType}
            onChange={(event) => onQuoteTypeChange(event.target.value)}
          >
            {QT_QUOTE_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        {customerId ? <input type="hidden" name="customer_id" value={customerId} /> : null}
      </div>
      <section className="qt-card">
        <b>Prefill từ lead</b>
        <div className="qt-side-row">
          <span>Lead</span>
          <b>{selectedLead ? `LD-${selectedLead.id}` : dash(null)}</b>
        </div>
        <div className="qt-side-row">
          <span>Khách</span>
          <b>
            {clientOptions.find((client) => client.agency_client_id === agencyClientId)?.name ??
              leadPartyClientLabel({ company_name: party?.company_name ?? selectedLead?.company_name })}
          </b>
        </div>
        <div className="qt-side-row">
          <span>Entity phát hành</span>
          <b>PTT HCM</b>
        </div>
        <div className="qt-side-row">
          <span>Tiền tệ</span>
          <b>VND</b>
        </div>
        <div className="qt-side-row">
          <span>Mã sẽ cấp</span>
          <b>{dash(null)}</b>
        </div>
        <p className="qt-muted">Tạo = root + working v1. valid_until mặc định +30 ngày.</p>
      </section>
    </div>
      {source === 'lead' && party && onPartyChange ? (
        <LeadPartyCard
          leadId={Number(leadId) || undefined}
          value={party}
          onChange={onPartyChange}
        />
      ) : null}
    </div>
  );
}

export function QtCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const prefill = useMemo(() => prefillFromSearch(current), [current]);
  const [source, setSource] = useState<QtCreateSource>(prefill.source);
  const [leadId, setLeadId] = useState(prefill.leadId);
  const [agencyClientId, setAgencyClientId] = useState(prefill.agencyClientId);
  const [customerId, setCustomerId] = useState(prefill.customerId);
  const [title, setTitle] = useState('');
  const [quoteType, setQuoteType] = useState('new_business');
  const [leads, setLeads] = useState<QtLeadOption[]>([]);
  const [clients, setClients] = useState<QtClientOption[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [party, setParty] = useState<LeadPartyFormValue>(emptyLeadParty());

  useEffect(() => {
    setSource(prefill.source);
    setLeadId(prefill.leadId);
    setAgencyClientId(prefill.agencyClientId);
    setCustomerId(prefill.customerId);
  }, [prefill]);

  const loadOptions = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const [leadRes, accountRes] = await Promise.all([
        fetchLeads(token, { limit: 100 }),
        fetchAmAccounts(token, { page_size: '100' }),
      ]);
      setLeads(
        (leadRes.leads ?? []).map((lead) => ({
          id: lead.id,
          full_name: lead.full_name,
          client_id: lead.client_id,
          company_name: lead.company_name,
          company_address: lead.company_address,
          phone: lead.phone,
          email: lead.email,
          logo_asset_id: lead.logo_asset_id,
        })),
      );
      setClients(
        (accountRes.items ?? []).map((item) => ({
          agency_client_id: item.agency_client_id,
          name: item.name,
        })),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được lead / khách');
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const next = resolveAgencyClientFromLead({
      leadId,
      leads,
      urlAgencyClientId: prefill.agencyClientId,
    });
    if (next) setAgencyClientId(next);
  }, [leadId, leads, prefill.agencyClientId]);

  useEffect(() => {
    const selected = leads.find((row) => String(row.id) === leadId);
    if (selected) setParty(partyFromLeadOption(selected));
    const token = getAccessToken();
    const id = Number(leadId);
    if (!token || !Number.isFinite(id) || id <= 0) return;
    if (selected?.company_name) return;
    void fetchLead(token, id)
      .then((lead) => {
        setParty(partyFromLeadOption({
          id: lead.id,
          full_name: lead.full_name,
          client_id: lead.client_id,
          company_name: lead.company_name,
          company_address: lead.company_address,
          phone: lead.phone,
          email: lead.email,
          logo_asset_id: lead.logo_asset_id,
        }));
      })
      .catch(() => undefined);
  }, [leadId, leads]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `qt-${Date.now()}`;
      const req = buildQuoteCreateRequest({
        source,
        leadId,
        agencyClientId,
        customerId,
        title,
        quoteType,
        idempotencyKey,
        party,
      });
      const created = await createQtQuote(token, req.body, req.headers['Idempotency-Key']);
      router.push(`/crm/proposals/${created.proposal.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tạo được báo giá');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="qt-create" onSubmit={submit}>
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Tạo báo giá</p>
          <h1>Tạo báo giá</h1>
          <p className="qt-muted">NEW-01 · nguồn Lead / AM 360 / trống · chọn tên, không dán UUID</p>
        </div>
        <div className="qt-head__actions">
          <Link className="qt-btn" href="/crm/proposals/list">
            Hủy
          </Link>
          <button type="submit" className="qt-btn qt-btn--primary" disabled={saving}>
            Tạo nháp
          </button>
        </div>
      </header>

      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <QtSourceCards source={source} onChange={setSource} />
      <QtCreateFields
        source={source}
        leadId={leadId}
        agencyClientId={agencyClientId}
        customerId={customerId}
        title={title}
        quoteType={quoteType}
        leads={leads}
        clients={clients}
        onLeadChange={(next, clientId) => {
          setLeadId(next);
          if (clientId) setAgencyClientId(clientId);
          else if (source === 'lead') setAgencyClientId('');
        }}
        onClientChange={setAgencyClientId}
        onTitleChange={setTitle}
        onQuoteTypeChange={setQuoteType}
        party={party}
        onPartyChange={setParty}
      />
    </form>
  );
}
