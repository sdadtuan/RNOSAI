'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormField, FormGrid, FormInput, FormSection } from '@/components/form';
import {
  TEAM_SLA_CODES,
  defaultTeamSlaDocument,
  normalizeTeamSlaDocument,
  type MarketingTeamClocks,
  type SaleTeamClocks,
  type TeamSlaCode,
  type TeamSlaDocument,
  type TeamSlaProfile,
} from '@/lib/crm/team-sla-profiles';

const DAY_LABELS: { day: number; label: string }[] = [
  { day: 1, label: 'T2' },
  { day: 2, label: 'T3' },
  { day: 3, label: 'T4' },
  { day: 4, label: 'T5' },
  { day: 5, label: 'T6' },
  { day: 6, label: 'T7' },
  { day: 7, label: 'CN' },
];

type NumKey<T> = { [K in keyof T]: T[K] extends number | null ? K : never }[keyof T];

function numChange(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function TeamSlaMilestonesCard({ readOnly }: { readOnly: boolean }) {
  const [doc, setDoc] = useState<TeamSlaDocument | null>(null);
  const [code, setCode] = useState<TeamSlaCode>('sale_service');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/local-team-sla', { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status === 401 ? 'Đăng nhập lại rồi mở trang này.' : 'Không tải được mốc giờ');
        const body = (await res.json()) as unknown;
        if (!cancelled) setDoc(normalizeTeamSlaDocument(body));
      } catch (e) {
        if (!cancelled) {
          setDoc(defaultTeamSlaDocument());
          setError(e instanceof Error ? e.message : 'Không tải được mốc giờ');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = doc?.profiles.find((row) => row.code === code) ?? null;

  const patchProfile = useCallback((codeToPatch: TeamSlaCode, mutator: (row: TeamSlaProfile) => TeamSlaProfile) => {
    setDoc((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        profiles: prev.profiles.map((row) => (row.code === codeToPatch ? mutator(row) : row)),
      };
    });
  }, []);

  const onSave = async () => {
    if (!doc || readOnly) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch('/local-team-sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      if (!res.ok) throw new Error(res.status === 401 ? 'Đăng nhập lại rồi lưu.' : 'Lưu mốc giờ thất bại');
      const saved = normalizeTeamSlaDocument((await res.json()) as unknown);
      setDoc(saved);
      setMsg('Đã lưu mốc giờ trên máy local.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu mốc giờ thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSection className="page-card" title="Mốc giờ theo nhóm">
      <p className="muted" style={{ marginTop: 0 }}>
        Sale dịch vụ, Marketing và Sale bất động sản mỗi nhóm một bộ. Giờ 8:30, 9:00, 10:00, 11:00, 15:30, 18:30 sửa trực tiếp ở đây. Lưu trên máy local, không ghi lên server.
      </p>
      <div className="segmented-control__track" role="tablist" aria-label="Nhóm mốc giờ">
        {(doc?.profiles ?? TEAM_SLA_CODES.map((id) => ({ code: id, label: id }))).map((row) => (
          <button
            key={row.code}
            type="button"
            className={`segmented-control__item${row.code === code ? ' is-active' : ''}`}
            aria-pressed={row.code === code}
            onClick={() => setCode(row.code as TeamSlaCode)}
          >
            {row.label}
          </button>
        ))}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}
      {profile ? (
        <ProfileFields
          profile={profile}
          readOnly={readOnly}
          onChange={(next) => patchProfile(profile.code, () => next)}
        />
      ) : (
        <p className="muted">Đang tải mốc giờ…</p>
      )}
      {readOnly ? null : (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" disabled={busy || !doc} onClick={() => void onSave()}>
            Lưu mốc giờ
          </button>
        </div>
      )}
    </FormSection>
  );
}

function ProfileFields({
  profile,
  readOnly,
  onChange,
}: {
  profile: TeamSlaProfile;
  readOnly: boolean;
  onChange: (next: TeamSlaProfile) => void;
}) {
  const setCalendar = (patch: Partial<TeamSlaProfile['calendar']>) => {
    onChange({ ...profile, calendar: { ...profile.calendar, ...patch } });
  };

  return (
    <FormGrid cols={3}>
      <FormField label="Giờ bắt đầu ca">
        <FormInput
          type="time"
          value={profile.calendar.start}
          disabled={readOnly}
          onChange={(e) => setCalendar({ start: e.target.value })}
        />
      </FormField>
      <FormField label="Giờ kết thúc ca">
        <FormInput
          type="time"
          value={profile.calendar.end}
          disabled={readOnly}
          onChange={(e) => setCalendar({ end: e.target.value })}
        />
      </FormField>
      <FormField label="Ngày trong tuần" fullWidth>
        <div className="segmented-control__track" role="group">
          {DAY_LABELS.map(({ day, label }) => {
            const on = profile.calendar.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                className={`segmented-control__item${on ? ' is-active' : ''}`}
                disabled={readOnly}
                aria-pressed={on}
                onClick={() => {
                  const days = on
                    ? profile.calendar.days.filter((d) => d !== day)
                    : [...profile.calendar.days, day].sort((a, b) => a - b);
                  setCalendar({ days });
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </FormField>
      {profile.kind === 'sale' ? (
        <SaleFields
          clocks={profile.sale}
          readOnly={readOnly}
          onChange={(sale) => onChange({ ...profile, sale })}
        />
      ) : (
        <MarketingFields
          clocks={profile.marketing}
          readOnly={readOnly}
          onChange={(marketing) => onChange({ ...profile, marketing })}
        />
      )}
    </FormGrid>
  );
}

function NumField<T extends SaleTeamClocks | MarketingTeamClocks>({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  disabled: boolean;
  onChange: (next: number | null) => void;
}) {
  return (
    <FormField label={label} hint={hint}>
      <FormInput
        type="number"
        min={0}
        step="0.5"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(numChange(e.target.value))}
      />
    </FormField>
  );
}

function TimeField({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <FormField label={label} hint={hint}>
      <FormInput type="time" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  );
}

function SaleFields({
  clocks,
  readOnly,
  onChange,
}: {
  clocks: SaleTeamClocks;
  readOnly: boolean;
  onChange: (next: SaleTeamClocks) => void;
}) {
  const setNum = (key: NumKey<SaleTeamClocks>) => (next: number | null) => onChange({ ...clocks, [key]: next });
  return (
    <>
      <NumField
        label="Hạn nhận lead trong ca (phút)"
        hint="Tính từ lúc hệ thống gán"
        value={clocks.claim_in_hours_minutes}
        disabled={readOnly}
        onChange={setNum('claim_in_hours_minutes')}
      />
      <TimeField
        label="Hạn nhận lead ngoài ca"
        hint="Sáng ngày làm việc kế tiếp"
        value={clocks.claim_after_hours_time}
        disabled={readOnly}
        onChange={(claim_after_hours_time) => onChange({ ...clocks, claim_after_hours_time })}
      />
      <NumField
        label="Cập nhật sau khi đã nhận (giờ)"
        hint="Tính từ lúc bấm Nhận lead"
        value={clocks.update_after_claim_hours}
        disabled={readOnly}
        onChange={setNum('update_after_claim_hours')}
      />
      <NumField
        label="Chuyển Sales khác nếu chưa cập nhật (giờ)"
        hint="Tính từ lúc bấm Nhận lead"
        value={clocks.reassign_after_claim_hours}
        disabled={readOnly}
        onChange={setNum('reassign_after_claim_hours')}
      />
      <NumField
        label="Cách mỗi lần gọi lại (giờ)"
        value={clocks.retry_gap_hours}
        disabled={readOnly}
        onChange={setNum('retry_gap_hours')}
      />
      <NumField
        label="Số lần gọi tối đa trong ngày"
        value={clocks.max_calls_per_day}
        disabled={readOnly}
        onChange={setNum('max_calls_per_day')}
      />
      <NumField
        label="Số ngày không liên lạc được thì chuyển"
        value={clocks.no_contact_days}
        disabled={readOnly}
        onChange={setNum('no_contact_days')}
      />
      <NumField
        label="Hạn chuyển xong kể từ cuộc gọi cuối (ngày)"
        value={clocks.reassign_within_days}
        disabled={readOnly}
        onChange={setNum('reassign_within_days')}
      />
      <NumField
        label="Lấy phản hồi khách sau Solutions (giờ)"
        value={clocks.feedback_hours}
        disabled={readOnly}
        onChange={setNum('feedback_hours')}
      />
      <NumField
        label="Bổ sung thông tin khi Marketing trả về (giờ)"
        value={clocks.missing_info_hours}
        disabled={readOnly}
        onChange={setNum('missing_info_hours')}
      />
      <NumField
        label="Tải tối đa (lead đang xử lý)"
        value={clocks.max_open_leads}
        disabled={readOnly}
        onChange={setNum('max_open_leads')}
      />
    </>
  );
}

function MarketingFields({
  clocks,
  readOnly,
  onChange,
}: {
  clocks: MarketingTeamClocks;
  readOnly: boolean;
  onChange: (next: MarketingTeamClocks) => void;
}) {
  const setNum = (key: NumKey<MarketingTeamClocks>) => (next: number | null) =>
    onChange({ ...clocks, [key]: next });
  return (
    <>
      <NumField
        label="Hạn nhận case trong ca (phút)"
        value={clocks.claim_in_hours_minutes}
        disabled={readOnly}
        onChange={setNum('claim_in_hours_minutes')}
      />
      <TimeField
        label="Hạn nhận case sau giờ kết thúc ca"
        hint="Sáng hôm sau"
        value={clocks.claim_after_hours_time}
        disabled={readOnly}
        onChange={(claim_after_hours_time) => onChange({ ...clocks, claim_after_hours_time })}
      />
      <TimeField
        label="Hạn nhận case cuối tuần"
        hint="Sáng thứ 2"
        value={clocks.claim_weekend_time}
        disabled={readOnly}
        onChange={(claim_weekend_time) => onChange({ ...clocks, claim_weekend_time })}
      />
      <TimeField
        label="Mốc cắt trả Solutions trong ngày"
        value={clocks.solution_cutoff_time}
        disabled={readOnly}
        onChange={(solution_cutoff_time) => onChange({ ...clocks, solution_cutoff_time })}
      />
      <NumField
        label="Trả Solutions trước mốc cắt (giờ)"
        value={clocks.solution_before_cutoff_hours}
        disabled={readOnly}
        onChange={setNum('solution_before_cutoff_hours')}
      />
      <TimeField
        label="Trả Solutions sau mốc cắt"
        hint="Sáng hôm sau, thứ 2–5"
        value={clocks.solution_after_cutoff_time}
        disabled={readOnly}
        onChange={(solution_after_cutoff_time) => onChange({ ...clocks, solution_after_cutoff_time })}
      />
      <TimeField
        label="Trả Solutions sau mốc cắt ngày thứ 6"
        hint="Sáng thứ 2"
        value={clocks.solution_friday_time}
        disabled={readOnly}
        onChange={(solution_friday_time) => onChange({ ...clocks, solution_friday_time })}
      />
      <NumField
        label="Hạn sửa Solutions (giờ)"
        value={clocks.revision_hours}
        disabled={readOnly}
        onChange={setNum('revision_hours')}
      />
    </>
  );
}
