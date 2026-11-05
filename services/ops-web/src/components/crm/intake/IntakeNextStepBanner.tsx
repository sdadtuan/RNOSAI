'use client';

import type { IntakeNextStepBanner as BannerModel, IntakeNextStepTarget } from '@/lib/crm/intake-next-step-banner';

type Props = {
  banner: BannerModel;
  busy?: boolean;
  onPrimary?: () => void;
  onChip?: (target: IntakeNextStepTarget) => void;
};

export function IntakeNextStepBanner({ banner, busy, onPrimary, onChip }: Props) {
  const toneClass =
    banner.tone === 'ok'
      ? 'intake-next-step--ok'
      : banner.tone === 'warn'
        ? 'intake-next-step--warn'
        : 'intake-next-step--info';

  return (
    <section
      className={`intake-next-step ${toneClass}`}
      aria-label="Bước tiếp theo"
      data-action={banner.action}
    >
      <div className="intake-next-step__copy">
        <strong className="intake-next-step__title">{banner.title_vi}</strong>
        {banner.body_vi ? <p className="intake-next-step__body">{banner.body_vi}</p> : null}
        {banner.chips.length > 0 ? (
          <div className="intake-next-step__chips" role="list">
            {banner.chips.map((chip) => (
              <button
                key={chip.code}
                type="button"
                role="listitem"
                className="intake-next-step__chip"
                disabled={busy || !onChip || chip.target === 'none'}
                onClick={() => onChip?.(chip.target)}
              >
                {chip.label_vi}
                <span aria-hidden="true"> →</span>
              </button>
            ))}
          </div>
        ) : null}
        {banner.blockers.length > 0 && banner.chips.length === 0 ? (
          <ul className="intake-next-step__blockers">
            {banner.blockers.slice(0, 3).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {banner.cta_label_vi && onPrimary ? (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onPrimary}>
          {busy ? 'Đang xử lý…' : banner.cta_label_vi}
        </button>
      ) : null}
    </section>
  );
}
