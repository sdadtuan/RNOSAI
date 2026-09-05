'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import {
  cloneAmOnboardingTemplate,
  createAmOnboardingTemplate,
  fetchAmOnboardingTemplates,
  fetchAmSettings,
  patchAmOnboardingTemplate,
  publishAmOnboardingTemplate,
  putAmSettings,
  type AmOnboardingTemplate,
  type AmOnboardingTemplateItem,
  type AmSettings as AmSettingsData,
} from '@/lib/crm/am-api';
import { amOnboardingDash } from '@/lib/crm/am-onboarding.util';
import {
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

export function AmSettings() {
  const { token, user } = useAmPage();
  const canManage = hasCap(user, 'crm_am', 'manage');
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
    } finally {
      setLoading(false);
    }
  }, [token]);

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
    </section>
  );
}
