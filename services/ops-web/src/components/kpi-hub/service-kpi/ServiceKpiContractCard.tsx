'use client';

/** Wave 1 fixture — QT-0089 until instances API ships in Wave 2 */
export function ServiceKpiContractCard() {
  return (
    <div className="kpi-hub-skpi-contract">
      <div className="kpi-hub-card">
        <header className="kpi-hub-card__head">
          <h2>QT-0089 · An Phát · DV04 Meta Ads</h2>
          <span className="kpi-hub-badge kpi-hub-badge--red">Blocked</span>
        </header>
        <div className="kpi-hub-card__body">
          <div className="kpi-hub-skpi-score">
            <div className="kpi-hub-skpi-score__value">19</div>
            <div className="kpi-hub-skpi-score__label">Contract Score</div>
          </div>
          <dl className="kpi-hub-dl">
            <div>
              <dt>GM</dt>
              <dd>22,4% (&lt; floor 25%)</dd>
            </div>
            <div>
              <dt>CPL proposed</dt>
              <dd>50.000 VND (floor 85.000 — aggressive)</dd>
            </div>
            <div>
              <dt>Reviewer bắt buộc</dt>
              <dd>Finance · GDKD · Strategy (AD)</dd>
            </div>
            <div>
              <dt>Công thức</dt>
              <dd>
                score = round(25% classification + 25% aggressiveness + 20% assumption + 15% data + 15% margin).
                Block khi GM &lt; floor và (score ≥ 70 hoặc aggressiveness ≥ 25%).
              </dd>
            </div>
          </dl>
          <p className="kpi-hub-notice">
            Internal only — không hiển thị trên public proposal. Gợi ý: Phương án B hoặc waiver Finance+GDKD+Strategy.
          </p>
        </div>
      </div>
    </div>
  );
}
