'use client';

import { useMemo, useState } from 'react';

const TEMPLATES = [
  'Dashboard Marketing',
  'Funnel Conversion',
  'Target vs Actual',
  'Data Quality Summary',
] as const;

const WIDGETS = [
  'KPI Cards',
  'Funnel',
  'Target Progress',
  'Channel Chart',
  'Alert List',
  'Top Sales',
] as const;

type WizardState = {
  template: string;
  widgets: string[];
  schedule: {
    frequency: 'WEEKLY' | 'MONTHLY';
    day: string;
    time: string;
    channel: string;
  };
};

type Props = {
  submitting?: boolean;
  onSubmit: (payload: Record<string, unknown>) => void | Promise<void>;
};

export function KpiHubReportWizard({ submitting, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    template: TEMPLATES[0],
    widgets: ['KPI Cards', 'Funnel'],
    schedule: {
      frequency: 'WEEKLY',
      day: 'MON',
      time: '08:00',
      channel: 'Email + Teams',
    },
  });

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(state.template);
    if (step === 1) return state.widgets.length > 0;
    return true;
  }, [state.template, state.widgets.length, step]);

  return (
    <div className="kpi-hub-report-wizard">
      <ol className="kpi-hub-report-wizard__steps">
        {['Mẫu báo cáo', 'Widget', 'Lịch gửi'].map((label, index) => (
          <li key={label} className={index === step ? 'is-active' : index < step ? 'is-done' : ''}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="kpi-hub-card">
          <h2>Chọn mẫu</h2>
          <div className="kpi-hub-quick-grid">
            {TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                className={`kpi-hub-quick-card${state.template === template ? ' is-selected' : ''}`}
                onClick={() => setState((prev) => ({ ...prev, template }))}
              >
                {template}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="kpi-hub-card">
          <h2>Chọn widget</h2>
          <div className="kpi-hub-report-wizard__widgets">
            {WIDGETS.map((widget) => {
              const checked = state.widgets.includes(widget);
              return (
                <label key={widget} className="kpi-hub-toggle">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setState((prev) => ({
                        ...prev,
                        widgets: e.target.checked
                          ? [...prev.widgets, widget]
                          : prev.widgets.filter((w) => w !== widget),
                      }));
                    }}
                  />
                  {widget}
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="kpi-hub-card">
          <h2>Lịch gửi</h2>
          <div className="kpi-hub-form-grid">
            <label>
              Tần suất
              <select
                className="kpi-hub-select"
                value={state.schedule.frequency}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    schedule: {
                      ...prev.schedule,
                      frequency: e.target.value as WizardState['schedule']['frequency'],
                    },
                  }))
                }
              >
                <option value="WEEKLY">Hàng tuần</option>
                <option value="MONTHLY">Hàng tháng</option>
              </select>
            </label>
            <label>
              Ngày
              <select
                className="kpi-hub-select"
                value={state.schedule.day}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, day: e.target.value },
                  }))
                }
              >
                <option value="MON">Thứ 2</option>
                <option value="FRI">Thứ 6</option>
                <option value="MONTH_START">Đầu tháng</option>
              </select>
            </label>
            <label>
              Giờ gửi
              <input
                className="kpi-hub-input"
                type="time"
                value={state.schedule.time}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, time: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              Kênh
              <input
                className="kpi-hub-input"
                value={state.schedule.channel}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, channel: e.target.value },
                  }))
                }
              />
            </label>
          </div>
          <p className="muted">
            Preview: {state.template} · {state.widgets.length} widget · {state.schedule.frequency}{' '}
            {state.schedule.day} {state.schedule.time}
          </p>
        </section>
      ) : null}

      <footer className="kpi-hub-report-wizard__foot">
        <button
          type="button"
          className="kpi-hub-btn kpi-hub-btn--ghost"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Quay lại
        </button>
        {step < 2 ? (
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
          >
            Tiếp tục
          </button>
        ) : (
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            disabled={submitting}
            onClick={() =>
              void onSubmit({
                name: state.template,
                template: state.template,
                widgets: state.widgets,
                schedule: state.schedule,
              })
            }
          >
            {submitting ? 'Đang tạo…' : 'Tạo báo cáo'}
          </button>
        )}
      </footer>
    </div>
  );
}
