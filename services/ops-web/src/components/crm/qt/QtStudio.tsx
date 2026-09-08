'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useState } from 'react';
import { dash } from '@/lib/crm/qt-format';

export const QT_STUDIO_PUBLISH_REASON = 'version_not_approved';

export const QT_STUDIO_SECTIONS = [
  { id: 's01', label: '01 Cover & thương hiệu' },
  { id: 's02', label: '02 Bối cảnh & mục tiêu' },
  { id: 's03', label: '03 Chiến lược' },
  { id: 's04', label: '04 Phạm vi' },
  { id: 's05', label: '05 KPI & hiệu quả' },
  { id: 's06', label: '06 Timeline' },
  { id: 's07', label: '07 Đầu tư' },
  { id: 's08', label: '08 Điều khoản' },
  { id: 's09', label: '09 Xác nhận' },
] as const;

export type QtStudioSectionId = (typeof QT_STUDIO_SECTIONS)[number]['id'];

export function QtStudioChrome({
  active = 's01',
  quoteCode = null,
  quoteId = null,
  onSelect,
}: {
  active?: QtStudioSectionId;
  quoteCode?: string | null;
  quoteId?: string | null;
  onSelect?: (id: QtStudioSectionId) => void;
}) {
  const section = QT_STUDIO_SECTIONS.find((item) => item.id === active) ?? QT_STUDIO_SECTIONS[0];
  return (
    <div className="qt-studio">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">
            Kinh doanh / Báo giá / Proposal Studio / {dash(quoteCode)}
          </p>
          <h1>Proposal Studio</h1>
          <p className="qt-muted">PRS-01 · 9 section · cấm cost/margin trên bản khách</p>
        </div>
        <div className="qt-head__actions">
          {quoteId ? (
            <Link className="qt-btn" href={`/crm/proposals/${quoteId}`}>
              Về builder
            </Link>
          ) : null}
          <button
            type="button"
            className="qt-btn qt-btn--primary"
            disabled
            data-reason={QT_STUDIO_PUBLISH_REASON}
          >
            Xuất bản
          </button>
        </div>
      </header>
      <p className="qt-muted">
        Lý do: <code>{QT_STUDIO_PUBLISH_REASON}</code>
      </p>
      <div className="qt-studio__grid">
        <nav className="qt-studio__nav" aria-label="Section Studio">
          {QT_STUDIO_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`qt-tab${item.id === section.id ? ' qt-tab--on' : ''}`}
              onClick={onSelect ? () => onSelect(item.id) : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <section className="qt-card" data-section={section.id}>
          <h2>{section.label}</h2>
          <p className="qt-empty">{dash(null)}</p>
        </section>
        <aside className="qt-card">
          <b>Publish</b>
          <p className="qt-muted">Chỉ version approved còn hạn.</p>
          <p className="qt-empty">{dash(null)}</p>
        </aside>
      </div>
    </div>
  );
}

export function QtStudio() {
  const params = useParams<{ id?: string }>();
  const [active, setActive] = useState<QtStudioSectionId>('s01');
  return (
    <QtStudioChrome
      active={active}
      quoteId={params?.id ?? null}
      onSelect={setActive}
    />
  );
}
