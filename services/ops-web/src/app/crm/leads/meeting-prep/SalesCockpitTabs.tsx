'use client';

import { useEffect, useState } from 'react';
import type { CloseIntelligence, LeadMeetingPrepResult } from './lead-meeting-prep.types';

type Props = {
  result: LeadMeetingPrepResult;
  sci: CloseIntelligence;
};

export function SalesCockpitIntelTab({ result, sci }: Props) {
  return (
    <div className="lmp-cockpit-tab">
      <section>
        <h3 className="lmp-panel__section-title">Chân dung doanh nghiệp</h3>
        <p>{result.company_profile.summary}</p>
      </section>
      <section>
        <h3 className="lmp-panel__section-title">Pain / ROI</h3>
        <p>{sci.pain_roi_estimate.basis}</p>
      </section>
      <section>
        <h3 className="lmp-panel__section-title">Tín hiệu urgency</h3>
        <ul>
          {sci.urgency_signals.map((u) => (
            <li key={u.signal}>
              <strong>{u.signal}</strong> — {u.evidence}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="lmp-panel__section-title">Góc competitive</h3>
        {sci.competitive_angle.playbook_slug ? (
          <p className="lmp-playbook-badge">
            Playbook: <strong>{sci.competitive_angle.playbook_slug}</strong>
          </p>
        ) : null}
        <p>{sci.competitive_angle.vs_status_quo}</p>
        <p>{sci.competitive_angle.vs_generic_agency}</p>
      </section>
      {sci.red_flags.length ? (
        <section>
          <h3 className="lmp-panel__section-title">Red flags</h3>
          <ul>
            {sci.red_flags.map((f) => (
              <li key={f.flag_vi}>
                <span className={`lmp-badge lmp-badge--${f.severity === 'block' ? 'block' : 'warn'}`}>
                  {f.severity}
                </span>{' '}
                {f.flag_vi} — {f.mitigation_vi}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function SalesCockpitTalkTrackTab({ sci }: { sci: CloseIntelligence }) {
  const [seconds, setSeconds] = useState(15 * 60);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const fullScript = sci.talk_track.phases.map((p) => p.script_vi).join('\n\n');

  return (
    <div className="lmp-cockpit-tab">
      <p className="lmp-talk-meta">
        {sci.talk_track.framework} · {sci.talk_track.total_minutes} phút · Timer {mm}:{ss}
      </p>
      <ol className="lmp-talk-phases">
        {sci.talk_track.phases.map((p) => (
          <li key={p.phase_vi}>
            <strong>{p.phase_vi}</strong>
            <p>{p.script_vi}</p>
          </li>
        ))}
      </ol>
      <CopyInline text={fullScript} />
    </div>
  );
}

function CopyInline({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-secondary"
      onClick={() => void navigator.clipboard.writeText(text)}
    >
      Copy toàn bộ talk track
    </button>
  );
}

export function SalesCockpitOfferTab({ sci }: { sci: CloseIntelligence }) {
  return (
    <div className="lmp-offer-grid">
      {sci.offer_ladder.map((tier) => (
        <article
          key={tier.sku_code}
          className={`lmp-offer-card${tier.anchor_role === 'recommended' ? ' lmp-offer-card--rec' : ''}`}
        >
          <span className="lmp-offer-card__tier">{tier.tier}</span>
          <h4>{tier.label_vi}</h4>
          <p>{tier.headline_vi}</p>
          <p className="muted">{tier.reason_vi}</p>
          {tier.price_hint_vnd != null ? (
            <p className="lmp-offer-card__price">{tier.price_hint_vnd.toLocaleString('vi-VN')} đ</p>
          ) : (
            <p className="muted">Giá: liên hệ</p>
          )}
        </article>
      ))}
    </div>
  );
}

export function SalesCockpitObjectionsTab({ sci }: { sci: CloseIntelligence }) {
  return (
    <ul className="lmp-objection-list">
      {sci.objection_playbook.map((o) => (
        <li key={o.objection_vi} className="lmp-objection-card">
          <details>
            <summary>{o.objection_vi}</summary>
            <p>{o.rebuttal_vi}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
