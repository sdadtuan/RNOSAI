'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLeads } from '@/lib/api';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import { fetchAmAccounts } from '@/lib/crm/am-api';
import {
  QtApiError,
  getQtProposal,
  getQtProposalLines,
  getQtQuoteCatalog,
  patchQtProposal,
  putQtLines,
  putQtPayments,
  recalculateQtVersion,
  type QtBuilderLine,
  type QtBuilderProposal,
  type QtCatalogItem,
  type QtPackageTier,
  type QtPaymentItem,
  type QtRecalcResult,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import {
  QtStickyCommercial,
  formatQtGm,
  formatQtVnd,
  type QtStickyMoney,
} from './QtStickyCommercial';

export const QT_BUILDER_TABS = [
  { id: 'context', label: 'Bối cảnh' },
  { id: 'options', label: 'Phương án' },
  { id: 'services', label: 'Dịch vụ' },
  { id: 'kpi', label: 'KPI' },
  { id: 'cost', label: 'Chi phí' },
  { id: 'terms', label: 'Điều khoản' },
  { id: 'history', label: 'Lịch sử' },
] as const;

export type QtBuilderTabId = (typeof QT_BUILDER_TABS)[number]['id'];

export const QT_SKU_TIERS: Array<{ id: QtPackageTier; label: string }> = [
  { id: 'basic', label: 'Cơ bản' },
  { id: 'standard', label: 'Tiêu chuẩn' },
  { id: 'premium', label: 'Chuyên sâu' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  in_review: 'Đang xem',
  pending_approval: 'Chờ phê duyệt',
  returned: 'Trả về',
  approved: 'Đã duyệt',
  sent: 'Đã gửi',
  viewed: 'Đã xem',
  negotiation: 'Thương lượng',
  accepted: 'Đã xác nhận',
  rejected: 'Từ chối',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  superseded: 'Thay thế',
  archived: 'Lưu trữ',
};

export const QT_DEFAULT_PAYMENTS: QtPaymentItem[] = [
  { pct_bps: 5000, milestone: 'Xác nhận đề xuất' },
  { pct_bps: 3000, milestone: 'Giữa kỳ' },
  { pct_bps: 2000, milestone: 'Nghiệm thu' },
];

export function qtStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function asBuilderTab(value: string | null | undefined): QtBuilderTabId {
  return QT_BUILDER_TABS.some((tab) => tab.id === value)
    ? (value as QtBuilderTabId)
    : 'context';
}

export function normalizeSkuTier(value: string | null | undefined): QtPackageTier {
  const raw = String(value ?? 'standard').trim().toLowerCase();
  if (raw === 'basic' || raw === 'coban') return 'basic';
  if (raw === 'premium' || raw === 'chuyensau' || raw === 'chuyên sâu') return 'premium';
  return 'standard';
}

export function remainderOnLast(items: QtPaymentItem[]): QtPaymentItem[] {
  if (!items.length) return QT_DEFAULT_PAYMENTS.map((row) => ({ ...row }));
  const next = items.map((row, index) => ({
    seq: index + 1,
    pct_bps: Number(row.pct_bps) || 0,
    milestone: row.milestone || `Đợt ${index + 1}`,
    amount_vnd: row.amount_vnd ?? null,
  }));
  const head = next.slice(0, -1).reduce((sum, row) => sum + row.pct_bps, 0);
  next[next.length - 1].pct_bps = 10000 - head;
  return next;
}

export function isQtWritable(
  status: string | null | undefined,
  versionState?: string | null,
): boolean {
  if (String(status ?? '').trim().toLowerCase() !== 'draft') return false;
  const state = String(versionState ?? 'working').trim().toLowerCase();
  return state === 'working';
}

export async function saveDraft(
  proposal: Pick<QtBuilderProposal, 'status' | 'current_version_state'> | null | undefined,
  write: () => Promise<unknown> | unknown,
): Promise<void> {
  if (!isQtWritable(proposal?.status, proposal?.current_version_state)) return;
  await write();
}

export function lineWritePayload(line: QtBuilderLine, hasFinance: boolean): QtBuilderLine {
  const payload: QtBuilderLine = {
    dv_code: line.dv_code,
    sku_code: line.sku_code ?? null,
    package_tier: normalizeSkuTier(line.package_tier),
    service_slug: line.service_slug,
    qty: line.qty && line.qty > 0 ? line.qty : 1,
    client_visible: line.client_visible !== false,
    catalog_snapshot_json: line.catalog_snapshot_json ?? undefined,
    final_price_vnd: line.final_price_vnd ?? undefined,
    unit_price_vnd: line.unit_price_vnd ?? undefined,
  };
  if (line.item_type) payload.item_type = line.item_type;
  const media = line.media_vnd ?? line.media_amount_vnd;
  if (media != null) payload.media_vnd = media;
  if (hasFinance) {
    if (line.cost_labor_vnd != null) payload.cost_labor_vnd = line.cost_labor_vnd;
    if (line.cost_outsource_vnd != null) payload.cost_outsource_vnd = line.cost_outsource_vnd;
    if (line.cost_other_vnd != null) payload.cost_other_vnd = line.cost_other_vnd;
  }
  return payload;
}

export function catalogDisplayName(item: QtCatalogItem): string {
  return String(item.name_vi || item.name || item.dv_code || '').trim();
}

export function canAddCatalogItem(item: QtCatalogItem): boolean {
  return item.can_add_to_client_quote === true && String(item.status ?? '').toLowerCase() !== 'draft';
}

function emptyMoney(): QtStickyMoney {
  return {
    fee_vnd: null,
    media_vnd: null,
    discount_vnd: null,
    tax_vnd: null,
    payable_vnd: null,
    nsr_vnd: null,
    gm_bps: null,
  };
}

function moneyFromRecalc(recalc: QtRecalcResult | null): QtStickyMoney {
  if (!recalc) return emptyMoney();
  return {
    fee_vnd: recalc.fee_vnd ?? null,
    media_vnd: recalc.media_vnd ?? null,
    discount_vnd: recalc.discount_vnd ?? null,
    tax_vnd: recalc.tax_vnd ?? null,
    payable_vnd: recalc.payable_vnd ?? null,
    nsr_vnd: recalc.nsr_vnd ?? null,
    gm_bps: recalc.gm_bps ?? null,
  };
}

export function QtBuilderChrome({
  title,
  quoteCode,
  status,
  tab,
  onTab,
  studioHref,
  onSave,
  saving,
}: {
  title: string;
  quoteCode: string | null;
  status: string;
  tab: QtBuilderTabId;
  onTab: (next: QtBuilderTabId) => void;
  studioHref?: string;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <header className="qt-head">
      <div>
        <p className="qt-crumb">
          Kinh doanh / Báo giá / Builder / {quoteCode || dash(null)}
        </p>
        <h1>{title || dash(null)}</h1>
        <p className="qt-muted">
          {quoteCode || dash(null)} ·{' '}
          <span className="qt-pill qt-pill--warn">{qtStatusLabel(status)}</span>
        </p>
      </div>
      <div className="qt-head__actions">
        {onSave ? (
          <button type="button" className="qt-btn" disabled={saving} onClick={onSave}>
            Lưu nháp
          </button>
        ) : null}
        {studioHref ? (
          <Link className="qt-btn" href={studioHref}>
            Xem Proposal
          </Link>
        ) : null}
        <Link className="qt-btn qt-btn--primary" href="/crm/proposals/approvals">
          Gửi phê duyệt
        </Link>
      </div>
      <nav className="qt-tabs" aria-label="Builder">
        {QT_BUILDER_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`qt-tab${tab === item.id ? ' qt-tab--on' : ''}`}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export function QtSkuPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (tier: QtPackageTier) => void;
  disabled?: boolean;
}) {
  const current = normalizeSkuTier(value);
  return (
    <div className="qt-sku">
      <span className="qt-muted">SKU 3 tầng (package_tier)</span>
      {QT_SKU_TIERS.map((tier) => (
        <button
          key={tier.id}
          type="button"
          className={`qt-sku__btn${current === tier.id ? ' qt-sku__btn--on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(tier.id)}
        >
          {tier.label}
        </button>
      ))}
    </div>
  );
}

export function QtCatalogAddCta({
  name,
  canAdd,
  reason = 'catalog_not_active',
  onAdd,
}: {
  name: string;
  canAdd: boolean;
  reason?: string;
  onAdd?: () => void;
}) {
  return (
    <div className="qt-catalog-add">
      <span>{name}</span>
      <button type="button" className="qt-btn" disabled={!canAdd} onClick={onAdd}>
        Thêm
      </button>
      {canAdd ? null : <span className="qt-muted">{reason}</span>}
    </div>
  );
}

export function QtOptionsChrome() {
  return (
    <section className="qt-card">
      <header className="qt-card__head">
        <b>Phương án</b>
        <span className="qt-muted">W1 · một phương án A</span>
      </header>
      <div className="qt-opt">
        <h3>A</h3>
        <p className="qt-empty">{dash(null)}</p>
      </div>
    </section>
  );
}

export function QtKpiChrome() {
  return (
    <section className="qt-card">
      <header className="qt-card__head">
        <b>KPI 3 lớp</b>
      </header>
      <div className="qt-table-wrap">
        <table className="qt-table">
          <thead>
            <tr>
              <th>Chỉ số</th>
              <th>Lớp</th>
              <th>Giá trị</th>
              <th>Nguồn</th>
              <th>Assumption</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="qt-empty" colSpan={5}>
                {dash(null)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function QtHistoryChrome({ versionN = 1 }: { versionN?: number }) {
  return (
    <section className="qt-card">
      <header className="qt-card__head">
        <b>Lịch sử</b>
      </header>
      <div className="qt-side-row">
        <span>v{versionN}</span>
        <b>working</b>
      </div>
    </section>
  );
}

function lineName(line: QtBuilderLine, catalog: QtCatalogItem[]): string {
  const snap = line.catalog_snapshot_json;
  const fromSnap = snap && typeof snap === 'object' ? String((snap as { name?: unknown }).name ?? '') : '';
  if (fromSnap) return fromSnap;
  const match = catalog.find((item) => item.dv_code === line.dv_code);
  return match ? catalogDisplayName(match) : line.dv_code;
}

function snapshotForAdd(item: QtCatalogItem, tier: QtPackageTier): Record<string, unknown> {
  const priced = item.package_tiers?.find((row) => row.tier === tier);
  return {
    ...(item.catalog_snapshot_json ?? {}),
    dv_code: item.dv_code,
    name: catalogDisplayName(item),
    status: item.status ?? 'active',
    package_tier: tier,
    rate: {
      suggested_vnd: priced?.suggested_vnd ?? null,
    },
  };
}

export function newFeeCatalogLine(item: QtCatalogItem): QtBuilderLine {
  const tier: QtPackageTier = 'standard';
  const priced = item.package_tiers?.find((row) => row.tier === tier);
  return {
    dv_code: item.dv_code,
    package_tier: tier,
    item_type: 'fee',
    qty: 1,
    client_visible: true,
    final_price_vnd: priced?.suggested_vnd ?? null,
    catalog_snapshot_json: snapshotForAdd(item, tier),
  };
}

export function QtContextFields({
  title,
  objective,
  audience,
  period,
  validUntil,
  writable,
  onTitleChange,
  onObjectiveChange,
  onAudienceChange,
  onPeriodChange,
  onValidUntilChange,
}: {
  title: string;
  objective: string;
  audience: string;
  period: string;
  validUntil: string;
  writable: boolean;
  onTitleChange: (value: string) => void;
  onObjectiveChange: (value: string) => void;
  onAudienceChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onValidUntilChange: (value: string) => void;
}) {
  return (
    <>
      <label className="qt-form-label">
        Tiêu đề
        <input
          className="qt-inp"
          value={title}
          disabled={!writable}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </label>
      <label className="qt-form-label">
        Mục tiêu
        <input
          className="qt-inp"
          value={objective}
          disabled={!writable}
          onChange={(e) => onObjectiveChange(e.target.value)}
        />
      </label>
      <label className="qt-form-label">
        Đối tượng
        <input
          className="qt-inp"
          value={audience}
          disabled={!writable}
          onChange={(e) => onAudienceChange(e.target.value)}
        />
      </label>
      <label className="qt-form-label">
        Thời gian
        <input
          className="qt-inp"
          value={period}
          disabled={!writable}
          onChange={(e) => onPeriodChange(e.target.value)}
        />
      </label>
      <label className="qt-form-label">
        Hiệu lực đến
        <input
          className="qt-inp"
          type="date"
          value={validUntil}
          disabled={!writable}
          onChange={(e) => onValidUntilChange(e.target.value)}
        />
      </label>
    </>
  );
}

export function QtBuilder() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const proposalId = Number(params?.id);
  const tab = asBuilderTab(searchParams.get('tab'));
  const user = getStoredUser();
  const hasFinance = hasCap(user, 'crm_quote.finance', 'view');

  const [proposal, setProposal] = useState<QtBuilderProposal | null>(null);
  const [lines, setLines] = useState<QtBuilderLine[]>([]);
  const [catalog, setCatalog] = useState<QtCatalogItem[]>([]);
  const [clientName, setClientName] = useState<string | null>(null);
  const [leadCode, setLeadCode] = useState<string | null>(null);
  const [money, setMoney] = useState<QtStickyMoney>(emptyMoney());
  const [payments, setPayments] = useState<QtPaymentItem[]>(QT_DEFAULT_PAYMENTS);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [audience, setAudience] = useState('');
  const [period, setPeriod] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const searchKey = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(searchKey), [searchKey]);

  const setTab = useCallback(
    (next: QtBuilderTabId) => {
      const paramsNext = new URLSearchParams(current);
      if (next === 'context') paramsNext.delete('tab');
      else paramsNext.set('tab', next);
      const qs = paramsNext.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [current, pathname, router],
  );

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !Number.isFinite(proposalId) || proposalId <= 0) return;
    setLoading(true);
    setError('');
    try {
      const noLines: QtBuilderLine[] = [];
      const emptyLineRes = { lines: noLines };
      const emptyCatalog: QtCatalogItem[] = [];
      const emptyAccounts = { items: [], total: 0, page: 1 };
      const emptyLeads = { leads: [] };
      const [detail, lineRes, catalogItems, accounts, leads] = await Promise.all([
        getQtProposal(token, proposalId),
        getQtProposalLines(token, proposalId).catch(() => emptyLineRes),
        getQtQuoteCatalog(token).catch(() => emptyCatalog),
        fetchAmAccounts(token, { page_size: '100' }).catch(() => emptyAccounts),
        fetchLeads(token, { limit: 100 }).catch(() => emptyLeads),
      ]);
      setProposal(detail);
      setTitle(String(detail.title ?? ''));
      setObjective(String(detail.objective ?? ''));
      setAudience(String(detail.audience ?? ''));
      setPeriod(String(detail.campaign_period ?? ''));
      setValidUntil(String(detail.valid_until ?? '').slice(0, 10));
      const nextLines = (lineRes.lines?.length ? lineRes.lines : detail.lines) ?? [];
      setLines(nextLines);
      setCatalog(catalogItems);
      const agencyId = detail.agency_client_id;
      const account = (accounts.items ?? []).find((row) => row.agency_client_id === agencyId);
      setClientName(account?.name ?? null);
      const lead = (leads.leads ?? []).find((row) => row.id === detail.lead_id);
      setLeadCode(detail.lead_id ? `LD-${detail.lead_id}` : lead ? `LD-${lead.id}` : null);

      const vid = detail.current_version_id;
      if (vid) {
        try {
          const recalc = await recalculateQtVersion(token, proposalId, vid, hasFinance);
          setMoney(moneyFromRecalc(recalc));
          if (recalc.payments?.length) {
            setPayments(
              recalc.payments.map((row) => ({
                pct_bps: row.pct_bps,
                amount_vnd: row.amount_vnd,
                milestone: row.milestone,
              })),
            );
          }
        } catch (caught) {
          if (caught instanceof QtApiError && caught.code === 'missing_cap') {
            setMoney((currentMoney) => ({ ...currentMoney, nsr_vnd: null, gm_bps: null }));
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được builder');
    } finally {
      setLoading(false);
    }
  }, [hasFinance, proposalId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistDraft() {
    if (!isQtWritable(proposal?.status, proposal?.current_version_state)) return;
    const token = getAccessToken();
    if (!token || !proposal) return;
    setSaving(true);
    setError('');
    try {
      const rowVersion = Number(proposal.row_version ?? 1);
      const patched = await patchQtProposal(
        token,
        proposalId,
        {
          title,
          objective,
          audience,
          campaign_period: period,
          valid_until: validUntil || null,
        },
        rowVersion,
      );
      setProposal((current) => ({ ...current, ...patched, id: proposalId }));
      if (lines.length) {
        const saved = await putQtLines(
          token,
          proposalId,
          lines.map((line) => lineWritePayload(line, hasFinance)),
        );
        setLines(saved.lines ?? lines);
      }
      const vid = patched.current_version_id || proposal.current_version_id;
      if (vid) {
        const normalized = remainderOnLast(payments);
        await putQtPayments(
          token,
          vid,
          normalized.map((row) => ({
            pct_bps: row.pct_bps,
            milestone: row.milestone,
            seq: row.seq,
          })),
        );
        try {
          const recalc = await recalculateQtVersion(token, proposalId, vid, hasFinance);
          setMoney(moneyFromRecalc(recalc));
          if (recalc.payments?.length) {
            setPayments(
              recalc.payments.map((row) => ({
                pct_bps: row.pct_bps,
                amount_vnd: row.amount_vnd,
                milestone: row.milestone,
              })),
            );
          } else {
            setPayments(normalized);
          }
        } catch (caught) {
          setPayments(normalized);
          if (caught instanceof QtApiError && caught.code === 'missing_cap') {
            setMoney((currentMoney) => ({ ...currentMoney, nsr_vnd: null, gm_bps: null }));
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được nháp');
    } finally {
      setSaving(false);
    }
  }

  async function persistLines(nextLines: QtBuilderLine[]) {
    setLines(nextLines);
    const token = getAccessToken();
    if (!token || !proposal || !isQtWritable(proposal.status, proposal.current_version_state)) return;
    try {
      const saved = await putQtLines(
        token,
        proposalId,
        nextLines.map((line) => lineWritePayload(line, hasFinance)),
      );
      setLines(saved.lines ?? nextLines);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được dòng');
    }
  }

  function changeSku(index: number, tier: QtPackageTier) {
    const next = lines.map((line, i) => {
      if (i !== index) return line;
      const item = catalog.find((row) => row.dv_code === line.dv_code);
      const priced = item?.package_tiers?.find((row) => row.tier === tier);
      return {
        ...line,
        package_tier: tier,
        final_price_vnd: priced?.suggested_vnd ?? line.final_price_vnd,
        catalog_snapshot_json: {
          ...(line.catalog_snapshot_json ?? {}),
          package_tier: tier,
          status: item?.status ?? (line.catalog_snapshot_json as { status?: string } | undefined)?.status,
          rate: { suggested_vnd: priced?.suggested_vnd ?? null },
        },
      };
    });
    void persistLines(next);
  }

  function addCatalog(item: QtCatalogItem) {
    if (!canAddCatalogItem(item)) return;
    void persistLines([...lines, newFeeCatalogLine(item)]);
  }

  const writable = isQtWritable(proposal?.status, proposal?.current_version_state);

  return (
    <div className="qt-builder">
      <QtBuilderChrome
        title={title}
        quoteCode={proposal?.quote_code ?? null}
        status={proposal?.status ?? 'draft'}
        tab={tab}
        onTab={setTab}
        studioHref={Number.isFinite(proposalId) ? `/crm/proposals/${proposalId}/studio` : undefined}
        onSave={writable ? () => void saveDraft(proposal, persistDraft) : undefined}
        saving={saving}
      />

      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
          <button type="button" className="qt-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : null}

      <div className="qt-builder__grid" aria-busy={loading}>
        <div>
          {tab === 'context' ? (
            <section className="qt-card">
              <header className="qt-card__head">
                <b>Khách hàng &amp; bối cảnh</b>
                <span className="qt-muted">SoR AM 360 · không đổi UUID tay</span>
              </header>
              <div className="qt-side-row">
                <span>Khách</span>
                <b>{clientName || dash(null)}</b>
              </div>
              <div className="qt-side-row">
                <span>Lead</span>
                <b>
                  {leadCode && proposal?.lead_id ? (
                    <Link className="qt-link" href={`/crm/leads/${proposal.lead_id}/deal-room`}>
                      {leadCode}
                    </Link>
                  ) : (
                    dash(null)
                  )}
                </b>
              </div>
              <QtContextFields
                title={title}
                objective={objective}
                audience={audience}
                period={period}
                validUntil={validUntil}
                writable={writable}
                onTitleChange={setTitle}
                onObjectiveChange={setObjective}
                onAudienceChange={setAudience}
                onPeriodChange={setPeriod}
                onValidUntilChange={setValidUntil}
              />
              <button
                type="button"
                className="qt-btn qt-btn--primary"
                disabled={!writable || saving}
                onClick={() => void saveDraft(proposal, persistDraft)}
              >
                Lưu nháp
              </button>
            </section>
          ) : null}

          {tab === 'options' ? <QtOptionsChrome /> : null}

          {tab === 'services' ? (
            <section className="qt-card">
              <header className="qt-card__head">
                <b>Dịch vụ &amp; SKU</b>
              </header>
              {lines.length ? (
                lines.map((line, index) => (
                  <article className="qt-svc" key={`${line.dv_code}-${index}`}>
                    <div className="qt-svc__h">
                      <div>
                        <h3>{lineName(line, catalog)}</h3>
                        <p className="qt-muted">{line.dv_code}</p>
                      </div>
                      <b>{formatQtVnd(line.final_price_vnd ?? null)}</b>
                    </div>
                    <QtSkuPicker
                      value={normalizeSkuTier(line.package_tier)}
                      disabled={!writable}
                      onChange={(tier) => changeSku(index, tier)}
                    />
                  </article>
                ))
              ) : (
                <p className="qt-empty">{dash(null)}</p>
              )}
              <div className="qt-catalog-list">
                {catalog.map((item) => (
                  <QtCatalogAddCta
                    key={item.dv_code}
                    name={catalogDisplayName(item)}
                    canAdd={writable && canAddCatalogItem(item)}
                    reason={canAddCatalogItem(item) ? undefined : 'catalog_not_active'}
                    onAdd={() => addCatalog(item)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {tab === 'kpi' ? <QtKpiChrome /> : null}

          {tab === 'cost' ? (
            <section className="qt-card">
              <header className="qt-card__head">
                <b>Chi phí &amp; margin</b>
              </header>
              {hasFinance ? (
                <>
                  <div className="qt-table-wrap">
                    <table className="qt-table">
                      <thead>
                        <tr>
                          <th>Line</th>
                          <th>Fee</th>
                          <th>Labor</th>
                          <th>Outsource</th>
                          <th>Tools</th>
                          <th>GM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.length ? (
                          lines.map((line, index) => (
                            <tr key={`${line.dv_code}-cost-${index}`}>
                              <td>{lineName(line, catalog)}</td>
                              <td>{formatQtVnd(line.final_price_vnd ?? null)}</td>
                              <td>{formatQtVnd(line.cost_labor_vnd ?? null)}</td>
                              <td>{formatQtVnd(line.cost_outsource_vnd ?? null)}</td>
                              <td>{formatQtVnd(line.cost_other_vnd ?? null)}</td>
                              <td>{dash(null)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="qt-empty" colSpan={6}>
                              {dash(null)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="qt-side-row">
                    <span>NSR</span>
                    <b>{formatQtVnd(money.nsr_vnd ?? null)}</b>
                  </div>
                  <div className="qt-side-row">
                    <span>Gross margin</span>
                    <b>{formatQtGm(money.gm_bps ?? null)}</b>
                  </div>
                </>
              ) : (
                <p className="qt-empty">{dash(null)}</p>
              )}
            </section>
          ) : null}

          {tab === 'terms' ? (
            <section className="qt-card">
              <header className="qt-card__head">
                <b>Điều khoản &amp; thanh toán</b>
                <span className="qt-muted">tổng % = 100</span>
              </header>
              <p className="qt-muted">
                Wording khách: <b>Xác nhận đề xuất</b>
              </p>
              <div className="qt-table-wrap">
                <table className="qt-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>%</th>
                      <th>Số tiền</th>
                      <th>Mốc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remainderOnLast(payments).map((row, index) => (
                      <tr key={`pay-${index}`}>
                        <td>{index + 1}</td>
                        <td>
                          <input
                            className="qt-inp"
                            type="number"
                            disabled={!writable}
                            value={row.pct_bps / 100}
                            onChange={(event) => {
                              const pct = Number(event.target.value);
                              const next = payments.map((item, i) =>
                                i === index
                                  ? { ...item, pct_bps: Math.round((Number.isFinite(pct) ? pct : 0) * 100) }
                                  : item,
                              );
                              setPayments(remainderOnLast(next));
                            }}
                          />
                        </td>
                        <td>{formatQtVnd(row.amount_vnd ?? null)}</td>
                        <td>
                          <input
                            className="qt-inp"
                            disabled={!writable}
                            value={row.milestone ?? ''}
                            onChange={(event) => {
                              const next = payments.map((item, i) =>
                                i === index ? { ...item, milestone: event.target.value } : item,
                              );
                              setPayments(next);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="qt-btn qt-btn--primary"
                disabled={!writable || saving}
                onClick={() => void saveDraft(proposal, persistDraft)}
              >
                Lưu nháp
              </button>
            </section>
          ) : null}

          {tab === 'history' ? <QtHistoryChrome versionN={1} /> : null}
        </div>

        <QtStickyCommercial
          money={hasFinance ? money : { ...money, nsr_vnd: null, gm_bps: null }}
          payments={payments}
          hasFinance={hasFinance}
          onEditPayments={() => setTab('terms')}
        />
      </div>
    </div>
  );
}
