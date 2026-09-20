'use client';

import type { IntakeNextStepBanner as BannerModel } from '@/lib/crm/intake-next-step-banner';

type Props = {
  banner: BannerModel;
  busy?: boolean;
  onPrimary?: () => void;
};

export function IntakeNextStepBanner({ banner, busy, onPrimary }: Props) {
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
        <p className="intake-next-step__body">{banner.body_vi}</p>
        {banner.blockers.length > 1 ? (
          <ul className="intake-next-step__blockers">
            {banner.blockers.slice(0, 4).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {banner.cta_label_vi && onPrimary ? (
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={onPrimary}
        >
          {busy ? 'Đang xử lý…' : banner.cta_label_vi}
        </button>
      ) : null}
    </section>
  );
}
