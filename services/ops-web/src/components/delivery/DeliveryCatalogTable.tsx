'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DeliveryProjectRow } from '@/lib/delivery-projects-api';
import {
  deliveryHealthClass,
  labelDeliveryCapability,
  labelDeliveryHealth,
  normalizeCapabilities,
} from '@/lib/delivery-projects.util';
import { DeliveryEmptyPanel } from './DeliveryEmptyPanel';

type CatalogTab = 'list' | 'kanban' | 'timeline' | 'capacity';

type DeliveryCatalogTableProps = {
  rows: DeliveryProjectRow[];
};

export function DeliveryCatalogTable({ rows }: DeliveryCatalogTableProps) {
  const [tab, setTab] = useState<CatalogTab>('list');

  return (
    <div className="delivery-panel" data-testid="delivery-catalog">
      <div className="delivery-panel__head">
        <h3 className="delivery-panel__title">Danh mục dự án</h3>
        <div className="delivery-tab-row">
          {(
            [
              ['list', 'Danh sách'],
              ['kanban', 'Kanban'],
              ['timeline', 'Timeline'],
              ['capacity', 'Capacity'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`delivery-tab${tab === id ? ' delivery-tab--active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'list' ? (
        <div className="delivery-table-wrap">
          <table className="delivery-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Khách</th>
                <th>Năng lực</th>
                <th>Dịch vụ</th>
                <th>PM</th>
                <th>Progress</th>
                <th>Milestone</th>
                <th>Budget</th>
                <th>Forecast</th>
                <th>Margin</th>
                <th>Hạn</th>
                <th>Health</th>
                <th>Ingest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const caps = normalizeCapabilities(row.capabilities);
                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/crm/delivery-projects/${row.id}`} className="delivery-link">
                        {row.code ?? row.ingest_code ?? '—'}
                      </Link>
                    </td>
                    <td>{row.name}</td>
                    <td>—</td>
                    <td>
                      <div className="delivery-cap-pills">
                        {caps.map((cap) => (
                          <span key={cap} className={`delivery-cap-pill delivery-cap-pill--${cap}`}>
                            {labelDeliveryCapability(cap)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{row.service_codes?.length ? row.service_codes.join(', ') : '—'}</td>
                    <td>{row.pm_staff_id ?? '—'}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>{row.end_date ?? '—'}</td>
                    <td>
                      <span className={deliveryHealthClass(row.health_status)}>{labelDeliveryHealth(row.health_status)}</span>
                    </td>
                    <td>{row.ingest_status ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="delivery-empty-hint">Chưa có dự án trong danh mục.</p> : null}
        </div>
      ) : (
        <DeliveryEmptyPanel
          title={tab === 'kanban' ? 'Kanban' : tab === 'timeline' ? 'Timeline' : 'Capacity'}
          message="Sẽ mở ở Wave E."
          cta="Khung placeholder Wave B"
        />
      )}
    </div>
  );
}
