import {
  PUBLIC_ACCEPT_CTA,
  formatPublicMoney,
  type PublicProposal,
} from '@/lib/public-proposal';

type Props = {
  data: PublicProposal;
  name: string;
  email: string;
  accepted: boolean;
  acting: boolean;
  message: string;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onAccepted: (value: boolean) => void;
  onSubmit: () => void;
};

export function PublicProposalView({
  data,
  name,
  email,
  accepted,
  acting,
  message,
  onName,
  onEmail,
  onAccepted,
  onSubmit,
}: Props) {
  const cta = data.cta?.accept || PUBLIC_ACCEPT_CTA;
  const inv = data.investment;

  return (
    <article className="deal-teaser-card stack-gap">
      <header>
        <p className="deal-teaser-eyebrow">PTT Agency · Đề xuất marketing</p>
        <h1 className="deal-teaser-title">{data.title || '—'}</h1>
        <p className="deal-teaser-meta muted">
          {data.quote_code || '—'}
          {data.version_n ? ` · v${data.version_n}` : ''}
          {data.valid_until ? ` · đến ${data.valid_until}` : ''}
        </p>
      </header>

      {data.objective ? (
        <section className="deal-teaser-section">
          <h2>Mục tiêu hợp tác</h2>
          <p>{data.objective}</p>
        </section>
      ) : null}

      {data.scope.length ? (
        <section className="deal-teaser-section">
          <h2>Phạm vi</h2>
          <ul>
            {data.scope.map((item) => (
              <li key={`${item.dv_code}-${item.notes}`}>{item.notes || item.dv_code}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.kpis.length ? (
        <section className="deal-teaser-section">
          <h2>Chỉ số</h2>
          <ul>
            {data.kpis.map((kpi, idx) => (
              <li key={`${kpi.label ?? 'kpi'}-${idx}`}>
                {kpi.label ?? '—'}
                {kpi.value ? `: ${kpi.value}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="deal-teaser-section">
        <h2>Tóm tắt đầu tư</h2>
        <p>Phí dịch vụ · {formatPublicMoney(inv?.fee_vnd)}</p>
        <p>Ngân sách media · {formatPublicMoney(inv?.media_vnd)}</p>
        <p>Chiết khấu · {formatPublicMoney(inv?.discount_vnd)}</p>
        <p>VAT · {formatPublicMoney(inv?.tax_vnd)}</p>
        <p>
          <strong>Tổng · {formatPublicMoney(inv?.payable_vnd)}</strong>
        </p>
      </section>

      {data.payments.length ? (
        <section className="deal-teaser-section">
          <h2>Thanh toán</h2>
          <ul>
            {data.payments.map((pay) => (
              <li key={pay.seq}>
                {pay.milestone || `Đợt ${pay.seq}`} · {formatPublicMoney(pay.amount_vnd)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {message ? <p className="muted">{message}</p> : null}

      {data.status === 'accepted' ? (
        <p>Đề xuất đã được xác nhận (phương án A).</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <p>
            <label>
              Họ tên
              <input value={name} onChange={(e) => onName(e.target.value)} required />
            </label>
          </p>
          <p>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => onEmail(e.target.value)} required />
            </label>
          </p>
          <p>
            <label>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => onAccepted(e.target.checked)}
              />{' '}
              Tôi đã đọc điều khoản và xác nhận đề xuất thương mại này.
            </label>
          </p>
          <button type="submit" className="btn btn-primary" disabled={acting || !accepted}>
            {cta}
          </button>
          <p className="muted">Không phải hợp đồng pháp lý.</p>
        </form>
      )}
    </article>
  );
}
