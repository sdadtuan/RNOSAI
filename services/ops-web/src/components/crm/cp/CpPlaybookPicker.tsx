'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { CP_PLAYBOOK_PICKER_TITLE } from '@/lib/crm/cp-playbook-copy';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  cloneCpPlaybookTemplate,
  listCpPlaybooks,
  type CpPlaybookSummary,
} from '@/lib/crm/cp-playbook-api';

type CpPlaybookPickerProps = {
  selectedId?: string | null;
  onSelect: (playbook: CpPlaybookSummary) => void;
};

export function CpPlaybookPicker({ selectedId, onSelect }: CpPlaybookPickerProps) {
  const searchParams = useSearchParams();
  const scope = searchParams.get('scope') === 'team' || searchParams.get('scope') === 'all'
    ? searchParams.get('scope')
    : 'me';
  const [items, setItems] = useState<CpPlaybookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [cloneHref, setCloneHref] = useState('');
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
      setItems(await listCpPlaybooks(token));
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Không tải playbook');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function cloneTemplate(playbook: CpPlaybookSummary) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(playbook.id);
    setError('');
    setCloneHref('');
    try {
      const template = await cloneCpPlaybookTemplate(token, playbook.id);
      setCloneHref(`/crm/creative-os/video/templates?scope=${scope}&template=${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không sao chép được mẫu');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <p className="cp-muted">Đang tải playbook…</p>;

  return (
    <section aria-label={CP_PLAYBOOK_PICKER_TITLE}>
      <header className="cp-card__head">
        <h2>{CP_PLAYBOOK_PICKER_TITLE}</h2>
        <p className="cp-muted">Sao chép playbook thành mẫu draft để agency tùy biến trước khi publish.</p>
      </header>
      {error ? <p className="cp-card--error">{error}</p> : null}
      {cloneHref ? (
        <p className="cp-muted">
          Đã tạo mẫu draft.{' '}
          <Link className="cp-link" href={cloneHref}>Mở mẫu video</Link>
        </p>
      ) : null}
      <div className="cp-playbook-grid">
        {items.map((item) => (
          <article
            key={item.id}
            className={`cp-playbook-card${selectedId === item.id ? ' is-on' : ''}`}
          >
            <button type="button" className="cp-playbook-card__select" onClick={() => onSelect(item)}>
              <strong>{item.label}</strong>
              <p className="cp-muted">{item.line} · QC {item.qc_pack}</p>
              <p className="cp-muted">{item.channels.join(' · ')}</p>
            </button>
            <button
              className="cp-btn"
              type="button"
              disabled={busyId === item.id}
              onClick={() => void cloneTemplate(item)}
            >
              {busyId === item.id ? 'Đang sao chép…' : 'Sao chép mẫu'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
