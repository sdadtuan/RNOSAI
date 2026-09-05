'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import {
  cloneAmOnboardingTemplate,
  createAmOnboardingTemplate,
  fetchAmOnboardingTemplates,
  patchAmOnboardingTemplate,
  publishAmOnboardingTemplate,
  type AmOnboardingTemplate,
  type AmOnboardingTemplateItem,
} from '@/lib/crm/am-api';
import { amOnboardingDash } from '@/lib/crm/am-onboarding.util';
import { useAmPage } from './AmShell';

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
