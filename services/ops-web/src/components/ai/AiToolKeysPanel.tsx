'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  callAiTool,
  createAiToolKey,
  fetchAiToolKeys,
  fetchAiToolsCatalog,
  revokeAiToolKey,
  type AiToolApiKey,
  type AiToolDescriptor,
  type CreateAiToolKeyResponse,
} from '@/lib/ai-api';

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

function statusLabel(key: AiToolApiKey): string {
  return key.is_active ? 'Active' : 'Revoked';
}

export function AiToolKeysPanel({ token }: { token: string }) {
  const [keys, setKeys] = useState<AiToolApiKey[]>([]);
  const [tools, setTools] = useState<AiToolDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateAiToolKeyResponse | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [tryTool, setTryTool] = useState('marketing_plan.read');
  // Seeded CrmContextPack sample (plan 8 ↔ SD #5 ↔ DP ↔ client 360 AUTO).
  const [tryInput, setTryInput] = useState(
    [
      '{',
      '  "plan_id": 8,',
      '  "lifecycle_id": 5,',
      '  "project_id": "094cba43-79e1-4af1-a45f-f1c079a7c94c",',
      '  "client_id": "d437cc78-0757-44ba-aaa3-9ffb941121dd"',
      '}',
    ].join('\n'),
  );
  const [tryHumanApproved, setTryHumanApproved] = useState(false);
  const [tryBusy, setTryBusy] = useState(false);
  const [tryError, setTryError] = useState('');
  const [tryResult, setTryResult] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [keysResponse, catalogResponse] = await Promise.all([
        fetchAiToolKeys(token),
        fetchAiToolsCatalog(token),
      ]);
      setKeys(keysResponse.keys ?? []);
      setTools(catalogResponse.tools ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải AI tool management thất bại');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!tools.length) return;
    if (!tools.some((t) => t.name === tryTool)) {
      setTryTool(tools.find((t) => !t.mutating)?.name ?? tools[0].name);
    }
  }, [tools, tryTool]);

  async function handleTryTool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTryBusy(true);
    setTryError('');
    setTryResult('');
    try {
      let parsed: Record<string, unknown> = {};
      const raw = tryInput.trim();
      if (raw) {
        parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Input phải là JSON object');
        }
      }
      const selected = tools.find((t) => t.name === tryTool);
      const out = await callAiTool(token, {
        tool_name: tryTool,
        input: parsed,
        human_approved: Boolean(selected?.mutating && tryHumanApproved),
      });
      setTryResult(JSON.stringify(out, null, 2));
    } catch (err) {
      setTryError(err instanceof Error ? err.message : 'Gọi tool thất bại');
    } finally {
      setTryBusy(false);
    }
  }

  function openCreateModal() {
    setName('');
    setClientId('');
    setAllowedTools(tools.filter((tool) => !tool.mutating).map((tool) => tool.name));
    setCreatedKey(null);
    setError('');
    setMessage('');
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (busy) return;
    setCreateOpen(false);
    setCreatedKey(null);
  }

  function toggleTool(toolName: string) {
    setAllowedTools((current) =>
      current.includes(toolName)
        ? current.filter((item) => item !== toolName)
        : [...current, toolName],
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await createAiToolKey(token, {
        name: name.trim(),
        allowed_tools: allowedTools,
        client_id: clientId.trim() || null,
      });
      setCreatedKey(created);
      setMessage('Đã tạo key. Sao chép ngay — plaintext chỉ hiển thị một lần.');
      const response = await fetchAiToolKeys(token);
      setKeys(response.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo AI tool key thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(key: AiToolApiKey) {
    if (!window.confirm(`Thu hồi key "${key.name}" (${key.key_prefix}…)? Hành động này không thể hoàn tác.`)) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await revokeAiToolKey(token, key.id);
      setMessage(`Đã thu hồi key ${key.name}.`);
      const response = await fetchAiToolKeys(token);
      setKeys(response.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thu hồi AI tool key thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-tool-keys-panel">
      <div className="kpi-page__head">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>AI tool keys</h2>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Scoped credentials for external agents · key values are never stored as plaintext
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal} disabled={loading}>
          + Tạo key
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      <div className="perf-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="perf-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Prefix</th>
              <th>Client scope</th>
              <th>Allowed tools</th>
              <th>Rate limit</th>
              <th>Trạng thái</th>
              <th>Tạo lúc</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="muted">Đang tải…</td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">Chưa có AI tool key.</td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id}>
                  <td><strong>{key.name}</strong></td>
                  <td><code>{key.key_prefix}…</code></td>
                  <td>{key.client_id ?? 'All clients'}</td>
                  <td>{key.allowed_tools.join(', ') || '—'}</td>
                  <td>{key.rate_limit_per_min}/phút</td>
                  <td>
                    <span className={key.is_active ? 'ai-run-status ai-run-status--ok' : 'ai-run-status ai-run-status--muted'}>
                      {statusLabel(key)}
                    </span>
                  </td>
                  <td>{formatWhen(key.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={!key.is_active || busy}
                      onClick={() => void handleRevoke(key)}
                    >
                      Thu hồi
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="card" style={{ padding: '1rem', marginTop: '1.25rem' }}>
        <h3 className="kpi-section-title" style={{ marginTop: 0 }}>Try tool</h3>
        <p className="muted">
          Gọi <code>POST /api/v1/ai/tools/call</code> bằng staff JWT · xem JSON CrmContextPack / kết quả thô.
          Write tools cần checkbox Human approved. INSERT plan không <code>plan_id</code> → reuse{' '}
          <code>entity_ids.plan_id</code> khi retry (tránh draft trùng). Live plan → 409 trừ{' '}
          <code>clone_to_draft: true</code>.
        </p>
        <form
          onSubmit={(event) => void handleTryTool(event)}
          className="form-grid form-grid--2"
          style={{ marginTop: '0.75rem' }}
        >
          <label className="form-field">
            <span className="form-label">Tool</span>
            <select
              className="kpi-input"
              value={tryTool}
              onChange={(e) => setTryTool(e.target.value)}
              disabled={tryBusy || tools.length === 0}
            >
              {tools.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name}
                  {tool.mutating ? ' (mutating)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={tryHumanApproved}
              disabled={tryBusy || !tools.find((t) => t.name === tryTool)?.mutating}
              onChange={(e) => setTryHumanApproved(e.target.checked)}
            />
            <span className="form-label" style={{ margin: 0 }}>
              X-AI-Human-Approved (write draft)
            </span>
          </label>
          <label className="form-field" style={{ gridColumn: '1 / -1' }}>
            <span className="form-label">Input JSON</span>
            <textarea
              className="kpi-input"
              rows={6}
              value={tryInput}
              onChange={(e) => setTryInput(e.target.value)}
              spellCheck={false}
              disabled={tryBusy}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' }}
            />
          </label>
          <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn btn-primary" disabled={tryBusy || !tryTool}>
              {tryBusy ? 'Đang gọi…' : 'Chạy tool'}
            </button>
          </div>
        </form>
        {tryError ? <p className="error">{tryError}</p> : null}
        {tryResult ? (
          <pre
            className="card"
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              overflow: 'auto',
              maxHeight: 420,
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {tryResult}
          </pre>
        ) : null}
      </section>

      <section className="card" style={{ padding: '1rem', marginTop: '1.25rem' }}>
        <h3 className="kpi-section-title" style={{ marginTop: 0 }}>Tool catalog</h3>
        <p className="muted">Registry hiện tại; catalog này chỉ đọc.</p>
        <div className="perf-table-wrap">
          <table className="perf-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Mutating</th>
                <th>Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {tools.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">{loading ? 'Đang tải…' : 'Không có tool.'}</td>
                </tr>
              ) : (
                tools.map((tool) => (
                  <tr key={tool.name}>
                    <td><code>{tool.name}</code></td>
                    <td>{tool.mutating ? 'Yes' : 'No'}</td>
                    <td>{tool.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen ? (
        <div className="ai-dismiss-modal" role="presentation" onClick={closeCreateModal}>
          <div
            className="ai-dismiss-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-tool-key-create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="ai-tool-key-create-title">
              {createdKey ? 'AI tool key đã tạo' : 'Tạo AI tool key'}
            </h4>
            {createdKey ? (
              <>
                <p className="muted">Plaintext chỉ hiển thị lần này. Lưu vào secret manager trước khi đóng.</p>
                <div
                  className="card"
                  style={{ padding: '0.75rem', borderColor: 'var(--accent)', overflowWrap: 'anywhere' }}
                >
                  <code style={{ userSelect: 'all' }}>{createdKey.key}</code>
                </div>
                <div className="ai-dismiss-modal__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(createdKey.key);
                      setMessage('Đã copy key vào clipboard.');
                    }}
                  >
                    Copy key
                  </button>
                  <button type="button" className="btn btn-primary" onClick={closeCreateModal}>
                    Đã lưu, đóng
                  </button>
                </div>
              </>
            ) : (
              <form className="ai-dismiss-modal__form" onSubmit={(event) => void handleCreate(event)}>
                <label className="ai-field">
                  <span className="muted">Tên key</span>
                  <input
                    className="kpi-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="External sales agent"
                    maxLength={128}
                    required
                    autoFocus
                  />
                </label>
                <label className="ai-field">
                  <span className="muted">Client ID (để trống = all clients)</span>
                  <input
                    className="kpi-input"
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    placeholder="UUID"
                  />
                </label>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="muted" style={{ marginBottom: '0.4rem' }}>Allowed tools</legend>
                  <div style={{ display: 'grid', gap: '0.4rem', maxHeight: 240, overflowY: 'auto' }}>
                    {tools.map((tool) => (
                      <label key={tool.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={allowedTools.includes(tool.name)}
                          onChange={() => toggleTool(tool.name)}
                        />
                        <span>
                          <code>{tool.name}</code>
                          {tool.mutating ? <span className="error"> · mutating</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="ai-dismiss-modal__actions">
                  <button type="button" className="btn btn-secondary" onClick={closeCreateModal} disabled={busy}>
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !name.trim() || allowedTools.length === 0}
                  >
                    {busy ? 'Đang tạo…' : 'Tạo key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
