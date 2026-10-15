'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CrmLeadLookupOption, CrmStaffRow } from '@/lib/api';
import { FilterBar, FilterBarActions, FilterBarSearch, SegmentedControl } from '@/components/layout';

type OwnerTab = 'all' | 'mine' | 'unassigned';
type LeadKind = 'pipeline' | 'review' | 'all';

type LeadsPhoneFilterSheetProps = {
  q: string;
  onQChange: (value: string) => void;
  listTab: OwnerTab;
  canViewAllLeads: boolean;
  browsesAllB2bLeads?: boolean;
  onOwnerChange: (id: OwnerTab) => void;
  showKind: boolean;
  leadKind: LeadKind;
  reviewBadge?: number;
  onKindChange: (id: LeadKind) => void;
  filterStatus: string;
  onStatusChange: (value: string) => void;
  statusOptions: readonly { id: string; label: string }[];
  filterSource: string;
  onSourceChange: (value: string) => void;
  sourceOptions: CrmLeadLookupOption[];
  filterChannel: string;
  onChannelChange: (value: string) => void;
  channelOptions: CrmLeadLookupOption[];
  receivedFrom: string;
  receivedTo: string;
  onReceivedFromChange: (value: string) => void;
  onReceivedToChange: (value: string) => void;
  assignee: string;
  onAssigneeChange: (value: string) => void;
  canPickOwner: boolean;
  staffOptions: CrmStaffRow[];
  loading: boolean;
  savedView: string;
  onLeadP1: () => void;
  showInbox: boolean;
  onApply: () => void;
};

export function LeadsPhoneFilterSheet({
  q,
  onQChange,
  listTab,
  canViewAllLeads,
  browsesAllB2bLeads = false,
  onOwnerChange,
  showKind,
  leadKind,
  reviewBadge,
  onKindChange,
  filterStatus,
  onStatusChange,
  statusOptions,
  filterSource,
  onSourceChange,
  sourceOptions,
  filterChannel,
  onChannelChange,
  channelOptions,
  receivedFrom,
  receivedTo,
  onReceivedFromChange,
  onReceivedToChange,
  assignee,
  onAssigneeChange,
  canPickOwner,
  staffOptions,
  loading,
  savedView,
  onLeadP1,
  showInbox,
  onApply,
}: LeadsPhoneFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-sm crm-leads-phone-only"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        Lọc
      </button>
      {open ? (
        <div className="leads-phone-sheet" role="dialog" aria-modal="true" aria-label="Lọc lead">
          <SegmentedControl
            options={
              canViewAllLeads
                ? [
                    { id: 'all' as const, label: 'Tất cả' },
                    { id: 'mine' as const, label: 'Của tôi' },
                    { id: 'unassigned' as const, label: 'Chưa phân' },
                  ]
                : browsesAllB2bLeads
                  ? [{ id: 'all' as const, label: 'Tất cả' }]
                  : [{ id: 'mine' as const, label: 'Của tôi' }]
            }
            value={canViewAllLeads ? listTab : browsesAllB2bLeads ? 'all' : 'mine'}
            onChange={onOwnerChange}
          />
          {showKind ? (
            <SegmentedControl
              label="Loại lead"
              options={[
                { id: 'pipeline' as const, label: 'Pipeline AM' },
                {
                  id: 'review' as const,
                  label: 'Phải tra soát',
                  badge: reviewBadge && reviewBadge > 0 ? reviewBadge : undefined,
                },
                { id: 'all' as const, label: 'Tất cả (có tag)' },
              ]}
              value={leadKind}
              onChange={onKindChange}
              className="segmented-control--kind"
            />
          ) : null}
          <FilterBar
            onSubmit={(event) => {
              event.preventDefault();
              onApply();
              setOpen(false);
            }}
          >
            <FilterBarSearch value={q} onChange={onQChange} placeholder="Tìm tên, SĐT, email…" />
            <select
              className="kpi-select"
              value={filterStatus}
              onChange={(event) => onStatusChange(event.target.value)}
              aria-label="Lọc trạng thái"
            >
              <option value="">Trạng thái</option>
              {statusOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="kpi-select"
              value={filterSource}
              onChange={(event) => onSourceChange(event.target.value)}
              aria-label="Lọc nguồn"
            >
              <option value="">Nguồn</option>
              {sourceOptions.map((opt) => (
                <option key={opt.id} value={opt.option_key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="kpi-select"
              value={filterChannel}
              onChange={(event) => onChannelChange(event.target.value)}
              aria-label="Lọc kênh"
            >
              <option value="">Kênh</option>
              {channelOptions.map((opt) => (
                <option key={opt.id} value={opt.option_key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="kpi-select"
              value={receivedFrom}
              onChange={(event) => onReceivedFromChange(event.target.value)}
              aria-label="Từ ngày"
            />
            <input
              type="date"
              className="kpi-select"
              value={receivedTo}
              onChange={(event) => onReceivedToChange(event.target.value)}
              aria-label="Đến ngày"
            />
            {canPickOwner ? (
              <select
                className="kpi-select"
                value={assignee}
                onChange={(event) => onAssigneeChange(event.target.value)}
                aria-label="Người phụ trách"
              >
                <option value="">Người phụ trách</option>
                {staffOptions
                  .filter((staff) => staff.active !== 0)
                  .map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
              </select>
            ) : null}
            <FilterBarActions>
              <button
                type="button"
                className={`btn btn-sm btn-ghost${savedView === 'p1' ? ' is-active' : ''}`}
                onClick={() => {
                  onLeadP1();
                  setOpen(false);
                }}
              >
                Lead P1
              </button>
              {showInbox ? (
                <Link href="/crm/leads/review-queue" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
                  Inbox GDKD →
                </Link>
              ) : null}
              <button className="btn btn-sm btn-secondary" type="submit" disabled={loading}>
                Lọc
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
                Đóng
              </button>
            </FilterBarActions>
          </FilterBar>
        </div>
      ) : null}
    </>
  );
}
