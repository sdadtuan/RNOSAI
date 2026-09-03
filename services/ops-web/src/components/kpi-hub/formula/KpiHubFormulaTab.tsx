'use client';

import { KPI_HUB_FORMULA_CPL } from '@/lib/kpi-hub-fixtures';

type Part = {
  code: string;
  name: string;
  expression: string;
  filter: string;
};

export function FormulaPartCard({ title, part }: { title: string; part: Part }) {
  return (
    <article className="kpi-hub-card kpi-hub-formula-part">
      <header className="kpi-hub-formula-part__head">
        <span className="muted">{title}</span>
        <span className="kpi-hub-table__mono">{part.code}</span>
      </header>
      <h3>{part.name}</h3>
      <code className="kpi-hub-formula-expr">{part.expression}</code>
      <span className="kpi-hub-chip">{part.filter}</span>
    </article>
  );
}

export function FormulaPreview() {
  const f = KPI_HUB_FORMULA_CPL;
  return (
    <div className="kpi-hub-formula-preview">
      <div className="kpi-hub-formula-preview__business">{f.businessFormula}</div>
      <pre className="kpi-hub-formula-preview__dax">{f.dax}</pre>
    </div>
  );
}

export function FormulaSidebar() {
  const f = KPI_HUB_FORMULA_CPL;
  return (
    <aside className="kpi-hub-rail">
      <section className="kpi-hub-card">
        <h3>Quy tắc thời gian</h3>
        <p>{f.sidebar.timeBasis}</p>
      </section>
      <section className="kpi-hub-card">
        <h3>Kiểm tra logic</h3>
        <ul className="kpi-hub-checklist">
          {f.sidebar.logicChecks.map((c) => (
            <li key={c} className="is-ok">
              ✓ {c}
            </li>
          ))}
        </ul>
      </section>
      <section className="kpi-hub-card">
        <h3>KPI phụ thuộc</h3>
        <ul className="kpi-hub-tag-list">
          {f.sidebar.dependencies.map((d) => (
            <li key={d} className="kpi-hub-tag">
              {d}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function KpiHubFormulaTab() {
  const f = KPI_HUB_FORMULA_CPL;
  return (
    <div className="kpi-hub-tab-panel kpi-hub-tab-panel--split">
      <div className="kpi-hub-tab-panel__main">
        <div className="kpi-hub-form-row">
          <label>
            Loại phép tính
            <select className="kpi-hub-select" defaultValue={f.calcType}>
              <option value="Ratio">Ratio</option>
              <option value="Sum">Sum</option>
              <option value="Count">Count</option>
            </select>
          </label>
        </div>
        <div className="kpi-hub-formula-parts">
          <FormulaPartCard title="Tử số" part={f.numerator} />
          <FormulaPartCard title="Mẫu số" part={f.denominator} />
        </div>
        <FormulaPreview />
        <div className="kpi-hub-toggle-list">
          <label className="kpi-hub-toggle">
            <input type="checkbox" defaultChecked={f.toggles.blankIfZero} />
            BLANK mẫu số 0
          </label>
          <label className="kpi-hub-toggle">
            <input type="checkbox" defaultChecked={f.toggles.nonAdditiveRatio} />
            Không cộng dồn tỷ lệ
          </label>
          <label className="kpi-hub-toggle">
            <input type="checkbox" defaultChecked={f.toggles.manualEntry} />
            Nhập thủ công
          </label>
        </div>
      </div>
      <FormulaSidebar />
    </div>
  );
}
