'use client';

type VarRow = { name: string; detail: string };

type Props = {
  formula: string;
  vars?: VarRow[];
};

export function SkpiFormulaBlock({ formula, vars = [] }: Props) {
  return (
    <div className="kpi-hub-skpi-formula-block">
      <b>Formula</b>
      <code>{formula}</code>
      {vars.length ? (
        <div className="kpi-hub-skpi-formula-block__vars">
          {vars.map((v) => (
            <div key={v.name} className="kpi-hub-skpi-formula-block__var">
              <b>{v.name}</b>
              <span>{v.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
