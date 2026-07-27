'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchEntityTimeline } from '@/lib/ai-api';

const EVENT_TYPE_LABELS: Record<string, string> = {
  'lead.ingested': 'Lead ingest',
  'lead.status_changed': 'Đổi trạng thái',
  'crm.activity': 'Hoạt động CRM',
  'lead.assigned': 'Phân lead',
  'ai.action': 'AI action',
};

const SOURCE_LABELS: Record<string, string> = {
  crm: 'CRM',
  meta: 'Meta',
  zalo: 'Zalo',
  email: 'Email',
  seo: 'SEO',
  call: 'Gọi',
  system: 'System',
  ai: 'AI',
};

export function LeadEntityTimelinePanel({ token, leadId }: { token: string; leadId: number }) {
  const [events, setEvents] = useState<
    Array<{
      id: string;
      event_type: string;
      event_source: string;
      title: string;
      body: string | null;
      occurred_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchEntityTimeline(token, 'lead', leadId, {
        limit: 50,
        event_source: sourceFilter || undefined,
      });
      setEvents(out.data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải timeline');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, sourceFilter, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(
    () => [...new Set(events.map((event) => event.event_source).filter(Boolean))],
    [events],
  );

  return (
    <section className="lead-entity-timeline" data-testid="lead-entity-timeline">
      <div className="lead-entity-timeline__head">
        <h3 className="kpi-section-title">Timeline thống nhất · RNOS-16</h3>
        <select
          className="kpi-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Lọc nguồn timeline"
        >
          <option value="">Tất cả channel</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source] ?? source}
            </option>
          ))}
        </select>
      </div>
      {loading ? <p className="muted">Đang tải timeline…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !events.length ? (
        <p className="muted">Chưa có sự kiện timeline — activity sẽ mirror tự động.</p>
      ) : (
        <ul className="lead-entity-timeline__list">
          {events.map((event) => (
            <li key={event.id} data-testid={`timeline-event-${event.id}`}>
              <div className="lead-entity-timeline__meta">
                <strong>{EVENT_TYPE_LABELS[event.event_type] ?? event.title}</strong>
                <span className="muted">
                  {' '}
                  · {SOURCE_LABELS[event.event_source] ?? event.event_source} ·{' '}
                  {event.occurred_at.replace('T', ' ').slice(0, 16)}
                </span>
              </div>
              {event.body ? <p>{event.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
