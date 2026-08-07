import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LeadRow } from '@/lib/api';
import type { LeadScoreSummary } from '@/lib/ai-api';
import { LeadScoreBadge } from '@/components/ai/LeadScoreBadge';
import { LeadReviewQueueTag } from '@/components/crm/LeadReviewQueueTag';
import { LeadsMobileCardList } from '@/app/crm/leads/LeadsMobileCardList';
import { WinEmptyState } from '@/components/win';
import type { LeadsColumnId } from '@/lib/crm/leads-columns';

interface Props {
  rows: LeadRow[];
  loading: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
  ownerNameById?: Record<number, string>;
  visibleColumns: Set<LeadsColumnId>;
  showScores?: boolean;
  scoreMap?: Record<string, LeadScoreSummary>;
  scoresPending?: boolean;
  showLeadKindTags?: boolean;
  emptyActions?: ReactNode;
}

function colSpan(visible: Set<LeadsColumnId>, showLeadKindTags: boolean, showScores: boolean): number {
  let n = 1;
  if (visible.has('id')) n += 1;
  if (visible.has('name')) n += 1;
  if (visible.has('phone')) n += 1;
  if (visible.has('status')) n += 1;
  if (showLeadKindTags && visible.has('kind')) n += 1;
  if (visible.has('source')) n += 1;
  if (visible.has('channel')) n += 1;
  if (showScores && visible.has('score')) n += 1;
  if (visible.has('date')) n += 1;
  return n;
}

export function CrmLeadsList({
  rows,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  ownerNameById,
  visibleColumns,
  showScores = false,
  scoreMap = {},
  scoresPending = false,
  showLeadKindTags = true,
  emptyActions,
}: Props) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const someSelected = rows.some((row) => selectedIds.has(row.id));
  const showEmpty = !loading && rows.length === 0;

  if (showEmpty) {
    return (
      <WinEmptyState
        icon="📋"
        title="Chưa có lead"
        subtitle="Thử đổi bộ lọc, import Excel hoặc tạo lead mới."
      >
        {emptyActions}
      </WinEmptyState>
    );
  }

  return (
    <>
      <div className="crm-leads-table-wrap data-table-wrap">
        <table className="data-table perf-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả trang"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              {visibleColumns.has('id') ? <th>ID</th> : null}
              {visibleColumns.has('name') ? <th>Tên</th> : null}
              {visibleColumns.has('phone') ? <th>SĐT</th> : null}
              {visibleColumns.has('status') ? <th>Trạng thái</th> : null}
              {showLeadKindTags && visibleColumns.has('kind') ? <th>Loại</th> : null}
              {visibleColumns.has('source') ? <th>Nguồn</th> : null}
              {visibleColumns.has('channel') ? <th>Kênh</th> : null}
              {showScores && visibleColumns.has('score') ? <th>AI Score</th> : null}
              {visibleColumns.has('date') ? <th>Ngày</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr
                key={lead.id}
                className={[
                  selectedIds.has(lead.id) ? 'crm-leads-row--selected' : undefined,
                  lead.review_queue?.active ? 'crm-leads-row--review-queue' : undefined,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Chọn lead ${lead.id}`}
                    checked={selectedIds.has(lead.id)}
                    onChange={() => onToggleSelect(lead.id)}
                  />
                </td>
                {visibleColumns.has('id') ? (
                  <td>
                    <Link href={`/crm/leads/${lead.id}`} className="nav-link">
                      {lead.id}
                    </Link>
                  </td>
                ) : null}
                {visibleColumns.has('name') ? <td>{lead.full_name || '—'}</td> : null}
                {visibleColumns.has('phone') ? <td>{lead.phone || '—'}</td> : null}
                {visibleColumns.has('status') ? <td>{lead.status}</td> : null}
                {showLeadKindTags && visibleColumns.has('kind') ? (
                  <td>{lead.review_queue?.active ? <LeadReviewQueueTag lead={lead} /> : '—'}</td>
                ) : null}
                {visibleColumns.has('source') ? <td>{lead.source}</td> : null}
                {visibleColumns.has('channel') ? <td>{lead.channel || '—'}</td> : null}
                {showScores && visibleColumns.has('score') ? (
                  <td>
                    <LeadScoreBadge score={scoreMap[String(lead.id)]} pending={scoresPending} />
                  </td>
                ) : null}
                {visibleColumns.has('date') ? <td>{lead.created_at?.slice(0, 10) ?? '—'}</td> : null}
              </tr>
            ))}
            {loading ? (
              <tr>
                <td colSpan={colSpan(visibleColumns, showLeadKindTags, showScores)} className="muted">
                  Đang tải…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <LeadsMobileCardList
        rows={rows}
        loading={loading}
        ownerNameById={ownerNameById}
        showScores={showScores}
        scoreMap={scoreMap}
        scoresPending={scoresPending}
        showLeadKindTags={showLeadKindTags}
        emptyActions={emptyActions}
      />
    </>
  );
}
