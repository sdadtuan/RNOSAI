'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createIwrReport,
  fetchIwrDirectory,
  fetchIwrReports,
  patchIwrReport,
  submitIwrReport,
  type IwrReportRow,
  type IwrStaffNode,
} from '@/lib/crm/iwr-api';
import { iwrIsoWeekLabel } from './iwr-format';

type IwrSendDrawerProps = {
  open: boolean;
  token: string;
  canWrite: boolean;
  onClose: () => void;
};

type Chip = { id: number; name: string; email?: string | null };

export function IwrSendDrawer({ open, token, canWrite, onClose }: IwrSendDrawerProps) {
  const router = useRouter();
  const week = iwrIsoWeekLabel();
  const [to, setTo] = useState<Chip[]>([]);
  const [cc, setCc] = useState<Chip[]>([]);
  const [toQ, setToQ] = useState('');
  const [ccQ, setCcQ] = useState('');
  const [toHits, setToHits] = useState<IwrStaffNode[]>([]);
  const [ccHits, setCcHits] = useState<IwrStaffNode[]>([]);
  const [title, setTitle] = useState(`Báo cáo tuần — ${week.label}`);
  const [body, setBody] = useState(
    'Kính gửi anh/chị,\n\nEm gửi báo cáo tuần. Xin anh/chị xem và phản hồi nếu cần bổ sung.\n\nTrân trọng.',
  );
  const [drafts, setDrafts] = useState<IwrReportRow[]>([]);
  const [draftId, setDraftId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !token) return;
    void fetchIwrReports(token, { status: 'draft' })
      .then((out) => {
        const items = out.items ?? [];
        setDrafts(items);
        const weekly = items.find((r) => r.template_code === 'weekly_work');
        if (weekly) {
          setDraftId(weekly.id);
          setTitle(weekly.title || `Báo cáo tuần — ${week.label}`);
        }
      })
      .catch(() => undefined);
  }, [open, token, week.label]);

  useEffect(() => {
    if (!token || toQ.trim().length < 1) {
      setToHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrDirectory(token, toQ.trim(), 'to')
        .then((out) => setToHits(out.items ?? []))
        .catch(() => setToHits([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [token, toQ]);

  useEffect(() => {
    if (!token || ccQ.trim().length < 1) {
      setCcHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrDirectory(token, ccQ.trim(), 'cc')
        .then((out) => setCcHits(out.items ?? []))
        .catch(() => setCcHits([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [token, ccQ]);

  if (!open) return null;

  async function send() {
    if (!canWrite || !token) return;
    setBusy(true);
    setErr('');
    try {
      let id = draftId;
      if (!id) {
        const created = await createIwrReport(token, { template_code: 'weekly_work' });
        id = created.id;
      }
      await patchIwrReport(token, id, {
        title,
        sections_json: { notes: { body } },
      });
      await submitIwrReport(token, id, {
        cc_staff_ids: cc.map((c) => c.id),
      });
      onClose();
      router.push(`/crm/internal-reports/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gửi báo cáo thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="iwr-drawer-mask">
      <button type="button" aria-label="Đóng" onClick={onClose} />
      <aside className="iwr-drawer">
        <header>
          <h2>Gửi báo cáo</h2>
          <button type="button" className="iwr-btn" onClick={onClose} aria-label="Đóng drawer">
            ✕
          </button>
        </header>
        <div className="iwr-drawer__body">
          {err && <p className="iwr-err">{err}</p>}
          {drafts.length > 0 && (
            <label className="iwr-field">
              Báo cáo nháp
              <select
                value={draftId}
                onChange={(e) => {
                  setDraftId(e.target.value);
                  const row = drafts.find((d) => d.id === e.target.value);
                  if (row) setTitle(row.title);
                }}
              >
                <option value="">Tạo báo cáo tuần mới</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ChipField
            label="To"
            q={toQ}
            onQ={setToQ}
            hits={toHits}
            chips={to}
            onAdd={(s) => {
              setTo((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, { id: s.id, name: s.name, email: s.email }]));
              setToQ('');
              setToHits([]);
            }}
            onRemove={(id) => setTo((prev) => prev.filter((x) => x.id !== id))}
          />
          <ChipField
            label="Cc"
            q={ccQ}
            onQ={setCcQ}
            hits={ccHits}
            chips={cc}
            onAdd={(s) => {
              setCc((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, { id: s.id, name: s.name, email: s.email }]));
              setCcQ('');
              setCcHits([]);
            }}
            onRemove={(id) => setCc((prev) => prev.filter((x) => x.id !== id))}
          />
          <label className="iwr-field">
            Tiêu đề
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="iwr-field">
            Nội dung
            <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div className="iwr-hint">
            Quyền truy cập: người nhận To/Cc và quản lý trực tiếp. Nội bộ — không gửi khách.
          </div>
        </div>
        <footer>
          <button
            type="button"
            disabled={busy || !canWrite}
            className="iwr-btn iwr-btn--primary"
            style={{ width: '100%' }}
            onClick={() => void send()}
          >
            {busy ? 'Đang gửi…' : 'Gửi ngay'}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function ChipField({
  label,
  q,
  onQ,
  hits,
  chips,
  onAdd,
  onRemove,
}: {
  label: string;
  q: string;
  onQ: (v: string) => void;
  hits: IwrStaffNode[];
  chips: Chip[];
  onAdd: (s: IwrStaffNode) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div>
      <div className="iwr-field">{label}</div>
      <div className="iwr-chips">
        {chips.map((c) => (
          <span key={c.id} className="iwr-chip-tag">
            {c.name}
            <button type="button" onClick={() => onRemove(c.id)} aria-label={`Xóa ${c.name}`}>
              ×
            </button>
          </span>
        ))}
        <input placeholder="Tìm người nhận…" value={q} onChange={(e) => onQ(e.target.value)} />
      </div>
      {hits.length > 0 && (
        <ul className="iwr-search__hits" style={{ position: 'relative', marginTop: 4 }}>
          {hits.map((s) => (
            <li key={s.id}>
              <button type="button" className="iwr-btn" style={{ width: '100%', textAlign: 'left' }} onClick={() => onAdd(s)}>
                {s.name}
                {s.email ? <span className="iwr-muted"> {s.email}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
