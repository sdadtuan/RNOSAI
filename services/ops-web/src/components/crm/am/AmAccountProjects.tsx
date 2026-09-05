'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAmAccountProjects,
  type AmAccountDeliveryLink,
  type AmAccountProjectContract,
  type AmAccountProjects,
} from '@/lib/crm/am-api';
import { useAmPage } from './AmShell';

function dash(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  return value;
}

function ContractTable({ rows }: { rows: AmAccountProjectContract[] }) {
  if (rows.length === 0) return <p className="am-muted">—</p>;
  return (
    <table className="am-table">
      <thead>
        <tr>
          <th>Hợp đồng</th>
          <th>Dịch vụ</th>
          <th>Status</th>
          <th>Bắt đầu</th>
          <th>Kết thúc</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link className="am-link" href={row.href}>
                {dash(row.title)}
              </Link>
            </td>
            <td>{dash(row.service_slug)}</td>
            <td>{dash(row.status)}</td>
            <td>{dash(row.starts_on)}</td>
            <td>{dash(row.ends_on)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeliveryTable({ rows }: { rows: AmAccountDeliveryLink[] }) {
  if (rows.length === 0) return <p className="am-muted">—</p>;
  return (
    <table className="am-table">
      <thead>
        <tr>
          <th>Delivery</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link className="am-link" href={row.href}>
                {dash(row.name)}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AmAccountProjects({ agencyClientId }: { agencyClientId: string }) {
  const { token } = useAmPage();
  const [data, setData] = useState<AmAccountProjects | null>(null);
  const [error, setError] = useState('');
  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const generation = ++loadGenerationRef.current;
    setError('');
    try {
      const out = await fetchAmAccountProjects(token, agencyClientId);
      if (generation !== loadGenerationRef.current) return;
      setData(out);
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setData(null);
      setError('Không tải được dự án & dịch vụ.');
    }
  }, [token, agencyClientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="am-360__panel">
        <p className="am-muted">{error}</p>
        <button type="button" className="am-btn" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return <p className="am-muted">Đang tải…</p>;

  return (
    <div className="am-360__panel">
      <h2>Hợp đồng</h2>
      <ContractTable rows={data.contracts} />
      <h2>Delivery</h2>
      <DeliveryTable rows={data.delivery} />
    </div>
  );
}
