'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  createResearchAiCredential,
  createResearchAiModel,
  createResearchAiProvider,
  deleteResearchAiCredential,
  deleteResearchAiModel,
  deleteResearchAiProvider,
  fetchResearchAiCredentials,
  fetchResearchAiModels,
  fetchResearchAiProviders,
  patchResearchAiCredential,
  patchResearchAiModel,
  patchResearchAiProvider,
  testResearchAiProvider,
  type ResearchAiCredential,
  type ResearchAiModel,
  type ResearchAiProvider,
} from '@/lib/research-ai-providers-api';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function AdminResearchAiProvidersPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [providers, setProviders] = useState<ResearchAiProvider[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [models, setModels] = useState<ResearchAiModel[]>([]);
  const [credentials, setCredentials] = useState<ResearchAiCredential[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [provForm, setProvForm] = useState({
    code: '',
    display_name: '',
    base_url: 'https://api.openai.com/v1',
  });
  const [modelForm, setModelForm] = useState({ model_id: '', label: '', is_default: true });
  const [credForm, setCredForm] = useState({ label: '', api_token: '' });
  const [rotateId, setRotateId] = useState<number | null>(null);
  const [rotateToken, setRotateToken] = useState('');

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const selected = providers.find((p) => p.id === selectedId) ?? null;

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
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setError('Không có quyền CRM data config');
        return null;
      }
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
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setError('Không có quyền CRM data config');
        return null;
      }
      return access;
    }
  }, [router]);

  const reloadProviders = useCallback(async (token: string) => {
    const out = await fetchResearchAiProviders(token);
    setProviders(out.providers);
    if (out.providers.length && selectedId == null) {
      setSelectedId(out.providers[0].id);
    }
  }, [selectedId]);

  const reloadDetails = useCallback(async (token: string, providerId: number) => {
    const [m, c] = await Promise.all([
      fetchResearchAiModels(token, providerId),
      fetchResearchAiCredentials(token, providerId),
    ]);
    setModels(m.models);
    setCredentials(c.credentials);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reloadProviders(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải thất bại');
      }
    })();
  }, [ensureAuth, reloadProviders]);

  useEffect(() => {
    if (!selectedId) return;
    void (async () => {
      const access = getAccessToken();
      if (!access) return;
      try {
        await reloadDetails(access, selectedId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải chi tiết thất bại');
      }
    })();
  }, [selectedId, reloadDetails]);

  async function withBusy(fn: (token: string) => Promise<void>) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await fn(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      title="Research AI Providers"
      subtitle="Quản lý Provider, Model và API token cho thu thập lead thô"
      section="crm-config"
      user={user}
      onLogout={() => {
        clearSession();
        router.push('/login');
      }}
    >
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <div className="kpi-grid" style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr' }}>
        <section className="kpi-card">
          <h3 className="kpi-section-title">Providers</h3>
          {canConfigure ? (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void withBusy(async (token) => {
                  const created = await createResearchAiProvider(token, provForm);
                  setProvForm({ code: '', display_name: '', base_url: 'https://api.openai.com/v1' });
                  await reloadProviders(token);
                  setSelectedId(created.id);
                  setMsg('Đã thêm provider');
                });
              }}
            >
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input
                  placeholder="code (openai)"
                  value={provForm.code}
                  onChange={(e) => setProvForm((s) => ({ ...s, code: e.target.value }))}
                  required
                />
                <input
                  placeholder="Tên hiển thị"
                  value={provForm.display_name}
                  onChange={(e) => setProvForm((s) => ({ ...s, display_name: e.target.value }))}
                  required
                />
                <input
                  placeholder="base_url"
                  value={provForm.base_url}
                  onChange={(e) => setProvForm((s) => ({ ...s, base_url: e.target.value }))}
                  required
                  style={{ minWidth: 280 }}
                />
                <button type="submit" disabled={busy}>
                  Thêm provider
                </button>
              </div>
            </form>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Tên</th>
                <th>Base URL</th>
                <th>Models</th>
                <th>Token</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr
                  key={p.id}
                  style={{ background: selectedId === p.id ? 'var(--surface-2, #f3f4f6)' : undefined }}
                >
                  <td>
                    <button type="button" className="linkish" onClick={() => setSelectedId(p.id)}>
                      {p.code}
                    </button>
                  </td>
                  <td>{p.display_name}</td>
                  <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.base_url}
                  </td>
                  <td>{p.model_count}</td>
                  <td>{p.has_enabled_credential ? '✓' : '—'}</td>
                  <td>{p.enabled ? 'On' : 'Off'}</td>
                  <td>
                    {canConfigure ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void withBusy(async (token) => {
                              await patchResearchAiProvider(token, p.id, { enabled: !p.enabled });
                              await reloadProviders(token);
                              setMsg(p.enabled ? 'Đã disable provider' : 'Đã enable provider');
                            })
                          }
                        >
                          {p.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void withBusy(async (token) => {
                              const out = await testResearchAiProvider(token, p.id);
                              setMsg(
                                out.ok
                                  ? `Test OK (${out.latency_ms ?? '?'}ms)`
                                  : `Test fail: ${out.error ?? 'unknown'}`,
                              );
                            })
                          }
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void withBusy(async (token) => {
                              await deleteResearchAiProvider(token, p.id);
                              if (selectedId === p.id) setSelectedId(null);
                              await reloadProviders(token);
                              setMsg('Đã xóa provider');
                            })
                          }
                        >
                          Xóa
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {selected ? (
          <>
            <section className="kpi-card">
              <h3 className="kpi-section-title">Models — {selected.code}</h3>
              {canConfigure ? (
                <form
                  className="row"
                  style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void withBusy(async (token) => {
                      await createResearchAiModel(token, selected.id, modelForm);
                      setModelForm({ model_id: '', label: '', is_default: false });
                      await reloadDetails(token, selected.id);
                      await reloadProviders(token);
                      setMsg('Đã thêm model');
                    });
                  }}
                >
                  <input
                    placeholder="model_id"
                    value={modelForm.model_id}
                    onChange={(e) => setModelForm((s) => ({ ...s, model_id: e.target.value }))}
                    required
                  />
                  <input
                    placeholder="label"
                    value={modelForm.label}
                    onChange={(e) => setModelForm((s) => ({ ...s, label: e.target.value }))}
                    required
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={modelForm.is_default}
                      onChange={(e) => setModelForm((s) => ({ ...s, is_default: e.target.checked }))}
                    />{' '}
                    Default
                  </label>
                  <button type="submit" disabled={busy}>
                    Thêm model
                  </button>
                </form>
              ) : null}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>model_id</th>
                    <th>Label</th>
                    <th>Default</th>
                    <th>Enabled</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.id}>
                      <td>{m.model_id}</td>
                      <td>{m.label}</td>
                      <td>{m.is_default ? '✓' : ''}</td>
                      <td>{m.enabled ? 'On' : 'Off'}</td>
                      <td>
                        {canConfigure ? (
                          <div className="row" style={{ gap: 6 }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void withBusy(async (token) => {
                                  await patchResearchAiModel(token, m.id, { enabled: !m.enabled });
                                  await reloadDetails(token, selected.id);
                                })
                              }
                            >
                              {m.enabled ? 'Disable' : 'Enable'}
                            </button>
                            {!m.is_default ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void withBusy(async (token) => {
                                    await patchResearchAiModel(token, m.id, { is_default: true });
                                    await reloadDetails(token, selected.id);
                                  })
                                }
                              >
                                Set default
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void withBusy(async (token) => {
                                  await deleteResearchAiModel(token, m.id);
                                  await reloadDetails(token, selected.id);
                                  await reloadProviders(token);
                                })
                              }
                            >
                              Xóa
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="kpi-card">
              <h3 className="kpi-section-title">API tokens — {selected.code}</h3>
              <p className="muted">Token chỉ nhập một lần; danh sách chỉ hiện hint (…xxxx).</p>
              {canConfigure ? (
                <form
                  className="row"
                  style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void withBusy(async (token) => {
                      await createResearchAiCredential(token, selected.id, {
                        label: credForm.label,
                        api_token: credForm.api_token,
                        is_primary: true,
                      });
                      setCredForm({ label: '', api_token: '' });
                      await reloadDetails(token, selected.id);
                      await reloadProviders(token);
                      setMsg('Đã thêm token');
                    });
                  }}
                >
                  <input
                    placeholder="Nhãn (Prod)"
                    value={credForm.label}
                    onChange={(e) => setCredForm((s) => ({ ...s, label: e.target.value }))}
                    required
                  />
                  <input
                    type="password"
                    placeholder="API token"
                    value={credForm.api_token}
                    onChange={(e) => setCredForm((s) => ({ ...s, api_token: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                  <button type="submit" disabled={busy}>
                    Thêm token
                  </button>
                </form>
              ) : null}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Hint</th>
                    <th>Primary</th>
                    <th>Enabled</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((c) => (
                    <tr key={c.id}>
                      <td>{c.label}</td>
                      <td>
                        <code>{c.token_hint}</code>
                      </td>
                      <td>{c.is_primary ? '✓' : ''}</td>
                      <td>{c.enabled ? 'On' : 'Off'}</td>
                      <td>
                        {canConfigure ? (
                          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void withBusy(async (token) => {
                                  await patchResearchAiCredential(token, c.id, {
                                    enabled: !c.enabled,
                                  });
                                  await reloadDetails(token, selected.id);
                                  await reloadProviders(token);
                                })
                              }
                            >
                              {c.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button type="button" disabled={busy} onClick={() => setRotateId(c.id)}>
                              Rotate
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void withBusy(async (token) => {
                                  await deleteResearchAiCredential(token, c.id);
                                  await reloadDetails(token, selected.id);
                                  await reloadProviders(token);
                                })
                              }
                            >
                              Xóa
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rotateId != null ? (
                <form
                  className="row"
                  style={{ gap: 8, marginTop: 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void withBusy(async (token) => {
                      await patchResearchAiCredential(token, rotateId, { api_token: rotateToken });
                      setRotateId(null);
                      setRotateToken('');
                      await reloadDetails(token, selected.id);
                      setMsg('Đã rotate token');
                    });
                  }}
                >
                  <input
                    type="password"
                    placeholder="Token mới"
                    value={rotateToken}
                    onChange={(e) => setRotateToken(e.target.value)}
                    required
                    autoComplete="off"
                  />
                  <button type="submit" disabled={busy}>
                    Lưu rotate
                  </button>
                  <button type="button" onClick={() => setRotateId(null)}>
                    Hủy
                  </button>
                </form>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
