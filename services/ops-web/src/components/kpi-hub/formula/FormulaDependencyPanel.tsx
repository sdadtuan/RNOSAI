'use client';

type Props = {
  upstream: string[];
  downstream: string[];
};

export function FormulaDependencyPanel({ upstream, downstream }: Props) {
  return (
    <section className="kpi-hub-card kpi-hub-formula-deps">
      <h3>Phụ thuộc công thức</h3>
      <div className="kpi-hub-formula-deps__grid">
        <div>
          <h4>Upstream</h4>
          <ul className="kpi-hub-tag-list">
            {upstream.length ? (
              upstream.map((code) => (
                <li key={`up-${code}`} className="kpi-hub-tag">
                  {code}
                </li>
              ))
            ) : (
              <li className="muted">Không có</li>
            )}
          </ul>
        </div>
        <div>
          <h4>Downstream</h4>
          <ul className="kpi-hub-tag-list">
            {downstream.length ? (
              downstream.map((code) => (
                <li key={`down-${code}`} className="kpi-hub-tag">
                  {code}
                </li>
              ))
            ) : (
              <li className="muted">Không có</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
