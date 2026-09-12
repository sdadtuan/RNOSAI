'use client';

// Parity: msos-head, msos-spine, msos-grid3, msos-t
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';
import { msosGet, msosMutate } from '@/lib/crm/msos-client';
import { formatBps, msosErrorMessage } from '@/lib/crm/msos-format';
import { isMediaOsFeEnabled } from '@/lib/media-os-flags';
import { MsosEmpty } from './MsosEmpty';
import { MsosSpine } from './MsosSpine';
import { MsosToast } from './MsosToast';

type Partner = { id: string; display_code: string; legal_name: string; kyc_pass: boolean };

type Health = { ok: boolean; reseller: boolean; connector_write: boolean };

type Policy = { key: string; rule_text: string; enforcement: string };

type Scorecard = {
  delivery_bps: number | null;
  discrepancy_bps: number | null;
  safety_incidents: number;
  score: number;
};

type Eligibility = {
  kyc_pass: boolean;
  scorecard_pass: boolean;
  rate_published: boolean;
  reseller_open: boolean;
  locked: boolean;
};

export function MsosGovernance() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h, pol] = await Promise.all([
        msosGet<Partner[]>('/partners'),
        msosGet<Health>('/health'),
        msosGet<Policy[]>('/policies'),
      ]);
      setPartners(p);
      setHealth(h);
      setPolicies(pol);
      if (p.length && !selectedPartner) setSelectedPartner(p[0].id);
    } catch (e) {
      setToast(msosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedPartner]);

  const loadPartnerMeta = useCallback(async (partnerId: string) => {
    if (!partnerId) return;
    try {
      const [sc, el] = await Promise.all([
        msosGet<Scorecard | null>(`/partners/${partnerId}/scorecard`).catch(() => null),
        msosGet<Eligibility>(`/partners/${partnerId}/eligibility`),
      ]);
      setScorecard(sc);
      setEligibility(el);
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedPartner) void loadPartnerMeta(selectedPartner);
  }, [selectedPartner, loadPartnerMeta]);

  async function recomputeScorecard() {
    if (!selectedPartner) return;
    try {
      const sc = await msosMutate<Scorecard | null>(
        `/partners/${selectedPartner}/scorecard/recompute`,
        { method: 'POST', body: '{}' },
      );
      setScorecard(sc);
      await loadPartnerMeta(selectedPartner);
      setToast(sc ? `Scorecard recomputed: ${sc.score}` : 'Chưa đủ data delivery');
    } catch (e) {
      setToast(msosErrorMessage(e));
    }
  }

  if (loading) return <p className="msos-status">Đang tải Governance…</p>;

  if (partners.length === 0) {
    return (
      <>
        <header className="msos-head">
          <div>
            <h1>Governance</h1>
            <p>Policy, flags và partner scorecard.</p>
          </div>
        </header>
        <MsosSpine />
        <MsosEmpty title="Governance" copy={MSOS_EMPTY.settings} />
        <MsosToast message={toast} onClose={() => setToast('')} />
      </>
    );
  }

  const feEnabled = isMediaOsFeEnabled();

  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Governance</h1>
          <p>Policy IO / safety / discrepancy. C vẫn khóa.</p>
        </div>
        <div className="msos-actions">
          <Link className="msos-btn" href="/admin/crm/permission-sets">
            Mở IAM
          </Link>
          <Link className="msos-btn" href="/crm/content-os">
            Mở AI Platform
          </Link>
        </div>
      </header>
      <MsosSpine />
      <div className="msos-filter" style={{ marginBottom: 14 }}>
        <select
          className="msos-input"
          value={selectedPartner}
          onChange={(e) => setSelectedPartner(e.target.value)}
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_code} · {p.legal_name}
            </option>
          ))}
        </select>
      </div>
      <div className="msos-grid3" style={{ marginBottom: 14 }}>
        <div className="msos-card msos-pad">
          <h3>Flags</h3>
          <div className="msos-row">
            <span>MEDIA_OS_ENABLED</span>
            <span className={`msos-tag ${feEnabled ? 'green' : 'lock'}`}>{feEnabled ? 'on' : 'off'}</span>
          </div>
          <div className="msos-row">
            <span>MEDIA_OS_RESELLER</span>
            <span className="msos-tag lock">{health?.reseller ? 'on' : 'off'}</span>
          </div>
          <div className="msos-row">
            <span>CONNECTOR_WRITE</span>
            <span className="msos-tag lock">{health?.connector_write ? 'on' : 'off'}</span>
          </div>
        </div>
        <div className="msos-card msos-pad">
          <h3>Partner scorecard</h3>
          {scorecard ? (
            <>
              <div className="msos-row">
                <span>Delivery reliability</span>
                <b>{scorecard.delivery_bps != null ? formatBps(scorecard.delivery_bps) : '—'}</b>
              </div>
              <div className="msos-row">
                <span>Discrepancy</span>
                <b>{scorecard.discrepancy_bps != null ? formatBps(scorecard.discrepancy_bps) : '—'}</b>
              </div>
              <div className="msos-row">
                <span>Brand-safety incidents</span>
                <b>{scorecard.safety_incidents}</b>
              </div>
              <div className="msos-row">
                <span>Tổng</span>
                <b>{scorecard.score}</b>
              </div>
            </>
          ) : (
            <p className="msos-desc">Chưa có scorecard — cần data delivery thật.</p>
          )}
          <button type="button" className="msos-btn msos-btn--small" onClick={() => void recomputeScorecard()}>
            Recompute scorecard
          </button>
        </div>
        <div className="msos-card msos-pad">
          <h3>Reseller Eligibility</h3>
          {eligibility ? (
            <>
              <div className="msos-row">
                <span>KYC</span>
                <span className={`msos-tag ${eligibility.kyc_pass ? 'green' : 'red'}`}>
                  {eligibility.kyc_pass ? 'Pass' : 'Fail'}
                </span>
              </div>
              <div className="msos-row">
                <span>Scorecard pass</span>
                <span className={`msos-tag ${eligibility.scorecard_pass ? 'green' : 'red'}`}>
                  {eligibility.scorecard_pass ? 'Pass' : 'Fail'}
                </span>
              </div>
              <div className="msos-row">
                <span>Cổng C</span>
                <span className="msos-tag lock">Khóa</span>
              </div>
              <button type="button" className="msos-btn off" disabled>
                Bật reseller (locked)
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="msos-card msos-pad">
        <h3>Policy registry</h3>
        <div className="msos-table-scroll">
          <table className="msos-t" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Policy</th>
                <th>Rule</th>
                <th>Enforcement</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.key}>
                  <td>{p.key}</td>
                  <td>{p.rule_text}</td>
                  <td>{p.enforcement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <MsosToast message={toast} onClose={() => setToast('')} />
    </>
  );
}
