'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { dash } from '@/lib/crm/cp-format';
import {
  addWeaveAsset,
  buildOpenHref,
  createWeaveOrder,
  deliverWeaveOrder,
  generateWeaveBrief,
  listWeaveOrders,
  openWeaveOrder,
  submitWeaveReview,
  syncWeaveOutput,
  type CpWeaveIngestResult,
  type CpWeaveWorkOrder,
} from '@/lib/crm/cp-weave-api';

const TEMPLATES = [
  { key: 'feed-1x1', name: 'Feed vuông 1080' },
  { key: 'reel-9x16', name: 'Reel / Shorts' },
  { key: 'banner-wide', name: 'Banner ngang' },
];

export function CpWeaveWorkOrder({
  projectId,
  enabled,
}: {
  projectId: string;
  enabled: boolean;
}) {
  const [orders, setOrders] = useState<CpWeaveWorkOrder[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [templateKey, setTemplateKey] = useState('feed-1x1');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncResult, setSyncResult] = useState<CpWeaveIngestResult | null>(null);
  const [linkUri, setLinkUri] = useState('');

  const selected = orders.find((item) => item.id === selectedId) ?? orders[0] ?? null;

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const listed = await listWeaveOrders(token, projectId);
      setOrders(listed.items);
      setSelectedId((current) => current || listed.items[0]?.id || '');
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : 'Không tải Work Order');
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, work: (token: string) => Promise<void>) {
    const token = getAccessToken();
    if (!token) return;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      await work(token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác Weave thất bại');
    } finally {
      setBusy('');
    }
  }

  if (!enabled) {
    return (
      <section className="cp-weave">
        <p className="cp-empty">{dash(null)}</p>
      </section>
    );
  }

  const exportPath = selected?.client_code && selected.campaign_code && selected.task_id
    ? `${selected.client_code}/${selected.campaign_code}/${selected.task_id}/final/`
    : dash(null);
  const brief = selected?.brief_json ?? {};

  return (
    <section className="cp-weave">
      <header className="cp-weave-head">
        <h2>Weave Work Order</h2>
        <p className="cp-muted">Designer làm trên Weave. CRM chỉ Sync output.</p>
      </header>
      {error ? <p className="cp-card--error">{error}</p> : null}
      {notice ? <p className="cp-muted">{notice}</p> : null}

      <div className="cp-weave-row">
        <label className="cp-weave-field">
          Template
          <select
            value={templateKey}
            onChange={(event) => setTemplateKey(event.target.value)}
          >
            {TEMPLATES.map((item) => (
              <option key={item.key} value={item.key}>{item.name}</option>
            ))}
          </select>
        </label>
        <button
          className="cp-btn"
          type="button"
          disabled={busy !== ''}
          onClick={() => run('create', async (token) => {
            const created = await createWeaveOrder(token, {
              project_id: projectId,
              template_key: templateKey,
            });
            setSelectedId(created.id);
            setNotice('Đã tạo Work Order');
          })}
        >
          Tạo Work Order
        </button>
      </div>

      {loading ? <p className="cp-muted">Đang tải…</p> : null}

      {orders.length ? (
        <label className="cp-weave-field">
          Work Order
          <select
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {orders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.task_id || item.id} · {item.status}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="cp-empty">{dash(null)}</p>
      )}

      {selected ? (
        <>
          <div className="cp-weave-actions">
            <button
              className="cp-btn"
              type="button"
              disabled={busy !== ''}
              onClick={() => run('brief', async (token) => {
                await generateWeaveBrief(token, selected.id);
                setNotice('Đã sinh brief');
              })}
            >
              Sinh brief AI
            </button>
            <button
              className="cp-btn"
              type="button"
              disabled={!brief.prompt}
              onClick={async () => {
                await navigator.clipboard.writeText(String(brief.prompt ?? ''));
                setNotice('Đã sao chép prompt');
              }}
            >
              Sao chép prompt
            </button>
            <button
              className="cp-btn"
              type="button"
              disabled={busy !== ''}
              onClick={() => run('open', async (token) => {
                const opened = await openWeaveOrder(token, selected.id);
                window.open(buildOpenHref(opened), '_blank', 'noopener');
              })}
            >
              Open in Weave
            </button>
          </div>

          <dl className="cp-weave-brief">
            <div><dt>Brief</dt><dd>{dash(brief.creative_brief)}</dd></div>
            <div><dt>Prompt</dt><dd>{dash(brief.prompt)}</dd></div>
            <div><dt>Negative</dt><dd>{dash(brief.negative_prompt)}</dd></div>
            <div><dt>Shot list</dt><dd>{brief.shot_list?.length ? brief.shot_list.join(', ') : dash(null)}</dd></div>
            <div>
              <dt>Format</dt>
              <dd>
                {brief.output_format
                  ? `${brief.output_format.kind ?? '—'} ${brief.output_format.width ?? '—'}×${brief.output_format.height ?? '—'}`
                  : dash(null)}
              </dd>
            </div>
          </dl>

          <ol className="cp-weave-check">
            <li>Import reference vào Weave</li>
            <li>Chạy flow template</li>
            <li>Export đúng prefix bên dưới</li>
          </ol>
          <p className="cp-weave-path">Path export: {exportPath}</p>

          <div className="cp-weave-actions">
            <button
              className="cp-btn cp-btn--primary"
              type="button"
              disabled={busy !== ''}
              onClick={() => run('sync', async (token) => {
                const result = await syncWeaveOutput(token, selected.id);
                setSyncResult(result);
                setNotice(`Sync output: ${result.ingested} file`);
              })}
            >
              Sync output
            </button>
            <button
              className="cp-btn"
              type="button"
              disabled={busy !== ''}
              onClick={() => run('review', async (token) => {
                await submitWeaveReview(token, selected.id);
                setNotice('Đã gửi review');
              })}
            >
              Gửi review
            </button>
            <button
              className="cp-btn"
              type="button"
              disabled={busy !== ''}
              onClick={() => run('deliver', async (token) => {
                await deliverWeaveOrder(token, selected.id);
                setNotice('Đã đưa delivery');
              })}
            >
              Đưa delivery
            </button>
          </div>

          <div className="cp-weave-row">
            <label className="cp-weave-field">
              Link / upload fallback
              <input
                value={linkUri}
                onChange={(event) => setLinkUri(event.target.value)}
                placeholder="https://…"
              />
            </label>
            <button
              className="cp-btn"
              type="button"
              disabled={!linkUri.trim() || busy !== ''}
              onClick={() => run('link', async (token) => {
                await addWeaveAsset(token, selected.id, { storage_uri: linkUri.trim(), source: 'link' });
                setLinkUri('');
                setNotice('Đã gắn link');
              })}
            >
              Gắn link
            </button>
          </div>

          {syncResult ? (
            <p className="cp-muted">
              Quét {syncResult.scanned} · ingest {syncResult.ingested} · bỏ qua {syncResult.skipped}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
