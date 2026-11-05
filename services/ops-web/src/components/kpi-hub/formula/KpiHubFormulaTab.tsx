'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { previewFormula, fetchDictionaryDependencies } from '@/lib/kpi-hub-api';
import { createFormulaFilter } from '@/lib/kpi-hub-formula-utils';
import { KPI_HUB_FORMULA_CPL } from '@/lib/kpi-hub-fixtures';
import type { KpiHubFormulaData, KpiHubFormulaFilter } from '@/lib/kpi-hub-types';
import { FormulaDependencyPanel } from './FormulaDependencyPanel';
import { FormulaPartCard } from './FormulaPartCard';

function defaultFilters(label: string): KpiHubFormulaFilter[] {
  return [createFormulaFilter({ field: 'Status', operator: '=', value: label })];
}

export function KpiHubFormulaTab({ dictionaryId = 'mkt_006' }: { dictionaryId?: string }) {
  const [formula, setFormula] = useState<KpiHubFormulaData>(KPI_HUB_FORMULA_CPL);
  const [numFilters, setNumFilters] = useState<KpiHubFormulaFilter[]>(() => defaultFilters('Active'));
  const [denFilters, setDenFilters] = useState<KpiHubFormulaFilter[]>(() => defaultFilters('Valid'));
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [upstream, setUpstream] = useState<string[]>([]);
  const [downstream, setDownstream] = useState<string[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    void fetchDictionaryDependencies(token, dictionaryId)
      .then((deps) => {
        setUpstream(
          (deps.upstream ?? []).map((item) =>
            typeof item === 'string' ? item : String((item as { code?: string }).code ?? item),
          ),
        );
        setDownstream(
          (deps.downstream ?? []).map((item) =>
            typeof item === 'string' ? item : String((item as { code?: string }).code ?? item),
          ),
        );
      })
      .catch(() => {
        setUpstream(formula.sidebar.dependencies.slice(0, 2));
        setDownstream(formula.sidebar.dependencies.slice(2));
      });
  }, [dictionaryId, formula.sidebar.dependencies]);

  const runPreview = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await previewFormula(token, {
        calcType: formula.calcType,
        numerator: { ...formula.numerator, filters: numFilters },
        denominator: { ...formula.denominator, filters: denFilters },
        toggles: formula.toggles,
      });
      setFormula((prev) => ({
        ...prev,
        businessFormula: String(result.businessFormula ?? result.business_formula ?? prev.businessFormula),
        dax: String(result.dax ?? result.preview ?? prev.dax),
      }));
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Preview thất bại');
    } finally {
      setPreviewLoading(false);
    }
  }, [denFilters, formula.calcType, formula.denominator, formula.numerator, formula.toggles, numFilters]);

  return (
    <div className="kpi-hub-tab-panel kpi-hub-tab-panel--split">
      <div className="kpi-hub-tab-panel__main">
        <div className="kpi-hub-form-row">
          <label>
            Loại phép tính
            <select
              className="kpi-hub-select"
              value={formula.calcType}
              onChange={(e) => setFormula((prev) => ({ ...prev, calcType: e.target.value }))}
            >
              <option value="Ratio">Ratio</option>
              <option value="Sum">Sum</option>
              <option value="Count">Count</option>
            </select>
          </label>
        </div>
        <div className="kpi-hub-formula-parts">
          <FormulaPartCard
            title="Tử số"
            part={formula.numerator}
            filters={numFilters}
            onFiltersChange={setNumFilters}
            onPreview={runPreview}
            previewLoading={previewLoading}
          />
          <FormulaPartCard
            title="Mẫu số"
            part={formula.denominator}
            filters={denFilters}
            onFiltersChange={setDenFilters}
            onPreview={runPreview}
            previewLoading={previewLoading}
          />
        </div>
        <div className="kpi-hub-formula-preview">
          <div className="kpi-hub-formula-preview__business">{formula.businessFormula}</div>
          <pre className="kpi-hub-formula-preview__dax">{formula.dax}</pre>
          {previewError ? <p className="error">{previewError}</p> : null}
        </div>
        <div className="kpi-hub-toggle-list">
          <label className="kpi-hub-toggle">
            <input
              type="checkbox"
              checked={formula.toggles.blankIfZero}
              onChange={(e) =>
                setFormula((prev) => ({
                  ...prev,
                  toggles: { ...prev.toggles, blankIfZero: e.target.checked },
                }))
              }
            />
            BLANK mẫu số 0
          </label>
          <label className="kpi-hub-toggle">
            <input
              type="checkbox"
              checked={formula.toggles.nonAdditiveRatio}
              onChange={(e) =>
                setFormula((prev) => ({
                  ...prev,
                  toggles: { ...prev.toggles, nonAdditiveRatio: e.target.checked },
                }))
              }
            />
            Không cộng dồn tỷ lệ
          </label>
          <label className="kpi-hub-toggle">
            <input
              type="checkbox"
              checked={formula.toggles.manualEntry}
              onChange={(e) =>
                setFormula((prev) => ({
                  ...prev,
                  toggles: { ...prev.toggles, manualEntry: e.target.checked },
                }))
              }
            />
            Nhập thủ công
          </label>
        </div>
      </div>
      <aside className="kpi-hub-rail">
        <section className="kpi-hub-card">
          <h3>Quy tắc thời gian</h3>
          <p>{formula.sidebar.timeBasis}</p>
        </section>
        <section className="kpi-hub-card">
          <h3>Kiểm tra logic</h3>
          <ul className="kpi-hub-checklist">
            {formula.sidebar.logicChecks.map((c) => (
              <li key={c} className="is-ok">
                ✓ {c}
              </li>
            ))}
          </ul>
        </section>
        <FormulaDependencyPanel upstream={upstream} downstream={downstream} />
      </aside>
    </div>
  );
}
