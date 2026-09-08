'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  getQtProposal,
  getQtStudioPreview,
  getQtVersions,
  patchQtStudioSections,
  publishQtVersion,
  type QtStudioPreview as QtStudioPreviewDto,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import { formatQtVnd } from './QtStickyCommercial';

export const QT_STUDIO_PUBLISH_REASON = 'version_not_approved';
export const QT_PUBLIC_ACCEPT_CTA = 'Xác nhận đề xuất';

export const QT_STUDIO_SECTIONS = [
  { id: 's01', label: '01 Cover & thương hiệu' },
  { id: 's02', label: '02 Bối cảnh & mục tiêu' },
  { id: 's03', label: '03 Chiến lược' },
  { id: 's04', label: '04 Phạm vi' },
  { id: 's05', label: '05 KPI & hiệu quả' },
  { id: 's06', label: '06 Timeline' },
  { id: 's07', label: '07 Đầu tư' },
  { id: 's08', label: '08 Điều khoản' },
  { id: 's09', label: '09 Xác nhận' },
] as const;

export type QtStudioSectionId = (typeof QT_STUDIO_SECTIONS)[number]['id'];

export type QtStudioPreview = QtStudioPreviewDto;

export function canPublishStudio(opts: {
  versionState?: string | null;
  section08: boolean;
  section09: boolean;
}): boolean {
  return opts.versionState === 'approved' && opts.section08 === true && opts.section09 === true;
}

export function studioPublishReason(opts: {
  versionState?: string | null;
  section08?: boolean;
  section09?: boolean;
}): string {
  if (opts.versionState !== 'approved') return QT_STUDIO_PUBLISH_REASON;
  if (opts.section08 === false || opts.section09 === false) return 'studio_gate';
  return '';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sectionFlagOn(sections: Record<string, unknown>, id: string): boolean {
  const row = sections[id] ?? sections[`s${id}`];
  if (row === true || row === 't' || row === 'true') return true;
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    const rec = row as Record<string, unknown>;
    return rec.on === true || rec.enabled === true;
  }
  return false;
}

export function hydrateStudioSections(input: unknown): { section08: boolean; section09: boolean } {
  const root = asRecord(input);
  const studio = asRecord(root.studio);
  const sections = asRecord(studio.sections ?? root.sections);
  return {
    section08: sectionFlagOn(sections, '08'),
    section09: sectionFlagOn(sections, '09'),
  };
}

export function studioSectionsForPublish(opts: {
  dirty: boolean;
  section08: boolean;
  section09: boolean;
}): Record<string, boolean> | null {
  if (!opts.dirty) return null;
  return { '08': opts.section08 === true, '09': opts.section09 === true };
}

export function pickPublicPreview(input: Record<string, unknown>): QtStudioPreview {
  const cta = input.cta && typeof input.cta === 'object' ? (input.cta as { accept?: string }) : {};
  const inv =
    input.investment && typeof input.investment === 'object'
      ? (input.investment as Record<string, unknown>)
      : {};
  const options = Array.isArray(input.options) ? input.options : [];
  return {
    quote_code: input.quote_code == null ? null : String(input.quote_code),
    title: String(input.title ?? ''),
    objective: String(input.objective ?? ''),
    audience: String(input.audience ?? ''),
    campaign_period: String(input.campaign_period ?? ''),
    valid_until: input.valid_until == null ? null : String(input.valid_until),
    version_n: Number(input.version_n ?? 0) || undefined,
    status: input.status == null ? undefined : String(input.status),
    kpis: Array.isArray(input.kpis) ? (input.kpis as QtStudioPreview['kpis']) : [],
    scope: Array.isArray(input.scope) ? (input.scope as QtStudioPreview['scope']) : [],
    investment: {
      fee_vnd: inv.fee_vnd == null ? null : Number(inv.fee_vnd),
      media_vnd: inv.media_vnd == null ? null : Number(inv.media_vnd),
      discount_vnd: inv.discount_vnd == null ? null : Number(inv.discount_vnd),
      tax_vnd: inv.tax_vnd == null ? null : Number(inv.tax_vnd),
      payable_vnd: inv.payable_vnd == null ? null : Number(inv.payable_vnd),
    },
    payments: Array.isArray(input.payments)
      ? (input.payments as QtStudioPreview['payments'])
      : [],
    options: options
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .filter((row) => row.client_visible !== false && row.client_visible !== 'f')
      .map((row) => ({
        option_key: String(row.option_key ?? ''),
        name: String(row.name ?? ''),
        recommended: row.recommended === true,
        client_visible: true,
        payable_vnd: row.payable_vnd == null ? null : Number(row.payable_vnd),
      })),
    option_key: input.option_key == null ? undefined : String(input.option_key),
    otp_required: input.otp_required === true,
    cta: { accept: cta.accept || QT_PUBLIC_ACCEPT_CTA },
  };
}

function emptyPreview(): QtStudioPreview {
  return pickPublicPreview({});
}

function sectionBody(id: QtStudioSectionId, preview: QtStudioPreview | null): React.ReactNode {
  const data = preview ?? emptyPreview();
  const cta = data.cta?.accept || QT_PUBLIC_ACCEPT_CTA;
  if (id === 's01') {
    return (
      <>
        <p>PTT HCM</p>
        <h3>{dash(data.title || null)}</h3>
        <p className="qt-muted">
          {dash(data.quote_code)}
          {data.valid_until ? ` · đến ${data.valid_until}` : ''}
        </p>
      </>
    );
  }
  if (id === 's02') return <p>{dash(data.objective || null)}</p>;
  if (id === 's03') {
    return (
      <>
        <p>{dash(data.audience || null)}</p>
        <p className="qt-muted">{dash(data.campaign_period || null)}</p>
      </>
    );
  }
  if (id === 's04') {
    if (!data.scope.length) return <p className="qt-empty">{dash(null)}</p>;
    return (
      <ul>
        {data.scope.map((item) => (
          <li key={`${item.dv_code}-${item.notes}`}>{item.notes || item.dv_code}</li>
        ))}
      </ul>
    );
  }
  if (id === 's05') {
    if (!data.kpis.length) return <p className="qt-empty">{dash(null)}</p>;
    return (
      <ul>
        {data.kpis.map((kpi, idx) => (
          <li key={`${kpi.label ?? 'kpi'}-${idx}`}>
            {dash(kpi.label)}
            {kpi.value ? `: ${kpi.value}` : ''}
          </li>
        ))}
      </ul>
    );
  }
  if (id === 's06') {
    if (!data.payments.length) return <p className="qt-empty">{dash(null)}</p>;
    return (
      <ul>
        {data.payments.map((pay) => (
          <li key={pay.seq}>
            {pay.milestone || `Đợt ${pay.seq}`} · {formatQtVnd(pay.amount_vnd)}
          </li>
        ))}
      </ul>
    );
  }
  if (id === 's07') {
    const inv = data.investment;
    return (
      <>
        <p>Phí dịch vụ · {formatQtVnd(inv?.fee_vnd)}</p>
        <p>Ngân sách media · {formatQtVnd(inv?.media_vnd)}</p>
        <p>Chiết khấu · {formatQtVnd(inv?.discount_vnd)}</p>
        <p>VAT · {formatQtVnd(inv?.tax_vnd)}</p>
        <p>
          <strong>Tổng · {formatQtVnd(inv?.payable_vnd)}</strong>
        </p>
      </>
    );
  }
  if (id === 's08') {
    return <p>Bật điều khoản trước khi xuất bản. Snapshot clause đi theo version.</p>;
  }
  return (
    <>
      <p>
        CTA khách: <b>{cta}</b>
      </p>
      <p className="qt-muted">Không phải hợp đồng pháp lý.</p>
    </>
  );
}

export function QtStudioChrome({
  active = 's01',
  quoteCode = null,
  quoteId = null,
  preview = null,
  versionState = null,
  section08 = false,
  section09 = false,
  onSelect,
  onSection08,
  onSection09,
  onPublish,
}: {
  active?: QtStudioSectionId;
  quoteCode?: string | null;
  quoteId?: string | null;
  preview?: QtStudioPreview | null;
  versionState?: string | null;
  section08?: boolean;
  section09?: boolean;
  onSelect?: (id: QtStudioSectionId) => void;
  onSection08?: (on: boolean) => void;
  onSection09?: (on: boolean) => void;
  onPublish?: () => void;
}) {
  const section = QT_STUDIO_SECTIONS.find((item) => item.id === active) ?? QT_STUDIO_SECTIONS[0];
  const reason = studioPublishReason({ versionState, section08, section09 });
  const canPublish = canPublishStudio({ versionState, section08, section09 });
  const client = preview ? pickPublicPreview(preview as Record<string, unknown>) : null;
  const cta = client?.cta?.accept || QT_PUBLIC_ACCEPT_CTA;

  return (
    <div className="qt-studio">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">
            Kinh doanh / Báo giá / Proposal Studio / {dash(quoteCode)}
          </p>
          <h1>Proposal Studio</h1>
          <p className="qt-muted">PRS-01 · 9 section · cấm cost/margin trên bản khách</p>
        </div>
        <div className="qt-head__actions">
          {quoteId ? (
            <Link className="qt-btn" href={`/crm/proposals/${quoteId}`}>
              Về builder
            </Link>
          ) : null}
          <button
            type="button"
            className="qt-btn qt-btn--primary"
            disabled={!canPublish}
            data-reason={reason || undefined}
            onClick={canPublish && onPublish ? () => onPublish() : undefined}
          >
            Xuất bản
          </button>
        </div>
      </header>
      {reason ? (
        <p className="qt-muted">
          Lý do: <code>{reason}</code>
        </p>
      ) : null}
      <div className="qt-studio__grid">
        <nav className="qt-studio__nav" aria-label="Section Studio">
          {QT_STUDIO_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`qt-tab${item.id === section.id ? ' qt-tab--on' : ''}`}
              onClick={onSelect ? () => onSelect(item.id) : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <section className="qt-card" data-section={section.id}>
          <h2>{section.label}</h2>
          {sectionBody(section.id, client)}
        </section>
        <aside className="qt-card">
          <b>Publish</b>
          <p className="qt-muted">Chỉ version approved còn hạn.</p>
          <p>
            <label className="qt-form-label">
              <input
                type="checkbox"
                checked={section08}
                data-section-toggle="08"
                onChange={onSection08 ? (event) => onSection08(event.target.checked) : undefined}
                readOnly={!onSection08}
              />{' '}
              08 Điều khoản
            </label>
          </p>
          <p>
            <label className="qt-form-label">
              <input
                type="checkbox"
                checked={section09}
                data-section-toggle="09"
                onChange={onSection09 ? (event) => onSection09(event.target.checked) : undefined}
                readOnly={!onSection09}
              />{' '}
              09 Xác nhận
            </label>
          </p>
          <div data-preview="client">
            <b>Xem trước khách</b>
            {client ? (
              <>
                <h3>{dash(client.title || null)}</h3>
                <p>{dash(client.objective || null)}</p>
                {client.scope.length ? (
                  <ul>
                    {client.scope.map((item) => (
                      <li key={`${item.dv_code}-${item.notes}`}>{item.notes || item.dv_code}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="qt-empty">{dash(null)}</p>
                )}
                <p>Phí dịch vụ · {formatQtVnd(client.investment.fee_vnd)}</p>
                <p>Ngân sách media · {formatQtVnd(client.investment.media_vnd)}</p>
                <p>Chiết khấu · {formatQtVnd(client.investment.discount_vnd)}</p>
                <p>VAT · {formatQtVnd(client.investment.tax_vnd)}</p>
                <p>
                  <strong>Tổng · {formatQtVnd(client.investment.payable_vnd)}</strong>
                </p>
                {(client.options ?? []).map((opt) => (
                  <p key={opt.option_key}>
                    {opt.option_key} · {opt.name}
                  </p>
                ))}
                <p>
                  <b>{cta}</b>
                </p>
              </>
            ) : (
              <p className="qt-empty">{dash(null)}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function QtStudio() {
  const params = useParams<{ id?: string }>();
  const quoteId = params?.id ?? null;
  const [active, setActive] = useState<QtStudioSectionId>('s01');
  const [quoteCode, setQuoteCode] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [versionState, setVersionState] = useState<string | null>(null);
  const [preview, setPreview] = useState<QtStudioPreview | null>(null);
  const [section08, setSection08] = useState(false);
  const [section09, setSection09] = useState(false);
  const [sectionsDirty, setSectionsDirty] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    const id = Number(quoteId);
    if (!token || !Number.isFinite(id) || id <= 0) return;
    setError('');
    try {
      const proposal = await getQtProposal(token, id);
      setQuoteCode(proposal.quote_code ?? null);
      const vid = proposal.current_version_id ?? null;
      setVersionId(vid);
      if (vid) {
        const versions = await getQtVersions(token, id).catch(() => ({ versions: [] }));
        const current = versions.versions.find((row) => row.id === vid);
        setVersionState(current?.state ?? proposal.current_version_state ?? proposal.status ?? null);
        const dto = await getQtStudioPreview(token, vid);
        setPreview(pickPublicPreview(dto as Record<string, unknown>));
        const flags = hydrateStudioSections(dto);
        setSection08(flags.section08);
        setSection09(flags.section09);
        setSectionsDirty(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được studio');
    }
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistSections(next08: boolean, next09: boolean) {
    const token = getAccessToken();
    if (!token || !versionId) return;
    const payload = studioSectionsForPublish({
      dirty: true,
      section08: next08,
      section09: next09,
    });
    if (!payload) return;
    await patchQtStudioSections(token, versionId, payload);
    setSectionsDirty(true);
  }

  async function publish() {
    const token = getAccessToken();
    if (!token || !versionId) return;
    setError('');
    try {
      const payload = studioSectionsForPublish({
        dirty: sectionsDirty,
        section08,
        section09,
      });
      if (payload) {
        await patchQtStudioSections(token, versionId, payload);
      }
      const dto = await publishQtVersion(token, versionId);
      setPreview(pickPublicPreview(dto as Record<string, unknown>));
      setVersionState('published');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không xuất bản được');
    }
  }

  return (
    <>
      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
        </section>
      ) : null}
      <QtStudioChrome
        active={active}
        quoteCode={quoteCode}
        quoteId={quoteId}
        preview={preview}
        versionState={versionState}
        section08={section08}
        section09={section09}
        onSelect={setActive}
        onSection08={(on) => {
          setSection08(on);
          void persistSections(on, section09);
        }}
        onSection09={(on) => {
          setSection09(on);
          void persistSections(section08, on);
        }}
        onPublish={() => void publish()}
      />
    </>
  );
}
