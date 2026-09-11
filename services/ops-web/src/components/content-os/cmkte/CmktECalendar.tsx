'use client';

import Link from 'next/link';
import type { ContentOsCalendarSlot } from '@/lib/content-os-api';
import { evaluatePublishGate } from '@/lib/crm/cmkte-publish-gate';
import {
  canShowPublicationQueueCta,
  formatChannelHealthLabel,
  PUBLICATION_QUEUE_CTA,
  PUBLICATIONS_EMPTY,
} from '@/lib/crm/cmkte-publications';
import { publishGateFlagsFromItem } from '@/lib/crm/cmkte-workspace';

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function slotGateStatus(slot: ContentOsCalendarSlot): 'Pass' | 'Warning' | 'Blocked' | null {
  if (!slot.item) return null;
  return evaluatePublishGate(publishGateFlagsFromItem(slot.item)).status;
}

export function CmktECalendar({ slots }: { slots: ContentOsCalendarSlot[] }) {
  return (
    <div className="cmkte-reqpage">
      <div className="cmkte-head">
        <div>
          <h1>Publication Control Room</h1>
          <p>Lịch xuất bản đa kênh, queue execution, conflict detection và health trạng thái kết nối.</p>
        </div>
        <div className="cmkte-actions">
          <Link href="/crm/content-os/w/0?tab=publish" className="cmkte-btn cmkte-btn--blue">
            ＋ Schedule publication
          </Link>
        </div>
      </div>

      <div className="cmkte-card">
        {slots.length === 0 ? (
          <p className="cmkte-empty">{PUBLICATIONS_EMPTY}</p>
        ) : (
          <div className="cmkte-table-scroll">
            <table className="cmkte-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Item</th>
                  <th>Channel</th>
                  <th>Health</th>
                  <th>Gate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const gate = slotGateStatus(slot);
                  return (
                    <tr key={slot.id}>
                      <td>
                        {dash(slot.scheduled_at)}
                        <span className="cmkte-dep">{dash(slot.timezone)}</span>
                      </td>
                      <td>
                        <span className="cmkte-taskname">{dash(slot.item?.title ?? slot.item_id)}</span>
                        <span className="cmkte-dep">item {slot.item_id}</span>
                      </td>
                      <td>{dash(slot.item?.channel)}</td>
                      <td>{formatChannelHealthLabel(slot.channel_health?.status)}</td>
                      <td>{gate ?? '—'}</td>
                      <td>
                        {canShowPublicationQueueCta(gate) ? (
                          <Link
                            href={`/crm/content-os/w/${slot.item_id}?tab=publish`}
                            className="cmkte-btn cmkte-btn--small"
                          >
                            {PUBLICATION_QUEUE_CTA}
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
