'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import {
  Form,
  FormCheck,
  FormError,
  FormField,
  FormGrid,
  FormInput,
  FormSection,
  FormSelect,
  FormTextarea,
} from '@/components/form';
import {
  fetchLeadSlaRevisions,
  fetchLeadSlaSettings,
  patchStaffAcceptsLeads,
  publishLeadSlaSettings,
  rollbackLeadSlaRevision,
  saveLeadSlaSettingsDraft,
  staffMe,
  staffRefresh,
  type LeadSlaRevision,
  type LeadSlaSettingsPayload,
  type LeadSlaSettingsResponse,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const DAY_LABELS: { day: number; label: string }[] = [
  { day: 1, label: 'T2' },
  { day: 2, label: 'T3' },
  { day: 3, label: 'T4' },
  { day: 4, label: 'T5' },
  { day: 5, label: 'T6' },
  { day: 6, label: 'T7' },
  { day: 7, label: 'CN' },
];

const FR1_CHANNELS: Array<{
  id: LeadSlaSettingsPayload['fr1_channels'][number];
  label: string;
}> = [
  { id: 'phone', label: 'Phone' },
  { id: 'zalo', label: 'Zalo' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
];

const STAGE_OPTIONS = [
  'new',
  'moi',
  'qualified',
  'lead_b2b',
  'attempting',
  'da_lien_he',
  'meet_pending',
];

function num(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ToggleTrack({ children }: { children: React.ReactNode }) {
  return (
    <div className="segmented-control__track" role="group">
      {children}
    </div>
  );
}

export default function LeadSlaSettingsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [data, setData] = useState<LeadSlaSettingsResponse | null>(null);
  const [draft, setDraft] = useState<LeadSlaSettingsPayload | null>(null);
  const [revisions, setRevisions] = useState<LeadSlaRevision[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [showPublish, setShowPublish] = useState(false);
  const [overrideDryRun, setOverrideDryRun] = useState(false);
  const [holidaysText, setHolidaysText] = useState('');
  const [hotSources, setHotSources] = useState('');
  const [hotTags, setHotTags] = useState('');
  const [stagesText, setStagesText] = useState('');

  const isSuperAdmin = String(user?.position_code ?? '')
    .toUpperCase()
    .includes('SUPER');
  const canEdit = Boolean(data?.can_edit);
  const canPublish = Boolean(data?.can_publish);
  const readOnly = !canEdit;

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const hydrateDraft = useCallback((payload: LeadSlaSettingsPayload) => {
    setDraft(payload);
    setHolidaysText((payload.holidays ?? []).join('\n'));
    setHotSources((payload.hot_rules?.sources ?? []).join(', '));
    setHotTags((payload.hot_rules?.tags ?? []).join(', '));
    setStagesText((payload.eligible_pipeline_stages ?? []).join(', '));
  }, []);

  const reload = useCallback(
    async (access: string) => {
      const [settings, revs] = await Promise.all([
        fetchLeadSlaSettings(access),
        fetchLeadSlaRevisions(access, 40).catch(() => ({ items: [], total: 0 })),
      ]);
      setData(settings);
      hydrateDraft(settings.draft_payload ?? settings.payload);
      setRevisions(revs.items);
    },
    [hydrateDraft],
  );

  useEffect(() => {
    void (async () => {
      try {
        const access = await ensureAuth();
        if (!access) return;
        await reload(access);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
  }, [ensureAuth, reload]);

  const previewLines = useMemo(() => {
    if (!data || !draft) return [];
    const lines: string[] = [];
    if (data.payload.fr1_hours !== draft.fr1_hours) {
      lines.push(
        `FR1 đổi ${data.payload.fr1_hours}h→${draft.fr1_hours}h: áp dụng lead gán MỚI sau publish. Lead đang mở: không tự sửa fr1_due_at trừ Recalc.`,
      );
    }
    if (JSON.stringify(data.payload.case_1b) !== JSON.stringify(draft.case_1b)) {
      lines.push(
        'Số liệu case 1b: áp dụng lần recompute_hold_until tiếp theo (sau call log) hoặc Recalc.',
      );
    }
    lines.push('Pool / accepts_leads / redistribute: job & assign đọc ngay theo config hiện tại.');
    return lines;
  }, [data, draft]);

  const patch = useCallback(
    (mutator: (p: LeadSlaSettingsPayload) => LeadSlaSettingsPayload) => {
      setDraft((prev) => (prev ? mutator({ ...prev }) : prev));
    },
    [],
  );

  const syncListFields = useCallback(
    (base: LeadSlaSettingsPayload): LeadSlaSettingsPayload => ({
      ...base,
      holidays: holidaysText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      hot_rules: {
        sources: hotSources
          .split(/[,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        tags: hotTags
          .split(/[,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      },
      eligible_pipeline_stages: stagesText
        .split(/[,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    }),
    [holidaysText, hotSources, hotTags, stagesText],
  );

  const onSaveDraft = async () => {
    if (!draft || readOnly) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const access = await ensureAuth();
      if (!access) return;
      const payload = syncListFields(draft);
      const out = await saveLeadSlaSettingsDraft(access, payload);
      setData(out);
      hydrateDraft(out.draft_payload ?? out.payload);
      setMsg('Đã lưu draft');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    if (!draft || !canPublish) return;
    if (publishNote.trim().length < 10) {
      setError('Note publish cần ≥ 10 ký tự');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const access = await ensureAuth();
      if (!access) return;
      const payload = syncListFields(draft);
      const out = await publishLeadSlaSettings(access, {
        payload,
        note: publishNote.trim(),
        override_dry_run: overrideDryRun && isSuperAdmin,
      });
      setData(out);
      hydrateDraft(out.payload);
      setShowPublish(false);
      setPublishNote('');
      setMsg(`Đã publish v${out.settings_version}`);
      const revs = await fetchLeadSlaRevisions(access, 40);
      setRevisions(revs.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const onRollback = async (rev: LeadSlaRevision) => {
    if (!canPublish) return;
    const note = window.prompt('Ghi chú rollback (≥10 ký tự)', `Rollback to v${rev.settings_version}`);
    if (!note || note.trim().length < 10) return;
    setBusy(true);
    setError('');
    try {
      const access = await ensureAuth();
      if (!access) return;
      const out = await rollbackLeadSlaRevision(access, rev.id, note.trim());
      setData(out);
      hydrateDraft(out.payload);
      setMsg(`Rollback → v${out.settings_version}`);
      const revs = await fetchLeadSlaRevisions(access, 40);
      setRevisions(revs.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed');
    } finally {
      setBusy(false);
    }
  };

  const onToggleAccepts = async (staffId: number, accepts: boolean) => {
    setBusy(true);
    setError('');
    try {
      const access = await ensureAuth();
      if (!access) return;
      await patchStaffAcceptsLeads(access, staffId, accepts);
      await reload(access);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update accepts_leads failed');
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <StaffPageShell user={user} onLogout={logout}>
        <p className="muted">{error || 'Đang tải…'}</p>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout}>
      <PageToolbar
        title="Lead First Response SLA"
        subtitle={`Config v${data?.settings_version ?? '—'} · published ${
          data?.published_at ? new Date(data.published_at).toLocaleString('vi-VN') : '—'
        }${readOnly ? ' · chỉ xem' : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href="/crm/gdkd/lead-ops">
              Lead Ops
            </Link>
            {canEdit ? (
              <>
                <button type="button" className="btn" disabled={busy} onClick={() => void onSaveDraft()}>
                  Lưu draft
                </button>
                {canPublish ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => setShowPublish(true)}
                  >
                    Publish…
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        }
      />

      <FormError>{error}</FormError>
      {msg ? <p className="ok">{msg}</p> : null}

      <div className="lead-sla-admin-layout">
        <Form asDiv className={`lead-sla-admin-main${readOnly ? ' is-readonly' : ''}`}>
          {readOnly ? (
            <FormSection className="page-card" title="Tóm tắt (AM — chỉ xem)">
              <p style={{ margin: 0 }}>
                FR1: <strong>{draft.fr1_hours}h</strong> làm việc · Case 1b:{' '}
                <strong>
                  {draft.case_1b.max_working_days} WD / {draft.case_1b.min_attempts} lần gọi
                </strong>
              </p>
            </FormSection>
          ) : null}

          <FormSection className="page-card" title="1. Giờ làm việc & lịch">
            <FormGrid cols={3}>
              <FormField label="Timezone">
                <FormInput
                  value={draft.timezone}
                  disabled={readOnly}
                  onChange={(e) => patch((p) => ({ ...p, timezone: e.target.value }))}
                />
              </FormField>
              <FormField label="Bắt đầu">
                <FormInput
                  type="time"
                  value={draft.working_hours.start}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      working_hours: { ...p.working_hours, start: e.target.value },
                    }))
                  }
                />
              </FormField>
              <FormField label="Kết thúc">
                <FormInput
                  type="time"
                  value={draft.working_hours.end}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      working_hours: { ...p.working_hours, end: e.target.value },
                    }))
                  }
                />
              </FormField>
              <FormField label="Ngày làm việc" fullWidth>
                <ToggleTrack>
                  {DAY_LABELS.map(({ day, label }) => {
                    const on = draft.working_hours.days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`segmented-control__item${on ? ' is-active' : ''}`}
                        disabled={readOnly}
                        aria-pressed={on}
                        onClick={() =>
                          patch((p) => {
                            const days = on
                              ? p.working_hours.days.filter((d) => d !== day)
                              : [...p.working_hours.days, day].sort();
                            return { ...p, working_hours: { ...p.working_hours, days } };
                          })
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </ToggleTrack>
              </FormField>
              <FormField
                label="Ngày nghỉ / holidays"
                hint="YYYY-MM-DD — mỗi dòng hoặc dấu phẩy"
                fullWidth
              >
                <FormTextarea
                  rows={3}
                  value={holidaysText}
                  disabled={readOnly}
                  placeholder="2026-01-01&#10;2026-04-30"
                  onChange={(e) => setHolidaysText(e.target.value)}
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection className="page-card" title="2. First response (FR1)">
            <FormGrid cols={2}>
              <FormField label="Thời hạn FR1 (giờ LV)" hint="Cho phép 0.5 – 8 giờ làm việc">
                <FormInput
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={8}
                  value={draft.fr1_hours}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({ ...p, fr1_hours: num(e.target.value, p.fr1_hours) }))
                  }
                />
              </FormField>
              <FormField label="Kênh tính FR1" hint="Chỉ phone theo mặc định R3">
                <ToggleTrack>
                  {FR1_CHANNELS.map((ch) => {
                    const on = draft.fr1_channels.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        className={`segmented-control__item${on ? ' is-active' : ''}`}
                        disabled={readOnly}
                        aria-pressed={on}
                        onClick={() =>
                          patch((p) => ({
                            ...p,
                            fr1_channels: on
                              ? p.fr1_channels.filter((c) => c !== ch.id)
                              : [...p.fr1_channels, ch.id],
                          }))
                        }
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </ToggleTrack>
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection className="page-card" title="3. Case SLA — 1a / 1b / 1c">
            <h3 className="lead-sla-admin-subhead">1a · Hẹn gặp (meet pending)</h3>
            <FormGrid cols={3}>
              <FormField label="Max WD đặt lịch">
                <FormInput
                  type="number"
                  value={draft.case_1a.meeting_book_max_working_days}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      case_1a: {
                        ...p.case_1a,
                        meeting_book_max_working_days: num(
                          e.target.value,
                          p.case_1a.meeting_book_max_working_days,
                        ),
                      },
                    }))
                  }
                />
              </FormField>
              <FormField label="Escalate nếu chưa meeting (WD)">
                <FormInput
                  type="number"
                  value={draft.case_1a.escalate_if_no_meeting_after_working_days}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      case_1a: {
                        ...p.case_1a,
                        escalate_if_no_meeting_after_working_days: num(
                          e.target.value,
                          p.case_1a.escalate_if_no_meeting_after_working_days,
                        ),
                      },
                    }))
                  }
                />
              </FormField>
              <FormField label="Update sau meeting (giờ)">
                <FormInput
                  type="number"
                  value={draft.case_1a.post_meeting_update_hours}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      case_1a: {
                        ...p.case_1a,
                        post_meeting_update_hours: num(
                          e.target.value,
                          p.case_1a.post_meeting_update_hours,
                        ),
                      },
                    }))
                  }
                />
              </FormField>
            </FormGrid>

            <h3 className="lead-sla-admin-subhead">1b · Không bắt máy (RNA)</h3>
            <FormGrid cols={3}>
              {(
                [
                  ['max_working_days', 'Max WD'],
                  ['min_attempts', 'Min attempts'],
                  ['min_gap_working_hours', 'Gap tối thiểu (WH)'],
                  ['hot_max_working_days', 'Hot max WD'],
                  ['hot_min_attempts', 'Hot min attempts'],
                  ['cooldown_days_same_am', 'Cooldownoldown AM (ngày)'],
                  ['max_extends', 'Max extend'],
                  ['extend_working_days', 'Extend thêm (WD)'],
                ] as const
              ).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <FormInput
                    type="number"
                    value={draft.case_1b[key]}
                    disabled={readOnly}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        case_1b: { ...p.case_1b, [key]: num(e.target.value, p.case_1b[key]) },
                      }))
                    }
                  />
                </FormField>
              ))}
            </FormGrid>

            <h3 className="lead-sla-admin-subhead">1c · Sai số / unreachable</h3>
            <FormGrid cols={2}>
              {(
                [
                  ['wrong_number_max_working_hours', 'Wrong number max (WH)'],
                  ['unreachable_max_working_days', 'Unreachable max WD'],
                  ['unreachable_min_attempts', 'Unreachable min attempts'],
                  ['max_reassign_rounds', 'Max vòng reassign'],
                ] as const
              ).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <FormInput
                    type="number"
                    value={draft.case_1c[key]}
                    disabled={readOnly}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        case_1c: { ...p.case_1c, [key]: num(e.target.value, p.case_1c[key]) },
                      }))
                    }
                  />
                </FormField>
              ))}
            </FormGrid>
          </FormSection>

          <FormSection className="page-card" title="4. Lead nóng">
            <FormGrid cols={2}>
              <FormField label="Sources" hint="Phân tách bằng dấu phẩy">
                <FormInput
                  value={hotSources}
                  disabled={readOnly}
                  onChange={(e) => setHotSources(e.target.value)}
                  placeholder="ads_form, callback_request"
                />
              </FormField>
              <FormField label="Tags" hint="Phân tách bằng dấu phẩy">
                <FormInput
                  value={hotTags}
                  disabled={readOnly}
                  onChange={(e) => setHotTags(e.target.value)}
                  placeholder="hot, goi_gap"
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection className="page-card" title="5. Redistribute">
            <FormGrid cols={3}>
              <FormField label="Chiến lược gán">
                <FormSelect
                  value={draft.redistribute.strategy}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      redistribute: {
                        ...p.redistribute,
                        strategy: e.target
                          .value as LeadSlaSettingsPayload['redistribute']['strategy'],
                      },
                    }))
                  }
                >
                  <option value="round_robin_least_open">Round-robin · ít open nhất</option>
                  <option value="manual_only">Chỉ gán tay (manual)</option>
                </FormSelect>
              </FormField>
              <FormField label="Queue max wait (WH)">
                <FormInput
                  type="number"
                  value={draft.redistribute.assign_queue_max_wait_working_hours}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      redistribute: {
                        ...p.redistribute,
                        assign_queue_max_wait_working_hours: num(
                          e.target.value,
                          p.redistribute.assign_queue_max_wait_working_hours,
                        ),
                      },
                    }))
                  }
                />
              </FormField>
              <FormField label="Max open attempting / AM">
                <FormInput
                  type="number"
                  value={draft.redistribute.max_open_attempting_per_am}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      redistribute: {
                        ...p.redistribute,
                        max_open_attempting_per_am: num(
                          e.target.value,
                          p.redistribute.max_open_attempting_per_am,
                        ),
                      },
                    }))
                  }
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection className="page-card" title="6. Phạm vi pipeline">
            <FormField
              label="Stages áp dụng SLA"
              hint={`Gợi ý: ${STAGE_OPTIONS.join(', ')}`}
              fullWidth
            >
              <FormInput
                value={stagesText}
                disabled={readOnly}
                onChange={(e) => setStagesText(e.target.value)}
              />
            </FormField>
          </FormSection>

          <FormSection className="page-card" title="7. Feature flags">
            <FormGrid cols={2}>
              <FormCheck label="Dry-run reassign (ghi event, không đổi AM)">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={draft.feature_flags.lead_sla_reassign_dry_run}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      feature_flags: {
                        ...p.feature_flags,
                        lead_sla_reassign_dry_run: e.target.checked,
                      },
                    }))
                  }
                />
              </FormCheck>
              <FormCheck label="Bật live reassign">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={draft.feature_flags.lead_sla_reassign_enabled}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      feature_flags: {
                        ...p.feature_flags,
                        lead_sla_reassign_enabled: e.target.checked,
                      },
                    }))
                  }
                />
              </FormCheck>
              <FormCheck label="Cho phép reassign khi 1a timeout">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={draft.feature_flags.reassign_on_1a_timeout}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      feature_flags: {
                        ...p.feature_flags,
                        reassign_on_1a_timeout: e.target.checked,
                      },
                    }))
                  }
                />
              </FormCheck>
              {isSuperAdmin ? (
                <FormCheck label="Cho phép Recalc hold (SUPER)">
                  <input
                    type="checkbox"
                    checked={draft.feature_flags.allow_hold_recalc}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        feature_flags: {
                          ...p.feature_flags,
                          allow_hold_recalc: e.target.checked,
                        },
                      }))
                    }
                  />
                </FormCheck>
              ) : null}
              <FormField label="Min ngày dry-run trước khi bật live">
                <FormInput
                  type="number"
                  value={draft.feature_flags.min_dry_run_days}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      feature_flags: {
                        ...p.feature_flags,
                        min_dry_run_days: num(e.target.value, p.feature_flags.min_dry_run_days),
                      },
                    }))
                  }
                />
              </FormField>
              <FormField label="Dry-run bắt đầu">
                <FormInput
                  value={
                    draft.feature_flags.dry_run_started_at
                      ? new Date(draft.feature_flags.dry_run_started_at).toLocaleString('vi-VN')
                      : '—'
                  }
                  disabled
                />
              </FormField>
            </FormGrid>
          </FormSection>

          {canEdit && data?.pool?.length ? (
            <FormSection className="page-card" title="8. Staff pool (accepts_leads)">
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Title</th>
                      <th>Open attempting</th>
                      <th>Nhận lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pool.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.job_title || '—'}</td>
                        <td>{s.open_attempting}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={s.accepts_leads}
                            disabled={busy}
                            onChange={(e) => void onToggleAccepts(s.id, e.target.checked)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FormSection>
          ) : null}
        </Form>

        <aside className="lead-sla-admin-side">
          <section className="page-card">
            <h2 className="form-section-title">Tóm tắt hiện tại</h2>
            <dl className="lead-sla-admin-dl">
              <div>
                <dt>FR1</dt>
                <dd>{draft.fr1_hours}h LV</dd>
              </div>
              <div>
                <dt>Kênh</dt>
                <dd>{draft.fr1_channels.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>1b</dt>
                <dd>
                  {draft.case_1b.max_working_days} WD · {draft.case_1b.min_attempts} calls
                </dd>
              </div>
              <div>
                <dt>Reassign</dt>
                <dd>
                  {draft.feature_flags.lead_sla_reassign_enabled
                    ? 'LIVE'
                    : draft.feature_flags.lead_sla_reassign_dry_run
                      ? 'Dry-run'
                      : 'Off'}
                </dd>
              </div>
              <div>
                <dt>Pool nhận lead</dt>
                <dd>{data?.pool?.filter((p) => p.accepts_leads).length ?? 0}</dd>
              </div>
            </dl>
          </section>

          <section className="page-card">
            <h2 className="form-section-title">9. Lịch sử revision</h2>
            <ul className="lead-sla-admin-revisions">
              {revisions.map((rev) => (
                <li key={rev.id}>
                  <div>
                    <strong>v{rev.settings_version}</strong>
                    <span className="muted">
                      {' '}
                      · {rev.action} · {rev.actor}
                    </span>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {new Date(rev.created_at).toLocaleString('vi-VN')}
                    </div>
                    <div style={{ fontSize: 13 }}>{rev.note}</div>
                  </div>
                  {canPublish ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => void onRollback(rev)}
                    >
                      Rollback
                    </button>
                  ) : null}
                </li>
              ))}
              {!revisions.length ? <li className="muted">Chưa có revision</li> : null}
            </ul>
          </section>
        </aside>
      </div>

      {showPublish ? (
        <div className="lead-sla-admin-modal" role="dialog" aria-modal="true">
          <div className="page-card lead-sla-admin-modal__body">
            <h2 className="form-section-title">Publish SLA settings</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Preview impact (§16.6)
            </p>
            <ul>
              {previewLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <FormField label="Note" hint="Tối thiểu 10 ký tự" required>
              <FormTextarea
                rows={3}
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
              />
            </FormField>
            {isSuperAdmin && draft.feature_flags.lead_sla_reassign_enabled ? (
              <FormCheck label="SUPER-ADMIN override dry_run gate">
                <input
                  type="checkbox"
                  checked={overrideDryRun}
                  onChange={(e) => setOverrideDryRun(e.target.checked)}
                />
              </FormCheck>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowPublish(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void onPublish()}
              >
                Confirm publish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .lead-sla-admin-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 1rem;
          align-items: start;
        }
        @media (min-width: 1100px) {
          .lead-sla-admin-layout {
            grid-template-columns: minmax(0, 1fr) 300px;
          }
        }
        .lead-sla-admin-main {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 0;
        }
        .lead-sla-admin-main.is-readonly :global(.page-card) {
          opacity: 0.92;
        }
        .lead-sla-admin-side {
          display: grid;
          gap: 1rem;
          position: sticky;
          top: 0.75rem;
        }
        .lead-sla-admin-subhead {
          margin: 1rem 0 0.65rem;
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .lead-sla-admin-subhead:first-child {
          margin-top: 0;
        }
        .lead-sla-admin-dl {
          margin: 0;
          display: grid;
          gap: 0.55rem;
        }
        .lead-sla-admin-dl div {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 0.875rem;
        }
        .lead-sla-admin-dl dt {
          color: var(--muted);
        }
        .lead-sla-admin-dl dd {
          margin: 0;
          font-weight: 600;
          text-align: right;
        }
        .lead-sla-admin-revisions {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.65rem;
          max-height: 420px;
          overflow: auto;
        }
        .lead-sla-admin-revisions li {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          padding-bottom: 0.65rem;
          border-bottom: 1px solid var(--surface-border);
        }
        .lead-sla-admin-modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 36, 24, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1rem;
        }
        .lead-sla-admin-modal__body {
          width: min(520px, 100%);
          max-height: 90vh;
          overflow: auto;
        }
      `}</style>
    </StaffPageShell>
  );
}
