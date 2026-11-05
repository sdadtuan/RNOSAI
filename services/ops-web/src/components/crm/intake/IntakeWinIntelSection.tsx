'use client';

import {
  WIN_INTEL_KEYS,
  type WinIntelKey,
  type WinIntelState,
} from '@/lib/crm/intake-win-intel';

const WIN_INTEL_LABELS: Record<WinIntelKey, string> = {
  incumbent: 'Agency đang dùng',
  competitor: 'Đối thủ',
  selection_criteria: 'Tiêu chí chọn',
  switch_risk: 'Rủi ro đổi',
};

const CONFIDENCE_OPTIONS = [
  { value: '', label: '— Độ chắc —' },
  { value: 'guess', label: 'Đoán' },
  { value: 'heard', label: 'Nghe nói' },
  { value: 'confirmed', label: 'Xác nhận' },
];

export type IntakeWinIntelSectionProps = {
  state: WinIntelState;
  prompts?: Array<{ key: string; hint: string }>;
  disabled?: boolean;
  onChange: (key: WinIntelKey, patch: { answer?: string; confidence?: string }) => void;
};

export function IntakeWinIntelSection({
  state,
  prompts,
  disabled,
  onChange,
}: IntakeWinIntelSectionProps) {
  const hintByKey = new Map((prompts ?? []).map((p) => [p.key, p.hint]));

  return (
    <section className="intake-win-intel stack-gap" aria-label="Win intel">
      <header className="intake-form__head">
        <h2 className="intake-form__title">Win intel</h2>
        <p className="muted">Incumbent · đối thủ · tiêu chí chọn · rủi ro đổi</p>
      </header>

      {WIN_INTEL_KEYS.map((key) => {
        const hint = hintByKey.get(key);
        const entry = state[key];
        return (
          <div key={key} className="stack-gap">
            <label className="intake-field">
              <span className="muted">
                {WIN_INTEL_LABELS[key]}
                {hint ? ` — ${hint}` : ''}
              </span>
              <textarea
                className="kpi-input"
                rows={2}
                value={entry.answer}
                disabled={disabled}
                placeholder={hint || WIN_INTEL_LABELS[key]}
                onChange={(e) => onChange(key, { answer: e.target.value })}
              />
            </label>
            <label className="intake-field">
              <span className="muted">Độ chắc</span>
              <select
                className="kpi-select"
                value={entry.confidence}
                disabled={disabled}
                aria-label={`Độ chắc ${WIN_INTEL_LABELS[key]}`}
                onChange={(e) => onChange(key, { confidence: e.target.value })}
              >
                {CONFIDENCE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      })}
    </section>
  );
}
