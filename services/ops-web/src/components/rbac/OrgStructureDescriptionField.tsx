'use client';

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  rows?: number;
};

export function orgDescriptionPreview(text?: string | null, max = 64): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '—';
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function OrgStructureDescriptionField({ value, onChange, readOnly, rows = 3 }: Props) {
  return (
    <label>
      Mô tả
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={rows}
        placeholder="Ghi chú nội bộ về phòng ban / team / chức vụ…"
        style={{
          width: '100%',
          marginTop: '0.35rem',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.65rem 0.75rem',
          color: 'var(--text)',
          resize: 'vertical',
          minHeight: '4.5rem',
        }}
      />
    </label>
  );
}
