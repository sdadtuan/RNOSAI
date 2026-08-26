'use client';

import { FormField, FormTextarea } from '@/components/form';

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
    <FormField label="Mô tả">
      <FormTextarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={rows}
        placeholder="Ghi chú nội bộ về phòng ban / team / chức vụ…"
      />
    </FormField>
  );
}
