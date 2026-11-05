'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  downloadGrowthExport,
  exportGrowthDocx,
  fetchGrowthExports,
  fetchGrowthSections,
  fetchStrategyPacks,
  generateStrategyDraft,
  saveGrowthSections,
  savePlanPackKeys,
  type GenerateDraftResponse,
  type GrowthExportResponse,
  type GrowthExportVersion,
  type StrategyPackRow,
} from '@/lib/crm/strategy-packs-api';

const TABS = [
  { id: 'north_star', label: 'North Star' },
  { id: 'research', label: 'Research / ICP / Journey' },
  { id: 'positioning', label: 'Positioning' },
  { id: 'offer', label: 'Offer / Channel / Content' },
  { id: 'ops', label: 'Ops / Retain' },
  { id: 'budget_90d', label: 'Budget' },
  { id: 'roadmap', label: 'Roadmap / Calendar' },
  { id: 'raci', label: 'RACI / Risks' },
  { id: 'finance_board', label: 'Finance' },
] as const;

const WARNING_VI: Record<string, string> = {
  north_star_missing: 'Chưa có north star',
  budget_90d_empty: 'Ngân sách 90 ngày còn trống',
  calendar_12w_empty: 'Lịch 12 tuần còn trống',
  raci_empty: 'Chưa có RACI',
  growth_sections_incomplete: 'Growth sections chưa đủ',
};

function badge(quality: unknown): { label: string; tone: string } {
  if (quality === 'known') return { label: 'Known', tone: '#166534' };
  if (quality === 'assumed') return { label: 'Assumed', tone: '#92400e' };
  return { label: 'TBD', tone: '#4b5563' };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function GrowthSectionsPanel({
  token,
  planId,
  canEdit,
}: {
  token: string;
  planId: number;
  canEdit: boolean;
}) {
  const [industry, setIndustry] = useState<StrategyPackRow[]>([]);
  const [service, setService] = useState<StrategyPackRow[]>([]);
  const [sections, setSections] = useState<Record<string, unknown> | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('north_star');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('');
  const [quality, setQuality] = useState('tbd');
  const [source, setSource] = useState('');
  const [targetText, setTargetText] = useState('');
  const [overwriteMode, setOverwriteMode] = useState<'fill_empty_only' | 'refresh_assumed' | 'replace_all_ai'>(
    'fill_empty_only',
  );
  const [preview, setPreview] = useState<GenerateDraftResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportPreview, setExportPreview] = useState<GrowthExportResponse | null>(null);
  const [exporting, setExporting] = useState(false);
  const [versions, setVersions] = useState<GrowthExportVersion[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [packs, growth] = await Promise.all([
          fetchStrategyPacks(token),
          fetchGrowthSections(token, planId),
        ]);
        setIndustry(packs.industry_packs.filter((row) => row.is_active));
        setService(packs.service_packs.filter((row) => row.is_active));
        setSections(growth.growth_sections);
        setWarnings(growth.warnings);
        const listed = await fetchGrowthExports(token, planId).catch(() => ({ exports: [] }));
        setVersions(listed.exports);
        const star = asRecord(growth.growth_sections.north_star);
        setLabel(star.label == null ? '' : String(star.label));
        setQuality(String(star.quality ?? 'tbd'));
        setSource(star.source == null ? '' : String(star.source));
        setTargetText(star.target == null ? '' : String(star.target));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải growth sections');
      }
    })();
  }, [planId, token]);

  const industryKey = String(sections?.industry_pack_key ?? '');
  const serviceKey = String(sections?.service_pack_key ?? '');
  const starBadge = badge(quality);
  const slice = useMemo(() => {
    if (!sections) return null;
    if (tab === 'research') {
      return { research: sections.research, icp_segments: sections.icp_segments, journey: sections.journey };
    }
    if (tab === 'offer') {
      return {
        offer_ladder: sections.offer_ladder,
        channel_mix: sections.channel_mix,
        content_pillars: sections.content_pillars,
      };
    }
    if (tab === 'ops') return { ops_checklist: sections.ops_checklist, retain_journeys: sections.retain_journeys };
    if (tab === 'roadmap') return { roadmap_90d: sections.roadmap_90d, calendar_12w: sections.calendar_12w };
    if (tab === 'raci') return { raci: sections.raci, risks: sections.risks };
    return { [tab]: sections[tab] };
  }, [sections, tab]);

  async function onPack(kind: 'industry' | 'service', key: string) {
    if (!canEdit) return;
    setError('');
    try {
      const body = kind === 'industry' ? { industry_pack_key: key || null } : { service_pack_key: key || null };
      await savePlanPackKeys(token, planId, body);
      setSections((prev) => ({ ...(prev ?? {}), ...body }));
      setMessage('Đã lưu pack');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu pack thất bại');
    }
  }

  function applySections(next: Record<string, unknown>, nextWarnings: string[]) {
    setSections(next);
    setWarnings(nextWarnings);
    const star = asRecord(next.north_star);
    setLabel(star.label == null ? '' : String(star.label));
    setQuality(String(star.quality ?? 'tbd'));
    setSource(star.source == null ? '' : String(star.source));
    setTargetText(star.target == null ? '' : String(star.target));
  }

  async function onGeneratePreview() {
    if (!canEdit) return;
    setError('');
    setMessage('');
    setGenerating(true);
    try {
      const out = await generateStrategyDraft(token, planId, {
        industry_pack_key: industryKey || null,
        service_pack_key: serviceKey || null,
        overwrite_mode: overwriteMode,
        dry_run: true,
        persist: false,
      });
      setPreview(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không sinh được draft');
    } finally {
      setGenerating(false);
    }
  }

  async function onConfirmGenerate() {
    if (!canEdit || !preview) return;
    setError('');
    setGenerating(true);
    try {
      const out = await generateStrategyDraft(token, planId, {
        industry_pack_key: industryKey || null,
        service_pack_key: serviceKey || null,
        overwrite_mode: overwriteMode,
        dry_run: false,
        persist: true,
      });
      applySections(out.growth_sections, out.warnings);
      setPreview(null);
      setMessage('Đã ghi draft chiến lược');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không ghi được draft');
    } finally {
      setGenerating(false);
    }
  }

  async function onExportPreview() {
    if (!canEdit) return;
    setError('');
    setExporting(true);
    try {
      const out = await exportGrowthDocx(token, planId, { dry_run: true, persist: false, include_empty_tables: true });
      setExportPreview(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xuất được bản xem trước');
    } finally {
      setExporting(false);
    }
  }

  async function onConfirmExport() {
    if (!canEdit || !exportPreview) return;
    setError('');
    setExporting(true);
    try {
      const out = await exportGrowthDocx(token, planId, { dry_run: false, persist: true, include_empty_tables: true });
      setExportPreview(null);
      const listed = await fetchGrowthExports(token, planId);
      setVersions(listed.exports);
      if (out.export_id && out.filename) await downloadGrowthExport(token, planId, out.export_id, out.filename);
      setMessage('Đã xuất DOCX');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được DOCX');
    } finally {
      setExporting(false);
    }
  }

  async function onSaveStar() {
    if (!canEdit) return;
    setError('');
    setMessage('');
    const target = targetText.trim() === '' ? null : Number(targetText);
    if (targetText.trim() !== '' && !Number.isFinite(target)) {
      setError('Target phải để trống hoặc là số có nguồn');
      return;
    }
    try {
      const out = await saveGrowthSections(token, planId, {
        north_star: {
          label: label.trim() || null,
          quality,
          source: source.trim() || null,
          target,
        },
      });
      setSections(out.growth_sections);
      setWarnings(out.warnings);
      setMessage('Đã lưu north star');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  }

  if (!sections) return <p className="muted">Đang tải growth sections…</p>;

  return (
    <section style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
      <h3 style={{ margin: 0 }}>Growth sections</h3>
      {warnings.length ? (
        <p className="muted" style={{ margin: 0 }}>
          {warnings.map((code) => WARNING_VI[code] ?? code).join(' · ')}
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)', margin: 0 }}>{message}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span className="muted">Ngành</span>
          <select
            value={industryKey}
            disabled={!canEdit}
            onChange={(e) => void onPack('industry', e.target.value)}
          >
            <option value="">Chưa chọn</option>
            {industry.map((row) => (
              <option key={row.key} value={row.key}>
                {row.name_vi}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span className="muted">Gói dịch vụ</span>
          <select
            value={serviceKey}
            disabled={!canEdit}
            onChange={(e) => void onPack('service', e.target.value)}
          >
            <option value="">Chưa chọn</option>
            {service.map((row) => (
              <option key={row.key} value={row.key}>
                {row.name_vi}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span className="muted">Cách ghi draft</span>
          <select
            value={overwriteMode}
            disabled={!canEdit || generating}
            onChange={(e) =>
              setOverwriteMode(e.target.value as 'fill_empty_only' | 'refresh_assumed' | 'replace_all_ai')
            }
          >
            <option value="fill_empty_only">Chỉ điền ô trống</option>
            <option value="refresh_assumed">Ghi đè ô Assumed</option>
            <option value="replace_all_ai">Thay nội dung AI đã sinh</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!canEdit || generating}
          onClick={() => void onGeneratePreview()}
        >
          Sinh draft chiến lược
        </button>
      </div>
      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="generate-draft-title"
          style={{
            border: '1px solid var(--border, #d1d5db)',
            borderRadius: 8,
            padding: '0.85rem',
            display: 'grid',
            gap: '0.45rem',
          }}
        >
          <strong id="generate-draft-title">Xem trước draft</strong>
          <p style={{ margin: 0 }}>
            Known {preview.coverage.known.length} · Assumed {preview.coverage.assumed.length} · TBD{' '}
            {preview.coverage.tbd.length}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Pack {preview.industry_pack_key} / {preview.service_pack_key}
          </p>
          {overwriteMode === 'refresh_assumed' ? (
            <p style={{ margin: 0, color: '#92400e' }}>Xác nhận sẽ ghi đè các ô Assumed.</p>
          ) : null}
          <p className="muted" style={{ margin: 0 }}>
            TBD:{' '}
            {preview.coverage.tbd.slice(0, 8).join(', ') || 'không có'}
          </p>
          {preview.warnings.length ? (
            <p className="muted" style={{ margin: 0 }}>
              {preview.warnings.join(' · ')}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={generating}
              onClick={() => void onConfirmGenerate()}
            >
              Xác nhận ghi
            </button>
            <button type="button" className="btn btn-sm" disabled={generating} onClick={() => setPreview(null)}>
              Đóng
            </button>
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-sm" disabled={!canEdit || exporting} onClick={() => void onExportPreview()}>
          Xuất kế hoạch tăng trưởng (DOCX)
        </button>
        {versions.map((row) => (
          <button
            key={row.id}
            type="button"
            className="btn btn-sm"
            onClick={() => void downloadGrowthExport(token, planId, row.id, row.filename)}
          >
            v{row.version}
          </button>
        ))}
      </div>
      {exportPreview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-docx-title"
          style={{ border: '1px solid var(--border, #d1d5db)', borderRadius: 8, padding: '0.85rem', display: 'grid', gap: '0.45rem' }}
        >
          <strong id="export-docx-title">Xem trước DOCX</strong>
          <p style={{ margin: 0 }}>
            Known {exportPreview.coverage.known.length} · Assumed {exportPreview.coverage.assumed.length} · TBD{' '}
            {exportPreview.coverage.tbd.length}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {exportPreview.sections
              .filter((section) => section.missing.length)
              .slice(0, 4)
              .map((section) => `${section.title} ${section.fill_pct}%`)
              .join(' · ') || 'Các mục đã có nội dung'}
          </p>
          {exportPreview.warnings.length ? (
            <p className="muted" style={{ margin: 0 }}>
              {exportPreview.warnings.join(' · ')}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={exporting} onClick={() => void onConfirmExport()}>
              Xác nhận xuất
            </button>
            <button type="button" className="btn btn-sm" disabled={exporting} onClick={() => setExportPreview(null)}>
              Đóng
            </button>
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="btn btn-sm"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'north_star' ? (
        <div style={{ display: 'grid', gap: '0.55rem' }}>
          <span style={{ color: starBadge.tone, fontWeight: 700 }}>{starBadge.label}</span>
          <label>
            Nhãn
            <input value={label} disabled={!canEdit} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label>
            Chất lượng
            <select value={quality} disabled={!canEdit} onChange={(e) => setQuality(e.target.value)}>
              <option value="tbd">TBD</option>
              <option value="assumed">Assumed</option>
              <option value="known">Known</option>
            </select>
          </label>
          <label>
            Nguồn (bắt buộc nếu Known)
            <input value={source} disabled={!canEdit} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            Target (để trống = null, không phải 0)
            <input value={targetText} disabled={!canEdit} onChange={(e) => setTargetText(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary btn-sm" disabled={!canEdit} onClick={() => void onSaveStar()}>
            Lưu North Star
          </button>
        </div>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', margin: 0 }}>
          {JSON.stringify(slice, null, 2)}
        </pre>
      )}
    </section>
  );
}
