'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchStaffRoster, type StaffRosterRow } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import {
  cancelAmDelegation,
  cloneAmOnboardingTemplate,
  createAmDelegation,
  createAmField,
  createAmOnboardingTemplate,
  createAmSlaPolicy,
  fetchAmDelegations,
  fetchAmFields,
  fetchAmOnboardingTemplates,
  fetchAmSettings,
  fetchAmSlaPolicies,
  patchAmField,
  patchAmOnboardingTemplate,
  patchAmSlaPolicy,
  publishAmField,
  publishAmOnboardingTemplate,
  putAmSettings,
  type AmCustomField,
  type AmDelegation,
  type AmOnboardingTemplate,
  type AmOnboardingTemplateItem,
  type AmSettings as AmSettingsData,
  type AmSlaPolicy,
} from '@/lib/crm/am-api';
import { amDelegationErrorCopy, amDelegationFormError } from '@/lib/crm/am-delegation.util';
import { amOnboardingDash } from '@/lib/crm/am-onboarding.util';
import {
  AM_BDS_FIELD_TEMPLATES,
  AM_FIELD_TYPES,
  AM_SLA_DEFAULTS,
  amApiKeyError,
  amEscalateFromInputs,
  amHolidayText,
  amParseAccessJson,
  amParseHolidays,
  amSettingsBandsError,
  amSettingsPublishErrorCopy,
  amSettingsWeightsError,
} from '@/lib/crm/am-settings.util';
import { useAmPage } from './AmShell';

const WEIGHT_FIELDS: Array<{ key: keyof AmSettingsData['weights']; label: string }> = [
  { key: 'kpi_delivery', label: 'KPI / Delivery' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'financial', label: 'Financial' },
  { key: 'satisfaction', label: 'Satisfaction' },
  { key: 'contract_support', label: 'Contract / Support' },
];

const BAND_FIELDS: Array<{ key: keyof AmSettingsData['bands']; label: string }> = [
  { key: 'healthy', label: 'Healthy' },
  { key: 'watch', label: 'Watch' },
  { key: 'at_risk', label: 'At risk' },
  { key: 'critical', label: 'Critical' },
];

function emptyItem(): AmOnboardingTemplateItem {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    kind: 'checklist',
    phase: '',
    title: '',
    owner_role: '',
    due_offset_days: 0,
    required: false,
  };
}

function statusClass(status: AmOnboardingTemplate['status']): string {
  return status === 'published' ? 'am-pill am-pill--ok' : 'am-pill am-pill--watch';
}

type FieldDraft = {
  id?: string;
  label: string;
  api_key: string;
  field_type: AmCustomField['field_type'];
  industry_slug: string;
  required: boolean;
  filterable: boolean;
  reportable: boolean;
  min: string;
  max: string;
  access_json: string;
  published: boolean;
};

type SlaDraft = {
  id?: string;
  name: string;
  first_response_minutes: string;
  resolve_minutes: string;
  pause_on_waiting_client: boolean;
  escalate70: string;
  escalate90: string;
  escalate100: string;
  workday_start: string;
  workday_end: string;
  holidays: string;
};

function emptyFieldDraft(): FieldDraft {
  return {
    label: '',
    api_key: '',
    field_type: 'text',
    industry_slug: '',
    required: false,
    filterable: false,
    reportable: false,
    min: '',
    max: '',
    access_json: '',
    published: false,
  };
}

function fieldToDraft(row: AmCustomField): FieldDraft {
  return {
    id: row.id,
    label: row.label,
    api_key: row.api_key,
    field_type: row.field_type,
    industry_slug: row.industry_slug ?? '',
    required: row.required,
    filterable: row.filterable,
    reportable: row.reportable,
    min: row.constraints_json?.min != null ? String(row.constraints_json.min) : '',
    max: row.constraints_json?.max != null ? String(row.constraints_json.max) : '',
    access_json: row.access_json ? JSON.stringify(row.access_json, null, 2) : '',
    published: row.published,
  };
}

function emptySlaDraft(): SlaDraft {
  return {
    name: '',
    first_response_minutes: '60',
    resolve_minutes: '480',
    pause_on_waiting_client: AM_SLA_DEFAULTS.pause_on_waiting_client,
    escalate70: AM_SLA_DEFAULTS.escalate_json['70'],
    escalate90: AM_SLA_DEFAULTS.escalate_json['90'],
    escalate100: AM_SLA_DEFAULTS.escalate_json['100'],
    workday_start: AM_SLA_DEFAULTS.workday_start,
    workday_end: AM_SLA_DEFAULTS.workday_end,
    holidays: '',
  };
}

function slaToDraft(row: AmSlaPolicy): SlaDraft {
  return {
    id: row.id,
    name: row.name,
    first_response_minutes: String(row.first_response_minutes),
    resolve_minutes: String(row.resolve_minutes),
    pause_on_waiting_client: row.pause_on_waiting_client,
    escalate70: row.escalate_json['70'] ?? 'lead',
    escalate90: row.escalate_json['90'] ?? 'director',
    escalate100: row.escalate_json['100'] ?? 'executive',
    workday_start: row.workday_start,
    workday_end: row.workday_end,
    holidays: amHolidayText(row.holidays),
  };
}

export function AmSettings() {
  const { token, user, canEdit } = useAmPage();
  const canManage = hasCap(user, 'crm_am', 'manage');
  const canDelegate = canEdit || canManage;
  const [items, setItems] = useState<AmOnboardingTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<AmOnboardingTemplateItem[]>([]);
  const [draftName, setDraftName] = useState('');
  const [createName, setCreateName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<AmSettingsData | null>(null);
  const [draftWeights, setDraftWeights] = useState<AmSettingsData['weights'] | null>(null);
  const [draftBands, setDraftBands] = useState<AmSettingsData['bands'] | null>(null);
  const [scorecardError, setScorecardError] = useState('');
  const [scorecardBusy, setScorecardBusy] = useState(false);
  const [fields, setFields] = useState<AmCustomField[]>([]);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [fieldBusy, setFieldBusy] = useState(false);
  const [slaPolicies, setSlaPolicies] = useState<AmSlaPolicy[]>([]);
  const [slaDraft, setSlaDraft] = useState<SlaDraft | null>(null);
  const [slaError, setSlaError] = useState('');
  const [slaBusy, setSlaBusy] = useState(false);
  const [delegations, setDelegations] = useState<AmDelegation[]>([]);
  const [delegationRoster, setDelegationRoster] = useState<StaffRosterRow[]>([]);
  const [fromStaffId, setFromStaffId] = useState('');
  const [toStaffId, setToStaffId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [delegationReason, setDelegationReason] = useState('');
  const [delegationError, setDelegationError] = useState('');
  const [delegationBusy, setDelegationBusy] = useState(false);

  const selected = items.find((row) => row.id === selectedId) ?? null;
  const published = selected?.status === 'published';
  const canEditDraft = Boolean(canManage && selected && !published);
  const dirty = useMemo(() => {
    if (!selected) return false;
    if (draftName !== selected.name) return true;
    return JSON.stringify(draftItems) !== JSON.stringify(selected.items);
  }, [selected, draftName, draftItems]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const out = await fetchAmOnboardingTemplates(token);
      setItems(out.items);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError ? err.message : 'Không tải được template.');
    }
    try {
      const scorecard = await fetchAmSettings(token);
      setSettings(scorecard);
      setDraftWeights(scorecard.weights);
      setDraftBands(scorecard.bands);
    } catch (err) {
      setScorecardError(err instanceof ApiError ? err.message : 'Không tải được scorecard.');
    }
    try {
      const [fieldOut, slaOut] = await Promise.all([fetchAmFields(token), fetchAmSlaPolicies(token)]);
      setFields(fieldOut.items);
      setSlaPolicies(slaOut.items);
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Không tải được trường / SLA.');
    }
    try {
      const [delOut, rosterOut] = await Promise.all([
        fetchAmDelegations(token),
        canDelegate ? fetchStaffRoster(token) : Promise.resolve({ staff: [] as StaffRosterRow[] }),
      ]);
      setDelegations(delOut.items);
      setDelegationRoster(rosterOut.staff ?? []);
    } catch (err) {
      setDelegationError(err instanceof ApiError ? err.message : 'Không tải được ủy quyền.');
    } finally {
      setLoading(false);
    }
  }, [canDelegate, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDraftItems([]);
      setDraftName('');
      return;
    }
    setDraftItems(selected.items);
    setDraftName(selected.name);
  }, [selected]);

  function selectRow(row: AmOnboardingTemplate) {
    setSelectedId(row.id);
  }

  async function onCreate() {
    if (!token || !canManage || busy) return;
    const name = createName.trim();
    if (!name) {
      setError('Cần tên template.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createAmOnboardingTemplate(token, { name, items: [] });
      setItems((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được template.');
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!token || !selected || !canEditDraft || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await patchAmOnboardingTemplate(token, selected.id, {
        name: draftName.trim() || selected.name,
        items: draftItems,
      });
      setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    } catch (err) {
      setError(
        err instanceof ApiError && err.message === 'template_published'
          ? 'Template đã xuất bản — nhân bản thành draft để sửa.'
          : err instanceof ApiError
            ? err.message
            : 'Không lưu được template.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!token || !selected || !canEditDraft || busy) return;
    setBusy(true);
    setError('');
    try {
      if (dirty) {
        const saved = await patchAmOnboardingTemplate(token, selected.id, {
          name: draftName.trim() || selected.name,
          items: draftItems,
        });
        setItems((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      }
      const next = await publishAmOnboardingTemplate(token, selected.id);
      setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    } catch (err) {
      setError(
        err instanceof ApiError && err.message === 'template_published'
          ? 'Template đã xuất bản — nhân bản thành draft để sửa.'
          : err instanceof ApiError
            ? err.message
            : 'Không xuất bản được.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onPublishScorecard() {
    if (!token || !canManage || !draftWeights || !draftBands || scorecardBusy) return;
    const weightsCode = amSettingsWeightsError(draftWeights);
    if (weightsCode) {
      setScorecardError(amSettingsPublishErrorCopy(weightsCode));
      return;
    }
    const bandsCode = amSettingsBandsError(draftBands);
    if (bandsCode) {
      setScorecardError(amSettingsPublishErrorCopy(bandsCode));
      return;
    }
    setScorecardBusy(true);
    setScorecardError('');
    try {
      const next = await putAmSettings(token, {
        weights: draftWeights,
        bands: draftBands,
        quota_accounts_per_am: settings?.quota_accounts_per_am,
        watch_ends_on_days: settings?.watch_ends_on_days,
        health_drop_alert: settings?.health_drop_alert,
        rollup_parent_health: settings?.rollup_parent_health,
      });
      setSettings(next);
      setDraftWeights(next.weights);
      setDraftBands(next.bands);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : '';
      setScorecardError(
        code === 'weights_sum' || code === 'bands_overlap'
          ? amSettingsPublishErrorCopy(code)
          : err instanceof ApiError
            ? err.message
            : 'Không xuất bản được scorecard.',
      );
    } finally {
      setScorecardBusy(false);
    }
  }

  async function onSaveField() {
    if (!token || !canManage || !fieldDraft || fieldBusy) return;
    if (!fieldDraft.label.trim() || amApiKeyError(fieldDraft.api_key)) {
      setFieldError('Cần label và api_key dạng project_name.');
      return;
    }
    const access = amParseAccessJson(fieldDraft.access_json);
    if (!access.ok) {
      setFieldError('access JSON không hợp lệ.');
      return;
    }
    const constraints =
      fieldDraft.min !== '' || fieldDraft.max !== ''
        ? {
            min: fieldDraft.min === '' ? undefined : Number(fieldDraft.min),
            max: fieldDraft.max === '' ? undefined : Number(fieldDraft.max),
          }
        : null;
    const body = {
      label: fieldDraft.label.trim(),
      api_key: fieldDraft.api_key.trim(),
      field_type: fieldDraft.field_type,
      industry_slug: fieldDraft.industry_slug.trim() || null,
      required: fieldDraft.required,
      filterable: fieldDraft.filterable,
      reportable: fieldDraft.reportable,
      access_json: access.value as AmCustomField['access_json'],
      constraints_json: constraints,
    };
    setFieldBusy(true);
    setFieldError('');
    try {
      const next = fieldDraft.id
        ? await patchAmField(token, fieldDraft.id, body)
        : await createAmField(token, body);
      setFields((prev) => {
        const others = prev.filter((row) => row.id !== next.id);
        return [next, ...others];
      });
      setFieldDraft(fieldToDraft(next));
    } catch (err) {
      setFieldError(
        err instanceof ApiError && err.message === 'api_key_immutable'
          ? 'api_key đã xuất bản — không đổi được.'
          : err instanceof ApiError
            ? err.message
            : 'Không lưu được trường.',
      );
    } finally {
      setFieldBusy(false);
    }
  }

  async function onPublishField() {
    if (!token || !canManage || !fieldDraft?.id || fieldDraft.published || fieldBusy) return;
    setFieldBusy(true);
    setFieldError('');
    try {
      const next = await publishAmField(token, fieldDraft.id);
      setFields((prev) => prev.map((row) => (row.id === next.id ? next : row)));
      setFieldDraft(fieldToDraft(next));
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Không xuất bản được trường.');
    } finally {
      setFieldBusy(false);
    }
  }

  async function onSeedBds() {
    if (!token || !canManage || fieldBusy) return;
    const existing = new Set(fields.filter((row) => row.industry_slug === 'bds').map((row) => row.api_key));
    if (existing.size > 0) {
      setFieldError('Đã có trường BĐS — không ghi đè.');
      return;
    }
    setFieldBusy(true);
    setFieldError('');
    try {
      const created: AmCustomField[] = [];
      for (const tmpl of AM_BDS_FIELD_TEMPLATES) {
        created.push(
          await createAmField(token, {
            label: tmpl.label,
            api_key: tmpl.api_key,
            field_type: tmpl.field_type,
            industry_slug: tmpl.industry_slug,
          }),
        );
      }
      setFields((prev) => [...created, ...prev]);
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : 'Không thêm được mẫu BĐS.');
    } finally {
      setFieldBusy(false);
    }
  }

  async function onSaveSla() {
    if (!token || !canManage || !slaDraft || slaBusy) return;
    const first = Number(slaDraft.first_response_minutes);
    const resolve = Number(slaDraft.resolve_minutes);
    if (!slaDraft.name.trim() || !Number.isInteger(first) || !Number.isInteger(resolve)) {
      setSlaError('Cần tên và số phút nguyên.');
      return;
    }
    const body = {
      name: slaDraft.name.trim(),
      first_response_minutes: first,
      resolve_minutes: resolve,
      pause_on_waiting_client: slaDraft.pause_on_waiting_client,
      escalate_json: amEscalateFromInputs(slaDraft.escalate70, slaDraft.escalate90, slaDraft.escalate100),
      workday_start: slaDraft.workday_start || AM_SLA_DEFAULTS.workday_start,
      workday_end: slaDraft.workday_end || AM_SLA_DEFAULTS.workday_end,
      workdays: AM_SLA_DEFAULTS.workdays,
      holidays: amParseHolidays(slaDraft.holidays),
    };
    setSlaBusy(true);
    setSlaError('');
    try {
      const next = slaDraft.id
        ? await patchAmSlaPolicy(token, slaDraft.id, body)
        : await createAmSlaPolicy(token, body);
      setSlaPolicies((prev) => {
        const others = prev.filter((row) => row.id !== next.id);
        return [next, ...others];
      });
      setSlaDraft(slaToDraft(next));
    } catch (err) {
      setSlaError(err instanceof ApiError ? err.message : 'Không lưu được SLA.');
    } finally {
      setSlaBusy(false);
    }
  }

  function staffOptionLabel(row: StaffRosterRow): string {
    return row.display_name || row.email;
  }

  async function onCreateDelegation() {
    if (!token || !canDelegate || delegationBusy) return;
    const to = Number(toStaffId);
    const from = canManage && fromStaffId ? Number(fromStaffId) : undefined;
    const code = amDelegationFormError({
      from_staff_id: from,
      to_staff_id: to,
      starts_on: startsOn,
      ends_on: endsOn,
    });
    if (code) {
      setDelegationError(amDelegationErrorCopy(code));
      return;
    }
    setDelegationBusy(true);
    setDelegationError('');
    try {
      const created = await createAmDelegation(token, {
        ...(from ? { from_staff_id: from } : {}),
        to_staff_id: to,
        starts_on: startsOn,
        ends_on: endsOn,
        reason: delegationReason.trim() || undefined,
      });
      setDelegations((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
      setToStaffId('');
      setStartsOn('');
      setEndsOn('');
      setDelegationReason('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không tạo được ủy quyền.';
      setDelegationError(amDelegationErrorCopy(msg));
    } finally {
      setDelegationBusy(false);
    }
  }

  async function onCancelDelegation(id: string) {
    if (!token || !canDelegate || delegationBusy) return;
    setDelegationBusy(true);
    setDelegationError('');
    try {
      await cancelAmDelegation(token, id);
      setDelegations((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không hủy được ủy quyền.';
      setDelegationError(amDelegationErrorCopy(msg));
    } finally {
      setDelegationBusy(false);
    }
  }

  async function onClone() {
    if (!token || !selected || !canManage || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await cloneAmOnboardingTemplate(token, selected.id);
      setItems((prev) => [next, ...prev].sort((a, b) => b.version - a.version));
      setSelectedId(next.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không nhân bản được.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="am-page">
      <p className="am-crumb">Account Management / Cấu hình</p>
      <header className="am-360__head">
        <div>
          <h1>Cấu hình / Onboarding templates</h1>
          <p className="am-muted">Published không sửa được — nhân bản thành draft.</p>
        </div>
        {canManage ? (
          <div className="am-form__actions">
            <input
              className="am-onboard__name"
              value={createName}
              onChange={(ev) => setCreateName(ev.target.value)}
              placeholder="Tên template"
            />
            <button type="button" className="am-btn am-btn--primary" disabled={busy} onClick={() => void onCreate()}>
              + Tạo template
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="am-banner">{error}</p> : null}

      <div className="am-widget">
        <div className="am-widget__head">
          <h2>Ủy quyền khi nghỉ</h2>
        </div>
        {delegationError ? <p className="am-banner">{delegationError}</p> : null}
        {canDelegate ? (
          <div className="am-form">
            <label className="am-field">
              <span>Từ</span>
              {canManage ? (
                <select
                  value={fromStaffId}
                  onChange={(ev) => setFromStaffId(ev.target.value)}
                  aria-label="AM ủy quyền"
                >
                  <option value="">Tôi</option>
                  {delegationRoster.map((row) => (
                    <option key={row.id} value={row.id}>
                      {staffOptionLabel(row)}
                      {row.email && row.display_name !== row.email ? ` · ${row.email}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>Tôi</strong>
              )}
            </label>
            <label className="am-field">
              <span>Đến</span>
              <select
                value={toStaffId}
                onChange={(ev) => setToStaffId(ev.target.value)}
                aria-label="AM nhận ủy quyền"
              >
                <option value="">Chọn AM</option>
                {delegationRoster.map((row) => (
                  <option key={row.id} value={row.id}>
                    {staffOptionLabel(row)}
                    {row.email && row.display_name !== row.email ? ` · ${row.email}` : ''}
                  </option>
                ))}
              </select>
              <input
                inputMode="numeric"
                value={toStaffId}
                onChange={(ev) => setToStaffId(ev.target.value.trim())}
                placeholder="crm_staff ID"
                aria-label="crm_staff ID người nhận"
              />
            </label>
            <div className="am-split">
              <label className="am-field">
                <span>Từ ngày</span>
                <input type="date" value={startsOn} onChange={(ev) => setStartsOn(ev.target.value)} />
              </label>
              <label className="am-field">
                <span>Đến ngày</span>
                <input type="date" value={endsOn} onChange={(ev) => setEndsOn(ev.target.value)} />
              </label>
            </div>
            <label className="am-field">
              <span>Lý do</span>
              <input
                value={delegationReason}
                onChange={(ev) => setDelegationReason(ev.target.value)}
                placeholder="Nghỉ phép, công tác…"
              />
            </label>
            <div className="am-form__actions">
              <button
                type="button"
                className="am-btn am-btn--primary"
                disabled={delegationBusy}
                onClick={() => void onCreateDelegation()}
              >
                Tạo ủy quyền
              </button>
            </div>
          </div>
        ) : (
          <p className="am-muted">Cần quyền edit để tạo ủy quyền.</p>
        )}
        <table className="am-table">
          <thead>
            <tr>
              <th>Từ</th>
              <th>Đến</th>
              <th>Khoảng</th>
              <th>Lý do</th>
              {canDelegate ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {delegations.length === 0 ? (
              <tr>
                <td colSpan={canDelegate ? 5 : 4} className="am-muted">
                  —
                </td>
              </tr>
            ) : (
              delegations.map((row) => (
                <tr key={row.id}>
                  <td>{row.from_staff_id}</td>
                  <td>{row.to_staff_id}</td>
                  <td>
                    {row.starts_on}–{row.ends_on}
                  </td>
                  <td>{row.reason || '—'}</td>
                  {canDelegate ? (
                    <td>
                      <button
                        type="button"
                        className="am-link"
                        disabled={delegationBusy}
                        onClick={() => void onCancelDelegation(row.id)}
                      >
                        Hủy sớm
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="am-widget">
        <div className="am-widget__head">
          <h2>Scorecard</h2>
          <span className="am-muted">v{settings?.scorecard_version ?? 1}</span>
        </div>
        {scorecardError ? <p className="am-banner">{scorecardError}</p> : null}
        <div className="am-scorecard">
          <div>
            <p className="am-muted">Trọng số (tổng 100)</p>
            <div className="am-scorecard__grid">
              {WEIGHT_FIELDS.map((field) => (
                <label key={field.key} className="am-field">
                  <span>{field.label}</span>
                  {canManage && draftWeights ? (
                    <input
                      type="number"
                      value={draftWeights[field.key]}
                      onChange={(ev) =>
                        setDraftWeights((prev) =>
                          prev ? { ...prev, [field.key]: Number(ev.target.value) } : prev,
                        )
                      }
                    />
                  ) : (
                    <strong>{draftWeights?.[field.key] ?? '—'}</strong>
                  )}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="am-muted">Ngưỡng band (0–100, không chồng)</p>
            <div className="am-scorecard__grid">
              {BAND_FIELDS.map((field) => (
                <label key={field.key} className="am-field">
                  <span>{field.label}</span>
                  {canManage && draftBands ? (
                    <span className="am-scorecard__pair">
                      <input
                        type="number"
                        value={draftBands[field.key][0]}
                        onChange={(ev) =>
                          setDraftBands((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  [field.key]: [Number(ev.target.value), prev[field.key][1]],
                                }
                              : prev,
                          )
                        }
                      />
                      <input
                        type="number"
                        value={draftBands[field.key][1]}
                        onChange={(ev) =>
                          setDraftBands((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  [field.key]: [prev[field.key][0], Number(ev.target.value)],
                                }
                              : prev,
                          )
                        }
                      />
                    </span>
                  ) : (
                    <strong>
                      {draftBands
                        ? `${draftBands[field.key][0]}–${draftBands[field.key][1]}`
                        : '—'}
                    </strong>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
        {canManage ? (
          <div className="am-form__actions">
            <button
              type="button"
              className="am-btn am-btn--primary"
              disabled={scorecardBusy || !draftWeights}
              onClick={() => void onPublishScorecard()}
            >
              Xuất bản scorecard
            </button>
          </div>
        ) : null}
      </div>

      <div className="am-widget am-m01-admin">
        <div className="am-widget__head">
          <h2>Custom fields</h2>
          {canManage ? (
            <div className="am-form__actions">
              <button type="button" className="am-btn" disabled={fieldBusy} onClick={() => void onSeedBds()}>
                Thêm mẫu BĐS
              </button>
              <button
                type="button"
                className="am-btn am-btn--primary"
                onClick={() => {
                  setFieldDraft(emptyFieldDraft());
                  setFieldError('');
                }}
              >
                + Trường
              </button>
            </div>
          ) : null}
        </div>
        {fieldError ? <p className="am-banner">{fieldError}</p> : null}
        <table className="am-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>api_key</th>
              <th>Type</th>
              <th>Ngành</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={5} className="am-muted">
                  Chưa có trường. Thêm mẫu BĐS để có project_name / leads_per_month (draft, chưa xuất bản).
                </td>
              </tr>
            ) : (
              fields.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      type="button"
                      className="am-link"
                      onClick={() => {
                        setFieldDraft(fieldToDraft(row));
                        setFieldError('');
                      }}
                    >
                      {row.label}
                    </button>
                  </td>
                  <td>
                    <code>{row.api_key}</code>
                  </td>
                  <td>{row.field_type}</td>
                  <td>{row.industry_slug || '—'}</td>
                  <td>
                    <span className={row.published ? 'am-pill am-pill--ok' : 'am-pill am-pill--watch'}>
                      {row.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="am-widget">
        <div className="am-widget__head">
          <h2>SLA policy</h2>
          {canManage ? (
            <button
              type="button"
              className="am-btn am-btn--primary"
              onClick={() => {
                setSlaDraft(emptySlaDraft());
                setSlaError('');
              }}
            >
              + Policy
            </button>
          ) : null}
        </div>
        {slaError ? <p className="am-banner">{slaError}</p> : null}
        <table className="am-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>First (phút)</th>
              <th>Resolve (phút)</th>
              <th>Giờ</th>
              <th>Holidays</th>
            </tr>
          </thead>
          <tbody>
            {slaPolicies.length === 0 ? (
              <tr>
                <td colSpan={5} className="am-muted">
                  Chưa có policy. Mặc định 08:30–17:30, T2–T6, escalate 70/90/100.
                </td>
              </tr>
            ) : (
              slaPolicies.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      type="button"
                      className="am-link"
                      onClick={() => {
                        setSlaDraft(slaToDraft(row));
                        setSlaError('');
                      }}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td>{row.first_response_minutes}</td>
                  <td>{row.resolve_minutes}</td>
                  <td>
                    {row.workday_start}–{row.workday_end}
                  </td>
                  <td>{row.holidays.length ? row.holidays.join(', ') : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="am-widget">
        <table className="am-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="am-muted">
                  Đang tải…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="am-muted">
                  —
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className={row.id === selectedId ? 'is-on' : undefined}>
                  <td>
                    <button type="button" className="am-link" onClick={() => selectRow(row)}>
                      {row.name || '—'}
                    </button>
                  </td>
                  <td>v{row.version}</td>
                  <td>
                    <span className={statusClass(row.status)}>{row.status === 'published' ? 'Published' : 'Draft'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="am-widget">
          <div className="am-widget__head">
            <h2>
              {canEditDraft ? (
                <input
                  className="am-onboard__name"
                  value={draftName}
                  onChange={(ev) => setDraftName(ev.target.value)}
                />
              ) : (
                selected.name
              )}{' '}
              <span className={statusClass(selected.status)}>
                {selected.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </h2>
            <div className="am-form__actions">
              {canManage && published ? (
                <button type="button" className="am-btn" disabled={busy} onClick={() => void onClone()}>
                  Nhân bản thành draft
                </button>
              ) : null}
              {canEditDraft ? (
                <>
                  <button
                    type="button"
                    className="am-btn"
                    onClick={() => setDraftItems((prev) => [...prev, emptyItem()])}
                  >
                    + Hạng mục
                  </button>
                  <button type="button" className="am-btn" disabled={busy} onClick={() => void onSave()}>
                    Lưu
                  </button>
                  <button
                    type="button"
                    className="am-btn am-btn--primary"
                    disabled={busy}
                    onClick={() => void onPublish()}
                  >
                    Xuất bản
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <table className="am-table">
            <thead>
              <tr>
                <th>Giai đoạn</th>
                <th>Hạng mục</th>
                <th>Owner mặc định</th>
                <th>Hạn (T+n)</th>
                <th>Required</th>
                {canEditDraft ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {draftItems.length === 0 ? (
                <tr>
                  <td colSpan={canEditDraft ? 6 : 5} className="am-muted">
                    —
                  </td>
                </tr>
              ) : (
                draftItems.map((item, index) => (
                  <tr key={item.id || index}>
                    <td>
                      {canEditDraft ? (
                        <input
                          value={item.phase}
                          onChange={(ev) =>
                            setDraftItems((prev) =>
                              prev.map((row) => (row.id === item.id ? { ...row, phase: ev.target.value } : row)),
                            )
                          }
                        />
                      ) : (
                        amOnboardingDash(item.phase)
                      )}
                    </td>
                    <td>
                      {canEditDraft ? (
                        <span className="am-onboard__item-edit">
                          <select
                            value={item.kind}
                            onChange={(ev) =>
                              setDraftItems((prev) =>
                                prev.map((row) =>
                                  row.id === item.id
                                    ? { ...row, kind: ev.target.value === 'milestone' ? 'milestone' : 'checklist' }
                                    : row,
                                ),
                              )
                            }
                          >
                            <option value="checklist">Checklist</option>
                            <option value="milestone">Milestone</option>
                          </select>
                          <input
                            value={item.title}
                            onChange={(ev) =>
                              setDraftItems((prev) =>
                                prev.map((row) => (row.id === item.id ? { ...row, title: ev.target.value } : row)),
                              )
                            }
                          />
                        </span>
                      ) : (
                        amOnboardingDash(item.title)
                      )}
                    </td>
                    <td>
                      {canEditDraft ? (
                        <input
                          value={item.owner_role}
                          onChange={(ev) =>
                            setDraftItems((prev) =>
                              prev.map((row) => (row.id === item.id ? { ...row, owner_role: ev.target.value } : row)),
                            )
                          }
                        />
                      ) : (
                        amOnboardingDash(item.owner_role)
                      )}
                    </td>
                    <td>
                      {canEditDraft ? (
                        <input
                          type="number"
                          value={item.due_offset_days}
                          onChange={(ev) =>
                            setDraftItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, due_offset_days: Number(ev.target.value) || 0 }
                                  : row,
                              ),
                            )
                          }
                        />
                      ) : (
                        `T+${item.due_offset_days}`
                      )}
                    </td>
                    <td>
                      {canEditDraft ? (
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(ev) =>
                            setDraftItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id ? { ...row, required: ev.target.checked } : row,
                              ),
                            )
                          }
                        />
                      ) : item.required ? (
                        '✓'
                      ) : (
                        '—'
                      )}
                    </td>
                    {canEditDraft ? (
                      <td>
                        <button
                          type="button"
                          className="am-link"
                          onClick={() => setDraftItems((prev) => prev.filter((row) => row.id !== item.id))}
                        >
                          Xóa
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {fieldDraft ? (
        <div className="am-drawer-bg" onClick={() => setFieldDraft(null)}>
          <aside className="am-drawer" onClick={(ev) => ev.stopPropagation()}>
            <div className="am-drawer__head">
              <h2>{fieldDraft.id ? 'Sửa trường' : 'Trường mới'}</h2>
              <button type="button" className="am-link" onClick={() => setFieldDraft(null)}>
                Đóng
              </button>
            </div>
            <div className="am-form">
              <label className="am-field">
                <span>Label</span>
                <input
                  value={fieldDraft.label}
                  disabled={!canManage}
                  onChange={(ev) => setFieldDraft((prev) => (prev ? { ...prev, label: ev.target.value } : prev))}
                />
              </label>
              <label className="am-field">
                <span>api_key {fieldDraft.published ? '(đã xuất bản)' : ''}</span>
                <input
                  value={fieldDraft.api_key}
                  disabled={!canManage || fieldDraft.published}
                  onChange={(ev) => setFieldDraft((prev) => (prev ? { ...prev, api_key: ev.target.value } : prev))}
                />
              </label>
              <label className="am-field">
                <span>Type</span>
                <select
                  value={fieldDraft.field_type}
                  disabled={!canManage}
                  onChange={(ev) =>
                    setFieldDraft((prev) =>
                      prev ? { ...prev, field_type: ev.target.value as AmCustomField['field_type'] } : prev,
                    )
                  }
                >
                  {AM_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="am-field">
                <span>Industry slug</span>
                <input
                  value={fieldDraft.industry_slug}
                  disabled={!canManage}
                  placeholder="bds"
                  onChange={(ev) =>
                    setFieldDraft((prev) => (prev ? { ...prev, industry_slug: ev.target.value } : prev))
                  }
                />
              </label>
              <label className="am-field am-field--check">
                <span>
                  <input
                    type="checkbox"
                    checked={fieldDraft.required}
                    disabled={!canManage}
                    onChange={(ev) =>
                      setFieldDraft((prev) => (prev ? { ...prev, required: ev.target.checked } : prev))
                    }
                  />{' '}
                  Required
                </span>
              </label>
              <label className="am-field am-field--check">
                <span>
                  <input
                    type="checkbox"
                    checked={fieldDraft.filterable}
                    disabled={!canManage}
                    onChange={(ev) =>
                      setFieldDraft((prev) => (prev ? { ...prev, filterable: ev.target.checked } : prev))
                    }
                  />{' '}
                  Filterable
                </span>
              </label>
              <label className="am-field am-field--check">
                <span>
                  <input
                    type="checkbox"
                    checked={fieldDraft.reportable}
                    disabled={!canManage}
                    onChange={(ev) =>
                      setFieldDraft((prev) => (prev ? { ...prev, reportable: ev.target.checked } : prev))
                    }
                  />{' '}
                  Reportable
                </span>
              </label>
              <div className="am-split">
                <label className="am-field">
                  <span>Min</span>
                  <input
                    type="number"
                    value={fieldDraft.min}
                    disabled={!canManage}
                    onChange={(ev) => setFieldDraft((prev) => (prev ? { ...prev, min: ev.target.value } : prev))}
                  />
                </label>
                <label className="am-field">
                  <span>Max</span>
                  <input
                    type="number"
                    value={fieldDraft.max}
                    disabled={!canManage}
                    onChange={(ev) => setFieldDraft((prev) => (prev ? { ...prev, max: ev.target.value } : prev))}
                  />
                </label>
              </div>
              <label className="am-field">
                <span>access JSON</span>
                <textarea
                  rows={4}
                  value={fieldDraft.access_json}
                  disabled={!canManage}
                  placeholder='{"view":["crm_am.view"],"edit":["crm_am.edit"]}'
                  onChange={(ev) =>
                    setFieldDraft((prev) => (prev ? { ...prev, access_json: ev.target.value } : prev))
                  }
                />
              </label>
              {canManage ? (
                <div className="am-form__actions">
                  <button type="button" className="am-btn" disabled={fieldBusy} onClick={() => void onSaveField()}>
                    Lưu
                  </button>
                  {fieldDraft.id && !fieldDraft.published ? (
                    <button
                      type="button"
                      className="am-btn am-btn--primary"
                      disabled={fieldBusy}
                      onClick={() => void onPublishField()}
                    >
                      Xuất bản
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {slaDraft ? (
        <div className="am-drawer-bg" onClick={() => setSlaDraft(null)}>
          <aside className="am-drawer" onClick={(ev) => ev.stopPropagation()}>
            <div className="am-drawer__head">
              <h2>{slaDraft.id ? 'Sửa SLA' : 'SLA mới'}</h2>
              <button type="button" className="am-link" onClick={() => setSlaDraft(null)}>
                Đóng
              </button>
            </div>
            <div className="am-form">
              <label className="am-field">
                <span>Tên</span>
                <input
                  value={slaDraft.name}
                  disabled={!canManage}
                  onChange={(ev) => setSlaDraft((prev) => (prev ? { ...prev, name: ev.target.value } : prev))}
                />
              </label>
              <label className="am-field">
                <span>First response (phút làm việc)</span>
                <input
                  type="number"
                  value={slaDraft.first_response_minutes}
                  disabled={!canManage}
                  onChange={(ev) =>
                    setSlaDraft((prev) => (prev ? { ...prev, first_response_minutes: ev.target.value } : prev))
                  }
                />
              </label>
              <label className="am-field">
                <span>Resolve (phút làm việc)</span>
                <input
                  type="number"
                  value={slaDraft.resolve_minutes}
                  disabled={!canManage}
                  onChange={(ev) =>
                    setSlaDraft((prev) => (prev ? { ...prev, resolve_minutes: ev.target.value } : prev))
                  }
                />
              </label>
              <label className="am-field am-field--check">
                <span>
                  <input
                    type="checkbox"
                    checked={slaDraft.pause_on_waiting_client}
                    disabled={!canManage}
                    onChange={(ev) =>
                      setSlaDraft((prev) =>
                        prev ? { ...prev, pause_on_waiting_client: ev.target.checked } : prev,
                      )
                    }
                  />{' '}
                  Pause on Waiting Client
                </span>
              </label>
              <label className="am-field">
                <span>Escalate 70%</span>
                <input
                  value={slaDraft.escalate70}
                  disabled={!canManage}
                  onChange={(ev) => setSlaDraft((prev) => (prev ? { ...prev, escalate70: ev.target.value } : prev))}
                />
              </label>
              <label className="am-field">
                <span>Escalate 90%</span>
                <input
                  value={slaDraft.escalate90}
                  disabled={!canManage}
                  onChange={(ev) => setSlaDraft((prev) => (prev ? { ...prev, escalate90: ev.target.value } : prev))}
                />
              </label>
              <label className="am-field">
                <span>Escalate 100%</span>
                <input
                  value={slaDraft.escalate100}
                  disabled={!canManage}
                  onChange={(ev) =>
                    setSlaDraft((prev) => (prev ? { ...prev, escalate100: ev.target.value } : prev))
                  }
                />
              </label>
              <div className="am-split">
                <label className="am-field">
                  <span>Work start</span>
                  <input
                    value={slaDraft.workday_start}
                    disabled={!canManage}
                    onChange={(ev) =>
                      setSlaDraft((prev) => (prev ? { ...prev, workday_start: ev.target.value } : prev))
                    }
                  />
                </label>
                <label className="am-field">
                  <span>Work end</span>
                  <input
                    value={slaDraft.workday_end}
                    disabled={!canManage}
                    onChange={(ev) =>
                      setSlaDraft((prev) => (prev ? { ...prev, workday_end: ev.target.value } : prev))
                    }
                  />
                </label>
              </div>
              <label className="am-field">
                <span>Holidays (YYYY-MM-DD, mỗi dòng)</span>
                <textarea
                  rows={4}
                  value={slaDraft.holidays}
                  disabled={!canManage}
                  onChange={(ev) => setSlaDraft((prev) => (prev ? { ...prev, holidays: ev.target.value } : prev))}
                />
              </label>
              {canManage ? (
                <div className="am-form__actions">
                  <button type="button" className="am-btn am-btn--primary" disabled={slaBusy} onClick={() => void onSaveSla()}>
                    Lưu policy
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
