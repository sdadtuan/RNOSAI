'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createBrandRule,
  formatCpApiError,
  listBrandRules,
  type CpBrandEnforcement,
  type CpBrandRule,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

const ENFORCEMENTS: Array<{ id: CpBrandEnforcement; label: string }> = [
  { id: 'block_render', label: 'Block render' },
  { id: 'block_publish', label: 'Block publish' },
  { id: 'warning', label: 'Warning' },
];

function text(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim();
}

function summarize(value: unknown): string {
  if (value == null) return dash(null);
  if (typeof value === 'string') return value || dash(null);
  try {
    const encoded = JSON.stringify(value);
    return encoded === '{}' ? dash(null) : encoded;
  } catch {
    return dash(null);
  }
}

export function CpBrandRules({
  kitId,
  scope,
  version,
}: {
  kitId: string;
  scope: CpScope;
  version: number | null;
}) {
  const [rules, setRules] = useState<CpBrandRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await listBrandRules(token, kitId, scope, version ?? undefined);
      setRules(result.items);
    } catch (caught) {
      setRules([]);
      setError(formatCpApiError(caught, 'Không tải được brand rules'));
    } finally {
      setLoading(false);
    }
  }, [kitId, scope, version]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    const form = new FormData(event.currentTarget);
    const condition: Record<string, unknown> = {};
    const outputType = text(form.get('output_type'));
    const channel = text(form.get('channel'));
    const ratio = text(form.get('ratio'));
    const claim = text(form.get('has_claim'));
    const condScope = text(form.get('condition_scope'));
    if (outputType) condition.output_type = outputType;
    if (channel) condition.channel = channel;
    if (ratio) condition.ratio = ratio;
    if (claim === 'true' || claim === 'false') condition.has_claim = claim === 'true';
    if (condScope) condition.scope = condScope;

    const action: Record<string, unknown> = {};
    if (form.get('action_disclaimer') === 'on') action.disclaimer = true;
    if (form.get('action_palette') === 'on') action.palette_lock = true;
    if (form.get('action_watermark') === 'on') action.watermark = true;
    if (form.get('action_cta') === 'on') action.cta_outro = true;
    const logo = text(form.get('action_logo'));
    if (logo) action.logo = logo;

    setSaving(true);
    setError('');
    try {
      await createBrandRule(token, kitId, {
        condition_json: condition,
        action_json: action,
        enforcement: text(form.get('enforcement')) as CpBrandEnforcement,
        n: version ?? undefined,
      }, scope);
      event.currentTarget.reset();
      await load();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không lưu được rule'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-overview">
      <section className="cp-card">
        <div className="cp-card__head">
          <div>
            <h2>Brand Rule Builder</h2>
            <p className="cp-muted">
              Condition + action + enforcement
              {version == null ? '' : ` · v${version}`}
            </p>
          </div>
        </div>
        {error ? <p className="cp-card--error">{error}</p> : null}
        {version == null ? (
          <p className="cp-empty">{dash(null)}</p>
        ) : (
          <form className="cp-filters" onSubmit={submit}>
            <label>
              <span>Output type</span>
              <input name="output_type" placeholder="video" />
            </label>
            <label>
              <span>Channel</span>
              <input name="channel" placeholder="paid" />
            </label>
            <label>
              <span>Ratio</span>
              <input name="ratio" placeholder="9:16" />
            </label>
            <label>
              <span>Has claim</span>
              <select name="has_claim" defaultValue="">
                <option value="">{dash(null)}</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label>
              <span>Scope</span>
              <input name="condition_scope" placeholder="client" />
            </label>
            <label>
              <span>Logo action</span>
              <input name="action_logo" placeholder="safe-area" />
            </label>
            <label>
              <span>Enforcement</span>
              <select name="enforcement" defaultValue="warning" required>
                {ENFORCEMENTS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label><span>Disclaimer</span><input name="action_disclaimer" type="checkbox" /></label>
            <label><span>Palette lock</span><input name="action_palette" type="checkbox" /></label>
            <label><span>Watermark</span><input name="action_watermark" type="checkbox" /></label>
            <label><span>CTA outro</span><input name="action_cta" type="checkbox" /></label>
            <button className="cp-btn cp-btn--primary" type="submit" disabled={saving || loading}>
              {saving ? 'Đang thêm…' : 'Thêm rule'}
            </button>
          </form>
        )}
      </section>

      <section className="cp-card" aria-busy={loading}>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Condition</th>
                <th>Action</th>
                <th>Enforcement</th>
              </tr>
            </thead>
            <tbody>
              {rules.length ? rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{dash(rule.id)}</td>
                  <td>{summarize(rule.condition_json)}</td>
                  <td>{summarize(rule.action_json)}</td>
                  <td><span className="cp-pill">{dash(rule.enforcement)}</span></td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={4}>{loading ? 'Đang tải…' : dash(null)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
