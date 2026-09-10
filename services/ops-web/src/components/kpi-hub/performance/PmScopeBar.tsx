'use client';

type Props = {
  scope: string;
  green: number;
  yellow: number;
  red: number;
  healthyPct: number;
};

export function PmScopeBar({ scope, green, yellow, red, healthyPct }: Props) {
  return (
    <div className="kpi-hub-pm-stackrow">
      <label>{scope}</label>
      <div className="kpi-hub-pm-stack">
        {green > 0 ? <i className="kpi-hub-pm-stack__g" style={{ width: `${green}%` }} /> : null}
        {yellow > 0 ? <i className="kpi-hub-pm-stack__y" style={{ width: `${yellow}%` }} /> : null}
        {red > 0 ? <i className="kpi-hub-pm-stack__r" style={{ width: `${red}%` }} /> : null}
      </div>
      <b>{healthyPct}%</b>
    </div>
  );
}
