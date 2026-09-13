'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import {
  getCpImageDashboardKpis,
  getCpImageGovernanceAuditFeed,
  getCpImageProviderHealth,
  getCpImageSupplyChain,
  type CpImageAuditItem,
  type CpImageDashboardKpis,
  type CpImageProviderHealth,
  type CpImageSupplyChainRow,
} from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';
import { CpImageJobModal } from './CpImageJobModal';
import { CpImagePipe } from './CpImagePipe';

const EMPTY_KPIS: CpImageDashboardKpis = {
  approved_month: null,
  brief_to_approved_hours: null,
  cost_per_approved: null,
  first_pass_rate: null,
};

function healthPillClass(health: string): string {
  const lower = health.toLowerCase();
  if (lower.includes('ok') || lower.includes('healthy')) return 'cp-pill cp-pill--ok';
  if (lower.includes('partial') || lower.includes('hybrid') || lower.includes('warn')) {
    return 'cp-pill cp-pill--warn';
  }
  if (lower.includes('off') || lower.includes('block') || lower.includes('no')) {
    return 'cp-pill cp-pill--warn';
  }
  return 'cp-pill cp-pill--info';
}

export function CpImageHome() {
  const [kpis, setKpis] = useState<CpImageDashboardKpis>(EMPTY_KPIS);
  const [supply, setSupply] = useState<CpImageSupplyChainRow[]>([]);
  const [providers, setProviders] = useState<CpImageProviderHealth['providers']>([]);
  const [audit, setAudit] = useState<CpImageAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [kpiOut, supplyOut, healthOut, auditOut] = await Promise.all([
        getCpImageDashboardKpis(token).catch(() => ({ kpis: EMPTY_KPIS })),
        getCpImageSupplyChain(token).catch(() => ({ items: [] as CpImageSupplyChainRow[] })),
        getCpImageProviderHealth(token).catch(() => ({ providers: [] })),
        getCpImageGovernanceAuditFeed(token).catch(() => ({ items: [] as CpImageAuditItem[] })),
      ]);
      setKpis(kpiOut.kpis);
      setSupply(supplyOut.items);
      setProviders(healthOut.providers);
      setAudit(auditOut.items);
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">
            Vận hành / Sản xuất sáng tạo / Ảnh SOP / <b>Tổng quan</b>
          </p>
          <h1>Enterprise Image Intelligence</h1>
          <p className="cp-muted">Thắng đối thủ bằng recipe — không bằng một model.</p>
          <p className="cp-sot">
            GET /api/crm/cp/image/dashboard/kpis · GET /image/intents · img_job_stages
          </p>
        </div>
        <div className="cp-overview__actions">
          <button className="cp-btn" type="button" onClick={() => void load()}>
            ↻ Đồng bộ platform
          </button>
          <button className="cp-btn cp-btn--primary" type="button" onClick={() => setModalOpen(true)}>
            ＋ Tạo Image Job
          </button>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <section className="cp-img-win">
        <div>
          <h2>Winning Image Ops · v2.1</h2>
          <p>
            Đối thủ dừng ở Midjourney + Drive. PTT bàn giao <b>ảnh duyệt được</b>: đúng intent →
            đúng capability thật → chọn winner → upscale → pack đủ tỉ lệ → overlay logo/CTA official
            → QC tiếng Việt.
          </p>
        </div>
        <ol>
          <li>Intent trước, provider sau</li>
          <li>6 stage bắt buộc (GT-I10 / I11)</li>
          <li>Logo/CTA không tin model (GT-I09)</li>
          <li>Đo First-Pass + Cost/Approved</li>
        </ol>
      </section>

      <CpImagePipe activeStage="select" />
      <p className="cp-sot" style={{ margin: '-6px 0 12px' }}>
        GET /api/crm/cp/image/recipes/preview · capability allowlist Magnific đã ship
      </p>

      <div className="cp-img-tiles">
        <article className="cp-img-tile">
          <span>Asset đã duyệt (tháng)</span>
          <strong>{dash(kpis.approved_month)}</strong>
          <em>COUNT crm_cp_assets WHERE provenance image_sop + approved</em>
        </article>
        <article className="cp-img-tile">
          <span>Brief → Approved</span>
          <strong>{dash(kpis.brief_to_approved_hours)}</strong>
          <em>AVG(g3_at - created_at) img_projects</em>
        </article>
        <article className="cp-img-tile">
          <span>Cost / Approved Asset</span>
          <strong>{dash(kpis.cost_per_approved)}</strong>
          <em>ledger charge / approved count</em>
        </article>
        <article className="cp-img-tile">
          <span>First-Pass Approval</span>
          <strong>{dash(kpis.first_pass_rate)}</strong>
          <em>approved / explored · img_quality_results</em>
        </article>
      </div>

      <div className="cp-img-grid2">
        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Content Supply Chain</h2>
              <p>Pipeline theo campaign · provider · policy.</p>
            </div>
            <Link className="cp-btn" href="/crm/creative-os/image/jobs">
              Xem jobs
            </Link>
          </header>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Creative task</th>
                  <th>SOP / Provider</th>
                  <th>Tiến độ</th>
                  <th>Trạng thái</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {supply.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="cp-muted" style={{ textAlign: 'center', padding: 24 }}>
                      — · Empty state
                    </td>
                  </tr>
                ) : (
                  supply.map((row) => (
                    <tr key={row.title}>
                      <td>
                        <b>{row.title}</b>
                        {row.subtitle ? <span className="cp-muted cp-table__sub">{row.subtitle}</span> : null}
                      </td>
                      <td>
                        {row.sop_label ? <span className="cp-pill cp-pill--purple">{row.sop_label}</span> : dash(null)}
                        {row.sop_detail ? (
                          <span className="cp-muted cp-table__sub">{row.sop_detail}</span>
                        ) : null}
                      </td>
                      <td>
                        {row.progress_pct != null ? (
                          <div className="cp-progress">
                            <i style={{ width: `${row.progress_pct}%` }} />
                          </div>
                        ) : null}
                        {row.progress_note ? (
                          <span className="cp-muted cp-table__sub">{row.progress_note}</span>
                        ) : (
                          dash(null)
                        )}
                      </td>
                      <td>
                        <span className="cp-pill cp-pill--info">{dash(row.status)}</span>
                      </td>
                      <td>{dash(row.sla)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Provider &amp; worker health</h2>
              <p>Trạng thái thật từ API.</p>
            </div>
            <span className="cp-pill cp-pill--warn">Partial</span>
          </header>
          <div className="cp-img-health">
            {providers.length === 0 ? (
              <p className="cp-muted">—</p>
            ) : (
              providers.map((row) => (
                <div key={row.id} className="cp-img-healthrow">
                  <div className="cp-img-hicon">{row.label.slice(0, 1)}</div>
                  <div>
                    <b>{row.label}</b>
                    <p>{row.detail ?? dash(null)}</p>
                  </div>
                  <span className={healthPillClass(row.health)}>{row.health}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="cp-img-grid2">
        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Approved output</h2>
              <p>Biểu đồ khi module ship — hiện placeholder.</p>
            </div>
          </header>
          <div className="cp-img-bars">
            {Array.from({ length: 8 }).map((_, index) => (
              <i key={index} style={{ height: '20%' }} />
            ))}
          </div>
          <p className="cp-muted" style={{ fontSize: 10, textAlign: 'center' }}>
            — · chưa có time-series · GROUP BY date_trunc(&apos;day&apos;, g3_at)
          </p>
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <div>
              <h2>Decision &amp; audit feed</h2>
              <p>
                <code>crm_cp_audit</code> + <code>img_gate_logs</code>
              </p>
            </div>
          </header>
          <div className="cp-img-feed">
            {audit.length === 0 ? (
              <p className="cp-muted">—</p>
            ) : (
              audit.map((item) => (
                <div key={`${item.at}-${item.title}`} className="cp-img-feeditem">
                  <div className="cp-img-ficon">◈</div>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.detail}</p>
                  </div>
                  <time>{item.at}</time>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <CpImageJobModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
