'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createAmDocument,
  fetchAmDocuments,
  type AmDocument,
} from '@/lib/crm/am-api';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

export function AmDocumentsPanel({
  agencyClientId,
  contractId,
  onboardingCaseId,
  canEdit,
}: {
  agencyClientId: string;
  contractId?: number;
  onboardingCaseId?: string;
  canEdit: boolean;
}) {
  const { token, scope } = useAmPage();
  const { push } = useToast();
  const [items, setItems] = useState<AmDocument[]>([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [href, setHref] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !agencyClientId) return;
    setError('');
    try {
      const out = await fetchAmDocuments(token, {
        agency_client_id: agencyClientId,
        contract_id: contractId,
        onboarding_case_id: onboardingCaseId,
        scope,
      });
      setItems(out.items ?? []);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    }
  }, [agencyClientId, contractId, onboardingCaseId, scope, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canEdit || !token || saving) return;
    setSaving(true);
    try {
      await createAmDocument(token, {
        agency_client_id: agencyClientId,
        title,
        href,
        contract_id: contractId,
        onboarding_case_id: onboardingCaseId,
      });
      setTitle('');
      setHref('');
      push('Đã thêm tài liệu', 'success');
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không thêm được tài liệu';
      push(message === 'documents_table_missing' ? 'Chưa có bảng tài liệu' : message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="am-docs">
      <h2>Tài liệu</h2>
      {error ? (
        <div className="am-widget__error">
          <p>
            {error === 'not_found'
              ? 'Không tìm thấy khách trong phạm vi của bạn.'
              : 'Không tải được tài liệu.'}
          </p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {items.length === 0 && !error ? <p className="am-muted">—</p> : null}
      {items.length > 0 ? (
        <ul className="am-docs__list">
          {items.map((row) => (
            <li key={row.id} className="am-docs__item">
              <a className="am-link" href={row.href} target="_blank" rel="noreferrer">
                {row.title || '—'}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <form className="am-docs__form" onSubmit={(ev) => void onAdd(ev)}>
          <label className="am-field">
            <span>Tiêu đề</span>
            <input
              className="am-input"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label className="am-field">
            <span>URL</span>
            <input
              className="am-input"
              value={href}
              onChange={(ev) => setHref(ev.target.value)}
              placeholder="https://…"
              required
            />
          </label>
          <button type="submit" className="am-btn am-btn--primary" disabled={saving}>
            Thêm liên kết
          </button>
        </form>
      ) : null}
    </section>
  );
}
